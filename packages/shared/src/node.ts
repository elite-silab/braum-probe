// Braum 布隆 CF 探针 — 节点类型定义

import type { NodeMetricsWithRates } from './agent'

/** 节点地理区域 */
export type NodeRegion =
  | 'asia'
  | 'europe'
  | 'north_america'
  | 'south_america'
  | 'oceania'
  | 'africa'

/** 探针类型 */
export type ProbeType = 'http' | 'dns'

/** 节点状态 */
export type NodeStatus = 'active' | 'paused' | 'offline'

/** 探针节点 */
export interface Node {
  id: string
  name: string
  region: NodeRegion
  country: string
  city: string
  latitude: number
  longitude: number
  isp?: string | null
  probe_type: ProbeType
  probe_interval: number
  status: NodeStatus
  last_heartbeat_at?: string | null
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string
}

/** 节点汇总状态（前端展示用） */
export interface NodeSummary {
  id: string
  name: string
  region: NodeRegion
  country: string
  city: string
  status: NodeStatus
  latest_latency_ms: number | null
  availability_24h: number
  last_heartbeat_at: string | null
  registration_status?: 'pending' | 'registered'
  agent_os?: string | null
  agent_platform?: string | null
  agent_arch?: string | null
  agent_version?: string | null
  latest_metrics?: NodeMetricsWithRates | null
}

/** 创建节点请求 */
export interface CreateNodeInput {
  /** 省略时由服务端自动生成。 */
  id?: string
  name: string
  /** 以下位置字段省略时，将在 Agent 首次注册后自动识别。 */
  region?: NodeRegion
  country?: string
  city?: string
  latitude?: number
  longitude?: number
  isp?: string
  probe_type?: ProbeType
  probe_interval?: number
  target_ids?: string[]
}

/** 更新节点请求 */
export interface UpdateNodeInput {
  name?: string
  region?: NodeRegion
  country?: string
  city?: string
  latitude?: number
  longitude?: number
  isp?: string
  probe_type?: ProbeType
  probe_interval?: number
  status?: NodeStatus
  target_ids?: string[]
  metadata?: Record<string, unknown>
}
