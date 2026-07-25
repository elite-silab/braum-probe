package agent

import "time"

type SystemInfo struct {
	Hostname       string   `json:"hostname"`
	OS             string   `json:"os"`
	Platform       string   `json:"platform,omitempty"`
	KernelVersion  string   `json:"kernel_version,omitempty"`
	Arch           string   `json:"arch"`
	CPUModel       string   `json:"cpu_model,omitempty"`
	CPUCores       int      `json:"cpu_cores,omitempty"`
	Virtualization string   `json:"virtualization,omitempty"`
	AgentVersion   string   `json:"agent_version"`
	PrivateIPs     []string `json:"private_ips,omitempty"`
}

type Metrics struct {
	CPUUsage       float64 `json:"cpu_usage"`
	MemoryUsed     int64   `json:"memory_used_bytes"`
	MemoryTotal    int64   `json:"memory_total_bytes"`
	SwapUsed       int64   `json:"swap_used_bytes"`
	SwapTotal      int64   `json:"swap_total_bytes"`
	DiskUsed       int64   `json:"disk_used_bytes"`
	DiskTotal      int64   `json:"disk_total_bytes"`
	Load1          float64 `json:"load_1"`
	Load5          float64 `json:"load_5"`
	Load15         float64 `json:"load_15"`
	NetworkRX      int64   `json:"network_rx_bytes"`
	NetworkTX      int64   `json:"network_tx_bytes"`
	TCPConnections int     `json:"tcp_connections"`
	ProcessCount   int     `json:"process_count"`
	UptimeSeconds  int64   `json:"uptime_seconds"`
	CollectedAt    string  `json:"collected_at"`
}

type Target struct {
	ID             string `json:"id"`
	Name           string `json:"name"`
	Type           string `json:"target_type"`
	Address        string `json:"address"`
	Port           *int   `json:"port"`
	ExpectedStatus int    `json:"expected_status"`
	TimeoutMS      int    `json:"timeout_ms"`
}

type ProbeResult struct {
	TargetID   string   `json:"target_id"`
	Success    bool     `json:"success"`
	LatencyMS  *float64 `json:"latency_ms"`
	StatusCode *int     `json:"status_code"`
	DNSTimeMS  *float64 `json:"dns_time_ms"`
	Error      *string  `json:"error_message"`
	ProbeAt    string   `json:"probe_at"`
}

type HeartbeatData struct {
	HeartbeatInterval int      `json:"heartbeat_interval"`
	ServerTime        string   `json:"server_time"`
	Targets           []Target `json:"targets"`
}

func nowISO() string { return time.Now().UTC().Format(time.RFC3339Nano) }
