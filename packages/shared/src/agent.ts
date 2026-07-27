// Braum 布隆 CF 探针 — VPS Agent 协议类型

export interface AgentSystemInfo {
  hostname: string
  os: string
  platform?: string
  kernel_version?: string
  arch: string
  cpu_model?: string
  cpu_cores?: number
  virtualization?: string
  agent_version: string
  private_ips?: string[]
}

export interface NodeMetrics {
  cpu_usage: number
  memory_used_bytes: number
  memory_total_bytes: number
  swap_used_bytes: number
  swap_total_bytes: number
  disk_used_bytes: number
  disk_total_bytes: number
  load_1: number
  load_5: number
  load_15: number
  network_rx_bytes: number
  network_tx_bytes: number
  tcp_connections: number
  process_count: number
  uptime_seconds: number
  collected_at: string
}

/** 控制面基于相邻两次累计计数器计算的首页指标。 */
export interface NodeMetricsWithRates extends NodeMetrics {
  network_rx_bytes_per_second: number | null
  network_tx_bytes_per_second: number | null
}

export interface AgentEnrollInput {
  node_id: string
  enrollment_token: string
  system: AgentSystemInfo
}

export interface AgentEnrollResponse {
  node_id: string
  agent_secret: string
  heartbeat_interval: number
  server_time: string
}

export interface AgentHeartbeatInput {
  node_id: string
  system: AgentSystemInfo
  metrics: NodeMetrics
}

export interface AgentProbeTarget {
  id: string
  name: string
  target_type: 'http' | 'dns'
  address: string
  port: number | null
  expected_status: number
  timeout_ms: number
}

export interface AgentHeartbeatResponse {
  heartbeat_interval: number
  server_time: string
  targets: AgentProbeTarget[]
}

export interface AgentProbeResultInput {
  target_id: string
  success: boolean
  latency_ms: number | null
  status_code: number | null
  dns_time_ms: number | null
  error_message: string | null
  probe_at: string
}

export interface AgentProbeReportInput {
  node_id: string
  results: AgentProbeResultInput[]
}

export interface AgentInstallCommand {
  node_id: string
  enrollment_token: string
  expires_at: string
  install_command: string
}

export interface NodeAgentSnapshot {
  registration_status: 'pending' | 'registered'
  hostname: string | null
  os: string | null
  arch: string | null
  agent_version: string | null
  public_ip: string | null
  latest_metrics: NodeMetrics | null
}

export const REALTIME_PROTOCOL_VERSION = 1
export const REALTIME_MAX_MESSAGE_BYTES = 16 * 1024

export type AgentControlMessage =
  | { type: 'welcome'; protocol_version: number; server_time: string }
  | { type: 'config_changed'; reason: string; sent_at: string }
  | { type: 'disconnect'; reason: string; sent_at: string }
  | { type: 'pong' }

export type AgentRealtimeMessage =
  | { type: 'ready'; protocol_version: number; agent_version: string }
  | { type: 'ping' }

export type RealtimeViewerEvent =
  | { type: 'snapshot'; connected_node_ids: string[]; sent_at: string }
  | { type: 'node_connected'; node_id: string; sent_at: string }
  | { type: 'node_disconnected'; node_id: string; sent_at: string }
  | { type: 'metrics_updated'; node_id: string; sent_at: string }
  | { type: 'node_updated'; node_id: string; sent_at: string }
  | { type: 'node_deleted'; node_id: string; sent_at: string }

export type RealtimeInternalEvent =
  | { type: 'metrics_updated'; node_id: string }
  | { type: 'config_changed'; node_id: string; reason: string }
  | { type: 'disconnect_agent'; node_id: string; reason: string }
  | { type: 'node_deleted'; node_id: string }
