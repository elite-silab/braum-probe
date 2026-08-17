// Braum 布隆 CF 探针 — 审计日志辅助

import type { Env } from '../env'

interface AuditLogInput {
  user_id?: string
  action: 'create' | 'update' | 'delete' | 'login' | 'logout' | 'change_password'
  object_type: 'node' | 'target' | 'alert_rule' | 'alert_channel' | 'incident' | 'user' | 'setting' | 'agent_enrollment' | 'agent_credential'
  object_id?: string
  changes?: Record<string, unknown>
  ip_address?: string
  user_agent?: string
}

const REDACTED = '[REDACTED]'
const SENSITIVE_KEYS = new Set([
  'password',
  'passwordhash',
  'token',
  'accesstoken',
  'refreshtoken',
  'bottoken',
  'secret',
  'jwtsecret',
  'authorization',
  'cookie',
  'setcookie',
  'apikey',
])

function normalizeKey(key: string): string {
  return key.toLowerCase().replace(/[^a-z0-9]/g, '')
}

/** 递归隐藏审计数据中的凭据；字符串配置整体隐藏，避免 JSON 字符串绕过。 */
export function redactAuditChanges(value: unknown, parentKey = ''): unknown {
  if (SENSITIVE_KEYS.has(normalizeKey(parentKey))) return REDACTED
  if (normalizeKey(parentKey) === 'config' && typeof value === 'string') return REDACTED

  if (Array.isArray(value)) {
    return value.map((item) => redactAuditChanges(item, parentKey))
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .map(([key, item]) => [key, redactAuditChanges(item, key)])
    )
  }

  return value
}

/**
 * 写入审计日志
 */
export async function writeAuditLog(env: Env, input: AuditLogInput): Promise<void> {
  try {
    await env.DB.prepare(
      `INSERT INTO audit_logs (user_id, action, object_type, object_id, changes, ip_address, user_agent)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      input.user_id || null,
      input.action,
      input.object_type,
      input.object_id || null,
      JSON.stringify(redactAuditChanges(input.changes || {})),
      input.ip_address || null,
      input.user_agent || null
    ).run()
  } catch (error) {
    // 审计日志写入失败不应阻塞主流程
    console.error(JSON.stringify({
      event: 'audit_log_error',
      error: error instanceof Error ? error.message : 'Unknown error',
      action: input.action,
      object_type: input.object_type,
      object_id: input.object_id,
    }))
  }
}
