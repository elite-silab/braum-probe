// Braum 布隆 CF 探针 — 公告/事件类型定义

/** 公告严重等级 */
export type IncidentSeverity = 'critical' | 'major' | 'minor'

/** 公告状态 */
export type IncidentStatus =
  | 'investigating'
  | 'identified'
  | 'monitoring'
  | 'resolved'
  | 'scheduled'

/** 公告/事件 */
export interface Incident {
  id: string
  title: string
  description: string
  severity: IncidentSeverity
  status: IncidentStatus
  created_by: string
  created_at: string
  updated_at: string
  resolved_at: string | null
  affected_node_ids: string[]
  affected_target_ids: string[]
}

/** 公告时间线更新 */
export interface IncidentUpdate {
  id: string
  incident_id: string
  status: IncidentStatus | null
  message: string
  created_by: string
  created_at: string
}

/** 创建公告请求 */
export interface CreateIncidentInput {
  title: string
  description: string
  severity: IncidentSeverity
  status?: IncidentStatus
  affected_node_ids?: string[]
  affected_target_ids?: string[]
}

/** 更新公告请求 */
export interface UpdateIncidentInput {
  title?: string
  description?: string
  severity?: IncidentSeverity
  status?: IncidentStatus
  affected_node_ids?: string[]
  affected_target_ids?: string[]
}

/** 追加公告时间线更新 */
export interface CreateIncidentUpdateInput {
  status?: IncidentStatus
  message: string
}
