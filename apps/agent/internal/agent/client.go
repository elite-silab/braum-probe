package agent

import (
	"bytes"
	"context"
	"crypto/tls"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"
)

type APIClient struct {
	server string
	client *http.Client
}

type apiResponse[T any] struct {
	Code    int    `json:"code"`
	Message string `json:"message"`
	Data    T      `json:"data"`
}

func NewAPIClient(server string) *APIClient {
	transport := &http.Transport{TLSClientConfig: &tls.Config{MinVersion: tls.VersionTLS12}}
	return &APIClient{server: server, client: &http.Client{Timeout: 35 * time.Second, Transport: transport}}
}

func (a *APIClient) post(ctx context.Context, path, secret string, input, output any) error {
	payload, err := json.Marshal(input)
	if err != nil {
		return err
	}
	request, err := http.NewRequestWithContext(ctx, http.MethodPost, a.server+path, bytes.NewReader(payload))
	if err != nil {
		return err
	}
	request.Header.Set("Content-Type", "application/json")
	request.Header.Set("User-Agent", "Braum-Agent")
	if secret != "" {
		request.Header.Set("Authorization", "Bearer "+secret)
	}
	response, err := a.client.Do(request)
	if err != nil {
		return err
	}
	defer response.Body.Close()
	body, err := io.ReadAll(io.LimitReader(response.Body, 2<<20))
	if err != nil {
		return err
	}
	if response.StatusCode < 200 || response.StatusCode >= 300 {
		var failure apiResponse[any]
		if json.Unmarshal(body, &failure) == nil && failure.Message != "" {
			return fmt.Errorf("API %d: %s", response.StatusCode, failure.Message)
		}
		return fmt.Errorf("API returned HTTP %d", response.StatusCode)
	}
	if err := json.Unmarshal(body, output); err != nil {
		return fmt.Errorf("decode API response: %w", err)
	}
	return nil
}

func (a *APIClient) Enroll(ctx context.Context, config *Config, system SystemInfo) (string, int, error) {
	var response apiResponse[struct {
		AgentSecret string `json:"agent_secret"`
		Interval    int    `json:"heartbeat_interval"`
	}]
	err := a.post(ctx, "/api/agent/v1/enroll", "", map[string]any{
		"node_id": config.NodeID, "enrollment_token": config.EnrollmentToken, "system": system,
	}, &response)
	return response.Data.AgentSecret, response.Data.Interval, err
}

func (a *APIClient) Heartbeat(ctx context.Context, config *Config, system SystemInfo, metrics Metrics) (HeartbeatData, error) {
	var response apiResponse[HeartbeatData]
	err := a.post(ctx, "/api/agent/v1/heartbeat", config.AgentSecret, map[string]any{
		"node_id": config.NodeID, "system": system, "metrics": metrics,
	}, &response)
	return response.Data, err
}

func (a *APIClient) Report(ctx context.Context, config *Config, results []ProbeResult) error {
	var response apiResponse[map[string]int]
	return a.post(ctx, "/api/agent/v1/probe-results", config.AgentSecret, map[string]any{
		"node_id": config.NodeID, "results": results,
	}, &response)
}
