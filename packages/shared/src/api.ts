// Braum 布隆 CF 探针 — API 通用类型定义

/** API 通用响应格式 */
export interface ApiResponse<T = unknown> {
  code: number
  message: string
  data: T
}

/** 分页元信息 */
export interface PaginatedMeta {
  page: number
  page_size: number
  total: number
  total_pages: number
}

/** 分页响应 */
export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  meta: PaginatedMeta
}

/** API 错误详情 */
export interface ApiError {
  code: number
  message: string
  details?: Array<{
    field: string
    reason: string
  }>
}

/** 认证响应 */
export interface AuthResponse {
  access_token: string
  refresh_token: string
  expires_in: number
  user: {
    id: string
    email: string
    name: string
    role: string
  }
}

/** 登录请求 */
export interface LoginInput {
  email: string
  password: string
}

/** 刷新 Token 请求 */
export interface RefreshTokenInput {
  refresh_token: string
}

/** 健康检查响应 */
export interface HealthResponse {
  status: 'ok' | 'degraded' | 'error'
  version: string
  timestamp: string
}

/** 详细健康检查响应 */
export interface DetailedHealthResponse extends HealthResponse {
  d1: 'ok' | 'error'
  kv: 'ok' | 'error'
  nodes_online: number
  nodes_total: number
}

/** 全局统计概览 */
export interface GlobalStats {
  nodes_total: number
  nodes_online: number
  nodes_offline: number
  nodes_warning: number
  targets_total: number
  avg_latency_ms: number | null
  overall_availability: number
  active_incidents: number
}
