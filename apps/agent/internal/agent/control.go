package agent

import (
	"context"
	"crypto/tls"
	"encoding/json"
	"fmt"
	"log"
	"math/rand"
	"net/http"
	"net/url"
	"time"

	"github.com/gorilla/websocket"
)

const (
	realtimeProtocolVersion = 1
	realtimeReadLimit       = 16 * 1024
	realtimePingInterval    = 25 * time.Second
	realtimeReadTimeout     = 75 * time.Second
)

type controlMessage struct {
	Type            string `json:"type"`
	ProtocolVersion int    `json:"protocol_version,omitempty"`
	AgentVersion    string `json:"agent_version,omitempty"`
	Reason          string `json:"reason,omitempty"`
}

func controlURL(server, nodeID string) (string, error) {
	endpoint, err := url.Parse(server)
	if err != nil {
		return "", fmt.Errorf("parse server URL: %w", err)
	}
	switch endpoint.Scheme {
	case "https":
		endpoint.Scheme = "wss"
	case "http":
		endpoint.Scheme = "ws"
	default:
		return "", fmt.Errorf("unsupported server scheme %q", endpoint.Scheme)
	}
	endpoint.Path = "/api/agent/v1/ws"
	endpoint.RawQuery = url.Values{"node_id": []string{nodeID}}.Encode()
	endpoint.Fragment = ""
	return endpoint.String(), nil
}

// RunControlChannel maintains the optional realtime control connection. HTTPS
// heartbeat reporting remains authoritative when this channel is unavailable.
func (a *APIClient) RunControlChannel(ctx context.Context, config Config, agentVersion string, reportNow chan<- struct{}) {
	backoff := 5 * time.Second
	for ctx.Err() == nil {
		sessionStarted := time.Now()
		err := a.runControlSession(ctx, config, agentVersion, reportNow)
		if ctx.Err() != nil {
			return
		}
		if err != nil {
			log.Printf("realtime channel disconnected: %v", err)
		}
		if time.Since(sessionStarted) >= 2*realtimePingInterval {
			backoff = 5 * time.Second
		}

		jitter := time.Duration(rand.Intn(1000)) * time.Millisecond
		timer := time.NewTimer(backoff + jitter)
		select {
		case <-ctx.Done():
			timer.Stop()
			return
		case <-timer.C:
		}
		if backoff < time.Minute {
			backoff *= 2
			if backoff > time.Minute {
				backoff = time.Minute
			}
		}
	}
}

func (a *APIClient) runControlSession(ctx context.Context, config Config, agentVersion string, reportNow chan<- struct{}) error {
	endpoint, err := controlURL(config.Server, config.NodeID)
	if err != nil {
		return err
	}
	dialer := websocket.Dialer{
		HandshakeTimeout: 15 * time.Second,
		TLSClientConfig:  &tls.Config{MinVersion: tls.VersionTLS12},
	}
	headers := http.Header{}
	headers.Set("Authorization", "Bearer "+config.AgentSecret)
	headers.Set("User-Agent", "Braum-Agent/"+agentVersion)
	connection, response, err := dialer.DialContext(ctx, endpoint, headers)
	if response != nil && response.Body != nil {
		defer response.Body.Close()
	}
	if err != nil {
		if response != nil {
			return fmt.Errorf("WebSocket handshake returned HTTP %d: %w", response.StatusCode, err)
		}
		return fmt.Errorf("connect WebSocket: %w", err)
	}
	defer connection.Close()
	connection.SetReadLimit(realtimeReadLimit)
	if err := connection.SetReadDeadline(time.Now().Add(realtimeReadTimeout)); err != nil {
		return err
	}
	if err := connection.WriteJSON(controlMessage{
		Type:            "ready",
		ProtocolVersion: realtimeProtocolVersion,
		AgentVersion:    agentVersion,
	}); err != nil {
		return fmt.Errorf("send ready: %w", err)
	}

	sessionCtx, cancel := context.WithCancel(ctx)
	defer cancel()
	go func() {
		<-sessionCtx.Done()
		_ = connection.Close()
	}()
	writeErrors := make(chan error, 1)
	go func() {
		ticker := time.NewTicker(realtimePingInterval)
		defer ticker.Stop()
		for {
			select {
			case <-sessionCtx.Done():
				return
			case <-ticker.C:
				if err := connection.SetWriteDeadline(time.Now().Add(10 * time.Second)); err != nil {
					select {
					case writeErrors <- err:
					default:
					}
					return
				}
				if err := connection.WriteMessage(websocket.TextMessage, []byte(`{"type":"ping"}`)); err != nil {
					select {
					case writeErrors <- err:
					default:
					}
					return
				}
			}
		}
	}()

	for {
		messageType, payload, err := connection.ReadMessage()
		if err != nil {
			select {
			case writeErr := <-writeErrors:
				return fmt.Errorf("send keepalive: %w", writeErr)
			default:
			}
			return fmt.Errorf("read control message: %w", err)
		}
		if messageType != websocket.TextMessage || len(payload) > realtimeReadLimit {
			return fmt.Errorf("unsupported control message")
		}
		if err := connection.SetReadDeadline(time.Now().Add(realtimeReadTimeout)); err != nil {
			return err
		}
		var message controlMessage
		if err := json.Unmarshal(payload, &message); err != nil {
			return fmt.Errorf("decode control message: %w", err)
		}
		switch message.Type {
		case "welcome":
			if message.ProtocolVersion != realtimeProtocolVersion {
				return fmt.Errorf("unsupported realtime protocol version %d", message.ProtocolVersion)
			}
			continue
		case "pong":
			continue
		case "config_changed":
			select {
			case reportNow <- struct{}{}:
			default:
			}
		case "disconnect":
			return fmt.Errorf("server disconnected Agent: %s", message.Reason)
		default:
			return fmt.Errorf("unsupported control message type %q", message.Type)
		}
	}
}
