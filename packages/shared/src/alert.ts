// Braum 布隆 CF 探针 — 告警类型定义

/** 告警指标 */
export type AlertMetric =
  | 'availability'
  | 'latency_ms'
  | 'consecutive_failures'
  | 'cpu_usage'
  | 'memory_usage'
  | 'disk_usage'
  | 'load_1'
  | 'heartbeat_age_seconds'

/** 比较运算符 */
export type ComparisonOperator = '>' | '<' | '>=' | '<=' | '=='

/** 告警作用范围 */
export type AlertScope = 'all' | 'nodes' | 'groups' | 'regions'

/** 通知渠道类型 */
export type AlertChannelType =
  | 'telegram'
  | 'email'
  | 'webhook'
  | 'wecom'
  | 'slack'
  | 'discord'

/** 告警事件类型 */
export type AlertEventType = 'firing' | 'resolved'

/** 告警规则 */
export interface AlertRule {
  id: string
  name: string
  metric: AlertMetric
  operator: ComparisonOperator
  threshold: number
  duration_seconds: number
  scope: AlertScope
  suppress_minutes: number
  notify_on_recovery: boolean
  enabled: boolean
  created_at: string
  updated_at: string
}

/** 告警规则创建请求 */
export interface CreateAlertRuleInput {
  name: string
  metric: AlertMetric
  operator: ComparisonOperator
  threshold: number
  duration_seconds?: number
  scope?: AlertScope
  suppress_minutes?: number
  notify_on_recovery?: boolean
  node_ids?: string[]
  group_ids?: string[]
  channel_ids: string[]
}

/** 通知渠道 */
export interface AlertChannel {
  id: string
  name: string
  channel_type: AlertChannelType
  config?: {
    chat_id?: string
    bot_token_configured?: boolean
    url_configured?: boolean
  }
  enabled: boolean
  created_at: string
  updated_at: string
}

/** 通知渠道创建请求 */
export interface CreateAlertChannelInput {
  name: string
  channel_type: AlertChannelType
  config: Record<string, unknown>
}

/** 告警事件 */
export interface AlertEvent {
  id: string
  rule_id: string
  node_id: string | null
  target_id: string | null
  trigger_value: number
  event_type: AlertEventType
  message: string | null
  notified: boolean
  fired_at: string
  resolved_at: string | null
}
