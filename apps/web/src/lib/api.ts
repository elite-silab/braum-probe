// Braum 布隆 CF 探针 — API 客户端
// 前端展示页使用 Workers Public API
// 前台和管理后台统一使用 Workers API

const API_BASE = ''
const ADMIN_API_BASE = `${API_BASE}/api/admin/v1` // 直接调用 Workers Admin API

interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
  code?: number
  meta?: {
    page: number
    per_page: number
    total: number
    total_pages: number
  }
}

interface RawApiResponse<T> {
  code?: number
  message?: string
  error?: string
  data?: T | null
  success?: boolean
  meta?: ApiResponse<T>['meta']
}

function getToken(): string {
  if (typeof localStorage !== 'undefined') {
    return localStorage.getItem('token') || ''
  }
  return ''
}

function authHeaders(): Record<string, string> {
  return { Authorization: `Bearer ${getToken()}` }
}

async function request<T>(url: string, options?: RequestInit): Promise<ApiResponse<T>> {
  try {
    const res = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
      ...options,
    })
    const json = await res.json() as RawApiResponse<T>
    // 标准化 API 响应：Workers API 返回 { code: 0, data, meta } 格式
    // 转换为前端统一的 { success, data, error, meta } 格式
    if (typeof json.code === 'number') {
      return {
        success: json.code === 0,
        data: json.data ?? undefined,
        error: json.code !== 0 ? (json.message || json.error) : undefined,
        code: json.code,
        meta: json.meta,
      }
    }
    return json as ApiResponse<T>
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Network error',
    }
  }
}

/** 公开 API（前端展示页） */
export const api = {
  health: () => request<{ status: string; version: string }>(`${API_BASE}/health`),

  // 节点
  getNodes: (params?: Record<string, string>) => {
    const qs = params ? '?' + new URLSearchParams(params).toString() : ''
    return request<unknown[]>(`${API_BASE}/api/v1/nodes${qs}`)
  },
  getNode: (id: string) => request<unknown>(`${API_BASE}/api/v1/nodes/${id}`),

  // 探测结果
  getProbeResults: (params?: Record<string, string>) => {
    const qs = params ? '?' + new URLSearchParams(params).toString() : ''
    return request<unknown[]>(`${API_BASE}/api/v1/probe-results${qs}`)
  },

  // 公告
  getIncidents: (page = 1) => request<unknown[]>(`${API_BASE}/api/v1/incidents?page=${page}`),
  getIncident: (id: string) => request<unknown>(`${API_BASE}/api/v1/incidents/${id}`),
}

