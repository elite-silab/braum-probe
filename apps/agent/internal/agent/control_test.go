package agent

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/gorilla/websocket"
)

func TestControlURL(t *testing.T) {
	got, err := controlURL("https://braum.example.com/base", "node-1")
	if err != nil {
		t.Fatal(err)
	}
	if got != "wss://braum.example.com/api/agent/v1/ws?node_id=node-1" {
		t.Fatalf("unexpected control URL: %s", got)
	}

	local, err := controlURL("http://127.0.0.1:8787", "node-local")
	if err != nil || local != "ws://127.0.0.1:8787/api/agent/v1/ws?node_id=node-local" {
		t.Fatalf("unexpected local control URL: %s (%v)", local, err)
	}
}

func TestControlSessionAuthenticatesAndWakesHeartbeat(t *testing.T) {
	upgrader := websocket.Upgrader{CheckOrigin: func(_ *http.Request) bool { return true }}
	server := httptest.NewServer(http.HandlerFunc(func(response http.ResponseWriter, request *http.Request) {
		if request.URL.Path != "/api/agent/v1/ws" || request.URL.Query().Get("node_id") != "node-1" {
			http.Error(response, "bad route", http.StatusBadRequest)
			return
		}
		if request.Header.Get("Authorization") != "Bearer brm_agent_test" {
			http.Error(response, "unauthorized", http.StatusUnauthorized)
			return
		}
		connection, err := upgrader.Upgrade(response, request, nil)
		if err != nil {
			return
		}
		defer connection.Close()
		_, ready, err := connection.ReadMessage()
		if err != nil || !strings.Contains(string(ready), `"type":"ready"`) {
			return
		}
		_ = connection.WriteJSON(map[string]any{
			"type":   "config_changed",
			"reason": "node_updated",
		})
		<-request.Context().Done()
	}))
	defer server.Close()

	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()
	reportNow := make(chan struct{}, 1)
	client := NewAPIClient(server.URL)
	done := make(chan error, 1)
	go func() {
		done <- client.runControlSession(ctx, Config{
			Server: server.URL, NodeID: "node-1", AgentSecret: "brm_agent_test",
		}, "test", reportNow)
	}()

	select {
	case <-reportNow:
		cancel()
	case <-ctx.Done():
		t.Fatal("control message did not wake heartbeat")
	}
	select {
	case <-done:
	case <-time.After(time.Second):
		t.Fatal("control session did not stop with context")
	}
}
