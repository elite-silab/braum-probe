// Braum 布隆 CF 探针 — 监控目标类型定义

/** 目标探测类型 */
export type TargetType = 'http' | 'dns'

/** 目标状态 */
export type TargetStatus = 'active' | 'paused'

/** 监控目标 */
export interface Target {
  id: string
  name: string
  address: string
  target_type: TargetType
  port?: number | null
  expected_status: number
  timeout_ms: number
  status: TargetStatus
  created_at: string
  updated_at: string
}

/** 目标分组 */
export interface TargetGroup {
  id: string
  name: string
  description?: string | null
  created_at: string
}

/** 创建目标请求 */
export interface CreateTargetInput {
  /** 省略时从地址自动生成。 */
  name?: string
  address: string
  /** 省略时根据地址是否带 http(s) 自动判断。 */
  target_type?: TargetType
  port?: number
  expected_status?: number
  timeout_ms?: number
}

/** 更新目标请求 */
export interface UpdateTargetInput {
  name?: string
  address?: string
  target_type?: TargetType
  port?: number
  expected_status?: number
  timeout_ms?: number
  status?: TargetStatus
}

/** 创建目标分组请求 */
export interface CreateTargetGroupInput {
  name: string
  description?: string
  target_ids?: string[]
}