/** 管理 API（Workers JWT API） */
export const adminApi = {
  // 认证
  login: (email: string, password: string) =>
    request<{ access_token: string; refresh_token: string; user: unknown }>(
      `${API_BASE}/api/v1/auth/login`,
      { method: 'POST', body: JSON.stringify({ email, password }) }
    ),
  refresh: (refreshToken: string) =>
    request<{ access_token: string; refresh_token: string }>(
      `${API_BASE}/api/v1/auth/refresh`,
      { method: 'POST', body: JSON.stringify({ refresh_token: refreshToken }) }
    ),
  me: () => request<{ id: string; email: string; name: string; role: string }>(
    `${API_BASE}/api/v1/auth/me`, { headers: authHeaders() }
  ),

  // 节点管理
  getNodes: (page = 1) => request<unknown[]>(`${ADMIN_API_BASE}/nodes?page=${page}`, {
    headers: authHeaders(),
  }),
  getNode: (id: string) => request<unknown>(`${ADMIN_API_BASE}/nodes/${id}`, {
    headers: authHeaders(),
  }),
  createNode: (data: unknown) => request<unknown>(`${ADMIN_API_BASE}/nodes`, {
    method: 'POST', body: JSON.stringify(data), headers: authHeaders(),
  }),
  updateNode: (id: string, data: unknown) => request<unknown>(`${ADMIN_API_BASE}/nodes/${id}`, {
    method: 'PUT', body: JSON.stringify(data), headers: authHeaders(),
  }),
  deleteNode: (id: string) => request<unknown>(`${ADMIN_API_BASE}/nodes/${id}`, {
    method: 'DELETE', headers: authHeaders(),
  }),

  // VPS Agent 注册与状态
  getAgentNode: (nodeId: string) => request<unknown>(`${ADMIN_API_BASE}/agents/nodes/${nodeId}`, {
    headers: authHeaders(),
  }),
  createAgentEnrollment: (nodeId: string) => request<{
    node_id: string
    enrollment_token: string
    expires_at: string
    install_command: string
  }>(`${ADMIN_API_BASE}/agents/nodes/${nodeId}/enrollment`, {
    method: 'POST', headers: authHeaders(),
  }),
  revokeAgentCredential: (nodeId: string) => request<null>(`${ADMIN_API_BASE}/agents/nodes/${nodeId}/credentials`, {
    method: 'DELETE', headers: authHeaders(),
  }),

  // 目标管理
  getTargets: (page = 1) => request<unknown[]>(`${ADMIN_API_BASE}/targets?page=${page}`, {
    headers: authHeaders(),
  }),
  getTarget: (id: string) => request<unknown>(`${ADMIN_API_BASE}/targets/${id}`, {
    headers: authHeaders(),
  }),
  createTarget: (data: unknown) => request<unknown>(`${ADMIN_API_BASE}/targets`, {
    method: 'POST', body: JSON.stringify(data), headers: authHeaders(),
  }),
  updateTarget: (id: string, data: unknown) => request<unknown>(`${ADMIN_API_BASE}/targets/${id}`, {
    method: 'PUT', body: JSON.stringify(data), headers: authHeaders(),
  }),
  deleteTarget: (id: string) => request<unknown>(`${ADMIN_API_BASE}/targets/${id}`, {
    method: 'DELETE', headers: authHeaders(),
  }),

  // 告警规则
  getAlertRules: () => request<unknown[]>(`${ADMIN_API_BASE}/alerts/rules`, {
    headers: authHeaders(),
  }),
  getAlertRule: (id: string) => request<unknown>(`${ADMIN_API_BASE}/alerts/rules/${id}`, {
    headers: authHeaders(),
  }),
  createAlertRule: (data: unknown) => request<unknown>(`${ADMIN_API_BASE}/alerts/rules`, {
    method: 'POST', body: JSON.stringify(data), headers: authHeaders(),
  }),
  updateAlertRule: (id: string, data: unknown) => request<unknown>(`${ADMIN_API_BASE}/alerts/rules/${id}`, {
    method: 'PUT', body: JSON.stringify(data), headers: authHeaders(),
  }),
  deleteAlertRule: (id: string) => request<unknown>(`${ADMIN_API_BASE}/alerts/rules/${id}`, {
    method: 'DELETE', headers: authHeaders(),
  }),

  // 通知渠道
  getAlertChannels: () => request<unknown[]>(`${ADMIN_API_BASE}/alerts/channels`, {
    headers: authHeaders(),
  }),
  createAlertChannel: (data: unknown) => request<unknown>(`${ADMIN_API_BASE}/alerts/channels`, {
    method: 'POST', body: JSON.stringify(data), headers: authHeaders(),
  }),
  updateAlertChannel: (id: string, data: unknown) => request<unknown>(`${ADMIN_API_BASE}/alerts/channels/${id}`, {
    method: 'PUT', body: JSON.stringify(data), headers: authHeaders(),
  }),
  testAlertChannel: (id: string) => request<{ sent: boolean }>(`${ADMIN_API_BASE}/alerts/channels/${id}/test`, {
    method: 'POST', headers: authHeaders(),
  }),
  deleteAlertChannel: (id: string) => request<unknown>(`${ADMIN_API_BASE}/alerts/channels/${id}`, {
    method: 'DELETE', headers: authHeaders(),
  }),

  // 告警事件
  getAlertEvents: (page = 1) => request<unknown[]>(`${ADMIN_API_BASE}/alerts/events?page=${page}`, {
    headers: authHeaders(),
  }),

  // 公告管理
  getIncidents: (page = 1) => request<unknown[]>(`${ADMIN_API_BASE}/incidents?page=${page}`, {
    headers: authHeaders(),
  }),
  getIncident: (id: string) => request<unknown>(`${ADMIN_API_BASE}/incidents/${id}`, {
    headers: authHeaders(),
  }),
  createIncident: (data: unknown) => request<unknown>(`${ADMIN_API_BASE}/incidents`, {
    method: 'POST', body: JSON.stringify(data), headers: authHeaders(),
  }),
  updateIncident: (id: string, data: unknown) => request<unknown>(`${ADMIN_API_BASE}/incidents/${id}`, {
    method: 'PUT', body: JSON.stringify(data), headers: authHeaders(),
  }),
  deleteIncident: (id: string) => request<unknown>(`${ADMIN_API_BASE}/incidents/${id}`, {
    method: 'DELETE', headers: authHeaders(),
  }),

  // 系统设置
  getSettings: () => request<Record<string, string>>(`${ADMIN_API_BASE}/settings`, {
    headers: authHeaders(),
  }),
  updateSettings: (settings: Record<string, string>) =>
    request<{ updated: number }>(`${ADMIN_API_BASE}/settings`, {
      method: 'PUT',
      body: JSON.stringify({ settings }),
      headers: authHeaders(),
    }),

  // 审计日志
  getAuditLogs: (params?: Record<string, string>) => {
    const qs = params ? '?' + new URLSearchParams(params).toString() : ''
    return request<unknown[]>(`${ADMIN_API_BASE}/audit-logs${qs}`, {
      headers: authHeaders(),
    })
  },

  // 用户管理
  getUsers: (page = 1) => request<unknown[]>(`${ADMIN_API_BASE}/users?page=${page}`, {
    headers: authHeaders(),
  }),
  getUser: (id: string) => request<unknown>(`${ADMIN_API_BASE}/users/${id}`, {
    headers: authHeaders(),
  }),
  createUser: (data: unknown) => request<unknown>(`${ADMIN_API_BASE}/users`, {
    method: 'POST', body: JSON.stringify(data), headers: authHeaders(),
  }),
  updateUser: (id: string, data: unknown) => request<unknown>(`${ADMIN_API_BASE}/users/${id}`, {
    method: 'PUT', body: JSON.stringify(data), headers: authHeaders(),
  }),
  deleteUser: (id: string) => request<unknown>(`${ADMIN_API_BASE}/users/${id}`, {
    method: 'DELETE', headers: authHeaders(),
  }),
}
