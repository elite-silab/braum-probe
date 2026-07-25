package agent

import (
	"context"
	"crypto/tls"
	"fmt"
	"net"
	"net/http"
	"strings"
	"sync"
	"time"
)

func stringPointer(value string) *string  { return &value }
func floatPointer(value float64) *float64 { return &value }
func intPointer(value int) *int           { return &value }

func probeHTTP(ctx context.Context, target Target, started time.Time, client *http.Client) ProbeResult {
	result := ProbeResult{TargetID: target.ID, ProbeAt: nowISO()}
	address := target.Address
	if !strings.HasPrefix(address, "http://") && !strings.HasPrefix(address, "https://") {
		address = "https://" + address
	}
	request, err := http.NewRequestWithContext(ctx, http.MethodGet, address, nil)
	if err == nil {
		request.Header.Set("User-Agent", "Braum-Agent")
		response, requestErr := client.Do(request)
		latency := float64(time.Since(started).Microseconds()) / 1000
		result.LatencyMS = floatPointer(latency)
		if requestErr == nil {
			_ = response.Body.Close()
			result.StatusCode = intPointer(response.StatusCode)
			result.Success = response.StatusCode == target.ExpectedStatus
			if !result.Success {
				result.Error = stringPointer(fmt.Sprintf("expected HTTP %d, got %d", target.ExpectedStatus, response.StatusCode))
			}
			return result
		}
		err = requestErr
	}
	result.Error = stringPointer(err.Error())
	return result
}

func Probe(ctx context.Context, target Target) ProbeResult {
	result := ProbeResult{TargetID: target.ID, ProbeAt: nowISO()}
	timeout := time.Duration(target.TimeoutMS) * time.Millisecond
	if timeout < 100*time.Millisecond || timeout > 30*time.Second {
		timeout = 5 * time.Second
	}
	started := time.Now()

	switch target.Type {
	case "http":
		transport := &http.Transport{TLSClientConfig: &tls.Config{MinVersion: tls.VersionTLS12}, DisableKeepAlives: true}
		client := &http.Client{Timeout: timeout, Transport: transport, CheckRedirect: func(_ *http.Request, via []*http.Request) error {
			if len(via) >= 5 {
				return fmt.Errorf("too many redirects")
			}
			return nil
		}}
		return probeHTTP(ctx, target, started, client)

	case "dns":
		lookupCtx, cancel := context.WithTimeout(ctx, timeout)
		defer cancel()
		_, err := net.DefaultResolver.LookupHost(lookupCtx, target.Address)
		latency := float64(time.Since(started).Microseconds()) / 1000
		result.LatencyMS = floatPointer(latency)
		result.DNSTimeMS = floatPointer(latency)
		result.Success = err == nil
		if err != nil {
			result.Error = stringPointer(err.Error())
		}

	default:
		result.Error = stringPointer("unsupported target type")
	}
	return result
}

func ProbeAll(ctx context.Context, targets []Target) []ProbeResult {
	results := make([]ProbeResult, len(targets))
	semaphore := make(chan struct{}, 4)
	var wait sync.WaitGroup
	for index, target := range targets {
		wait.Add(1)
		go func(index int, target Target) {
			defer wait.Done()
			semaphore <- struct{}{}
			defer func() { <-semaphore }()
			results[index] = Probe(ctx, target)
		}(index, target)
	}
	wait.Wait()
	return results
}
