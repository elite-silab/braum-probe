// Braum 布隆 CF 探针 — 探测结果类型定义

/** 单次探测结果 */
export interface ProbeResult {
  id: number
  node_id: string
  target_id: string
  success: boolean
  latency_ms: number | null
  status_code: number | null
  dns_time_ms: number | null
  error_message: string | null
  probe_at: string
  created_at: string
}

/** HTTP 探测详细结果 */
export interface HttpProbeDetail {
  dns_time_ms: number
  connect_time_ms: number
  ttfb_ms: number
  total_time_ms: number
  status_code: number
  response_size_bytes: number
}

/** DNS 探测详细结果 */
export interface DnsProbeDetail {
  resolve_time_ms: number
  resolved_ips: string[]
  dns_server: string
}

/** 聚合统计（小时/天） */
export interface ProbeStats {
  node_id: string
  target_id: string
  period: 'hourly' | 'daily'
  period_start: string
  total_probes: number
  success_count: number
  avg_latency_ms: number | null
  p50_latency_ms: number | null
  p95_latency_ms: number | null
  p99_latency_ms: number | null
  min_latency_ms: number | null
  max_latency_ms: number | null
  availability: number
}

/** 探测结果查询参数 */
export interface ProbeResultQuery {
  node_id?: string
  target_id?: string
  start_time?: string
  end_time?: string
  page?: number
  page_size?: number
}

/** 探测结果上报（Workers 内部使用） */
export interface ProbeResultInput {
  node_id: string
  target_id: string
  success: boolean
  latency_ms: number | null
  status_code: number | null
  dns_time_ms: number | null
  error_message: string | null
  probe_at: string
}
