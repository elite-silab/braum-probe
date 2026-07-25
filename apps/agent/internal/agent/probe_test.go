package agent

import (
	"context"
	"io"
	"net/http"
	"strings"
	"testing"
	"time"
)

type roundTripFunc func(*http.Request) (*http.Response, error)

func (function roundTripFunc) RoundTrip(request *http.Request) (*http.Response, error) {
	return function(request)
}

func TestHTTPProbeChecksExpectedStatus(t *testing.T) {
	client := &http.Client{Transport: roundTripFunc(func(_ *http.Request) (*http.Response, error) {
		return &http.Response{
			StatusCode: http.StatusNoContent,
			Body:       io.NopCloser(strings.NewReader("")),
			Header:     make(http.Header),
		}, nil
	})}
	result := probeHTTP(context.Background(), Target{
		ID: "target-1", Type: "http", Address: "https://example.com",
		ExpectedStatus: http.StatusNoContent, TimeoutMS: 1000,
	}, time.Now(), client)
	if !result.Success {
		t.Fatalf("expected success: %#v", result)
	}
	if result.StatusCode == nil || *result.StatusCode != http.StatusNoContent {
		t.Fatalf("unexpected status: %#v", result.StatusCode)
	}
}

func TestUnsupportedProbeTypeFails(t *testing.T) {
	result := Probe(context.Background(), Target{ID: "target-1", Type: "tcp", TimeoutMS: 1000})
	if result.Success || result.Error == nil {
		t.Fatalf("expected failure: %#v", result)
	}
}
