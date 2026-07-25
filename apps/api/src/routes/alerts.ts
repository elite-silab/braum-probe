// Braum 布隆 CF 探针 — 告警路由

import { Hono } from 'hono'
import type { Env } from '../env'
import { success, paginated, notFound, badRequest } from '../utils/response'
import { writeAuditLog } from '../utils/audit'
import { decryptConfig, encryptConfig } from '../utils/encryption'
import { parsePublicHttpUrl } from '../utils/outbound'

export const alertRoutes = new Hono<{ Bindings: Env }>()

const ALERT_METRICS = new Set([
  'availability', 'latency_ms', 'consecutive_failures',
  'cpu_usage', 'memory_usage', 'disk_usage', 'load_1', 'heartbeat_age_seconds',
])
const ALERT_OPERATORS = new Set(['>', '<', '>=', '<=', '=='])
const ALERT_SCOPES = new Set(['all', 'nodes', 'groups', 'regions'])
const ALERT_CHANNEL_TYPES = new Set(['telegram', 'webhook'])

function validateChannel(type: unknown, config: unknown): string | null {
  if (!ALERT_CHANNEL_TYPES.has(String(type))) return 'Invalid channel_type'
  if (!config || typeof config !== 'object' || Array.isArray(config)) return 'Invalid channel config'
  const value = config as Record<string, unknown>
  if (type === 'telegram') {
    if (typeof value.chat_id !== 'string' || !value.chat_id.trim() || value.chat_id.length > 100) return 'Invalid Telegram chat_id'
    if (value.bot_token !== undefined && (typeof value.bot_token !== 'string' || value.bot_token.length > 256)) return 'Invalid Telegram bot_token'
  }
  if (type === 'webhook' && (typeof value.url !== 'string' || !parsePublicHttpUrl(value.url))) return 'Unsafe or invalid webhook URL'
  return null
}

function validateRule(input: Record<string, unknown>): string | null {
  if (typeof input.name !== 'string' || !input.name.trim() || input.name.length > 100) return 'Invalid name'
  if (!ALERT_METRICS.has(String(input.metric))) return 'Invalid metric'
  if (!ALERT_OPERATORS.has(String(input.operator))) return 'Invalid operator'
  if (typeof input.threshold !== 'number' || !Number.isFinite(input.threshold)) return 'Invalid threshold'
  if (!ALERT_SCOPES.has(String(input.scope ?? 'all'))) return 'Invalid scope'
  const duration = Number(input.duration_seconds ?? 300)
  const suppress = Number(input.suppress_minutes ?? 15)
  if (!Number.isInteger(duration) || duration < 60 || duration > 86400) return 'Invalid duration_seconds'
  if (!Number.isInteger(suppress) || suppress < 0 || suppress > 10080) return 'Invalid suppress_minutes'
  if (input.node_ids !== undefined && (!Array.isArray(input.node_ids) || input.node_ids.length > 100)) return 'Invalid node_ids'
  return null
}

// GET /api/v1/alerts/rules — 告警规则列表
alertRoutes.get('/rules', async (c) => {
  const rules = await c.env.DB.prepare('SELECT * FROM alert_rules ORDER BY created_at DESC').all()
  return c.json(success(rules.results || []))
})

// GET /api/v1/alerts/rules/:id — 规则详情
alertRoutes.get('/rules/:id', async (c) => {
  const rule = await c.env.DB.prepare('SELECT * FROM alert_rules WHERE id = ?').bind(c.req.param('id')).first()
  if (!rule) return c.json(notFound('Alert rule not found'), 404)
  return c.json(success(rule))
})

// POST /api/v1/alerts/rules — 创建规则
alertRoutes.post('/rules', async (c) => {
  const body = await c.req.json()
  const { name, metric, operator, threshold, duration_seconds, scope, suppress_minutes, notify_on_recovery, channel_ids, enabled } = body

  const validationError = validateRule(body)
  if (validationError) return c.json(badRequest(validationError), 400)

  const id = crypto.randomUUID()
  await c.env.DB.prepare(
    `INSERT INTO alert_rules (id, name, metric, operator, threshold, duration_seconds, scope, suppress_minutes, notify_on_recovery, enabled)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(id, name.trim(), metric, operator, threshold, duration_seconds || 300, scope || 'all', suppress_minutes ?? 15, notify_on_recovery ? 1 : 0, enabled === false ? 0 : 1).run()

  // 未显式选择时自动关联全部已启用渠道，保持轻量配置体验。
  const selectedChannelIds = Array.isArray(channel_ids)
    ? channel_ids
    : ((await c.env.DB.prepare('SELECT id FROM alert_channels WHERE enabled = 1').all()).results || []).map(row => String((row as { id: string }).id))
  if (selectedChannelIds.length > 0) {
    const stmts = selectedChannelIds.map((cid: string) =>
      c.env.DB.prepare('INSERT INTO alert_rule_channels (rule_id, channel_id) VALUES (?, ?)').bind(id, cid)
    )
    await c.env.DB.batch(stmts)
  }

  if (Array.isArray(body.node_ids) && body.node_ids.length > 0) {
    await c.env.DB.batch(body.node_ids.map((nodeId: string) =>
      c.env.DB.prepare('INSERT INTO alert_rule_nodes (rule_id, node_id) VALUES (?, ?)').bind(id, nodeId)
    ))
  }

  const rule = await c.env.DB.prepare('SELECT * FROM alert_rules WHERE id = ?').bind(id).first()

  await writeAuditLog(c.env, {
    user_id: c.get('userId' as never) as string | undefined,
    action: 'create',
    object_type: 'alert_rule',
    object_id: id,
    changes: body,
    ip_address: c.req.header('CF-Connecting-IP'),
  })

  return c.json(success(rule), 201)
})

// PUT /api/v1/alerts/rules/:id — 更新规则
alertRoutes.put('/rules/:id', async (c) => {
  const id = c.req.param('id')
  const body = await c.req.json()
  const existing = await c.env.DB.prepare('SELECT * FROM alert_rules WHERE id = ?').bind(id).first() as Record<string, unknown> | null
  if (!existing) return c.json(notFound('Alert rule not found'), 404)

  const validationError = validateRule({ ...existing, ...body })
  if (validationError) return c.json(badRequest(validationError), 400)

  const fields: string[] = []
  const values: unknown[] = []
  for (const [key, value] of Object.entries(body)) {
    if (['name', 'metric', 'operator', 'threshold', 'duration_seconds', 'scope', 'suppress_minutes', 'notify_on_recovery', 'enabled'].includes(key)) {
      fields.push(`${key} = ?`)
      values.push(value)
    }
  }
  if (fields.length > 0) {
    fields.push("updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')")
    values.push(id)
    await c.env.DB.prepare(`UPDATE alert_rules SET ${fields.join(', ')} WHERE id = ?`).bind(...values).run()
  }
  if (Array.isArray(body.node_ids)) {
    await c.env.DB.prepare('DELETE FROM alert_rule_nodes WHERE rule_id = ?').bind(id).run()
    if (body.node_ids.length > 0) {
      await c.env.DB.batch(body.node_ids.map((nodeId: string) =>
        c.env.DB.prepare('INSERT INTO alert_rule_nodes (rule_id, node_id) VALUES (?, ?)').bind(id, nodeId)
      ))
    }
  }

  const rule = await c.env.DB.prepare('SELECT * FROM alert_rules WHERE id = ?').bind(id).first()

  await writeAuditLog(c.env, {
    user_id: c.get('userId' as never) as string | undefined,
    action: 'update',
    object_type: 'alert_rule',
    object_id: id,
    changes: body,
    ip_address: c.req.header('CF-Connecting-IP'),
  })

  return c.json(success(rule))
})

// DELETE /api/v1/alerts/rules/:id — 删除规则
alertRoutes.delete('/rules/:id', async (c) => {
  const id = c.req.param('id')
  await c.env.DB.prepare('DELETE FROM alert_rules WHERE id = ?').bind(id).run()

  await writeAuditLog(c.env, {
    user_id: c.get('userId' as never) as string | undefined,
    action: 'delete',
    object_type: 'alert_rule',
    object_id: id,
    ip_address: c.req.header('CF-Connecting-IP'),
  })

  return c.json(success(null))
})

// GET /api/v1/alerts/channels — 通知渠道列表
alertRoutes.get('/channels', async (c) => {
  const channels = await c.env.DB.prepare('SELECT id, name, channel_type, enabled, created_at, updated_at FROM alert_channels ORDER BY created_at DESC').all()
  return c.json(success(channels.results || []))
})

// POST /api/v1/alerts/channels — 创建通知渠道
alertRoutes.post('/channels', async (c) => {
  const body = await c.req.json()
  const { name, channel_type, config, enabled } = body

  if (typeof name !== 'string' || !name.trim() || name.length > 100) return c.json(badRequest('Invalid channel name'), 400)
  const validationError = validateChannel(channel_type, config)
  if (validationError) return c.json(badRequest(validationError), 400)

  const id = crypto.randomUUID()
  const encryptedConfig = await encryptConfig(config || {}, c.env.ENCRYPTION_KEY)
  await c.env.DB.prepare(
    'INSERT INTO alert_channels (id, name, channel_type, config, enabled) VALUES (?, ?, ?, ?, ?)'
  ).bind(id, name.trim(), channel_type, encryptedConfig, enabled === false ? 0 : 1).run()

  // 新渠道默认接收所有已启用规则，避免逐条关联。
  const enabledRules = await c.env.DB.prepare('SELECT id FROM alert_rules WHERE enabled = 1').all()
  if (enabledRules.results?.length) {
    await c.env.DB.batch(enabledRules.results.map(rule =>
      c.env.DB.prepare('INSERT OR IGNORE INTO alert_rule_channels (rule_id, channel_id) VALUES (?, ?)').bind((rule as { id: string }).id, id)
    ))
  }

  await writeAuditLog(c.env, {
    user_id: c.get('userId' as never) as string | undefined,
    action: 'create',
    object_type: 'alert_channel',
    object_id: id,
    changes: body,
    ip_address: c.req.header('CF-Connecting-IP'),
  })

  return c.json(success({ id, name: name.trim(), channel_type, enabled: enabled !== false }), 201)
})

// PUT /api/v1/alerts/channels/:id — 更新通知渠道
alertRoutes.put('/channels/:id', async (c) => {
  const id = c.req.param('id')
  const body = await c.req.json()

  const existing = await c.env.DB.prepare('SELECT id, channel_type, config FROM alert_channels WHERE id = ?').bind(id).first() as { id: string; channel_type: string; config: string } | null
  if (!existing) return c.json(notFound('Alert channel not found'), 404)

  const fields: string[] = []
  const values: unknown[] = []

  if (body.name !== undefined) {
    fields.push('name = ?')
    values.push(body.name)
  }
  if (body.channel_type !== undefined) {
    fields.push('channel_type = ?')
    values.push(body.channel_type)
  }
  if (body.config !== undefined) {
    const currentConfig = await decryptConfig(existing.config || '{}', c.env.ENCRYPTION_KEY)
    const mergedConfig = { ...currentConfig, ...body.config }
    const validationError = validateChannel(body.channel_type ?? existing.channel_type, mergedConfig)
    if (validationError) return c.json(badRequest(validationError), 400)
    fields.push('config = ?')
    values.push(await encryptConfig(mergedConfig, c.env.ENCRYPTION_KEY))
  }
  if (body.enabled !== undefined) {
    fields.push('enabled = ?')
    values.push(body.enabled ? 1 : 0)
  }

  if (fields.length > 0) {
    fields.push("updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')")
    values.push(id)
    await c.env.DB.prepare(`UPDATE alert_channels SET ${fields.join(', ')} WHERE id = ?`).bind(...values).run()
  }

  const channel = await c.env.DB.prepare(
    'SELECT id, name, channel_type, enabled, created_at, updated_at FROM alert_channels WHERE id = ?'
  ).bind(id).first()

  await writeAuditLog(c.env, {
    user_id: c.get('userId' as never) as string | undefined,
    action: 'update',
    object_type: 'alert_channel',
    object_id: id,
    changes: body,
    ip_address: c.req.header('CF-Connecting-IP'),
  })

  return c.json(success(channel))
})

// DELETE /api/v1/alerts/channels/:id — 删除通知渠道
alertRoutes.delete('/channels/:id', async (c) => {
  const id = c.req.param('id')
  // 先删除关联的规则
  await c.env.DB.prepare('DELETE FROM alert_rule_channels WHERE channel_id = ?').bind(id).run()
  await c.env.DB.prepare('DELETE FROM alert_channels WHERE id = ?').bind(id).run()

  await writeAuditLog(c.env, {
    user_id: c.get('userId' as never) as string | undefined,
    action: 'delete',
    object_type: 'alert_channel',
    object_id: id,
    ip_address: c.req.header('CF-Connecting-IP'),
  })

  return c.json(success(null))
})

// GET /api/v1/alerts/events — 告警事件列表
alertRoutes.get('/events', async (c) => {
  const page = Number(c.req.query('page') || '1')
  const pageSize = Number(c.req.query('page_size') || '20')
  const offset = (page - 1) * pageSize

  const countResult = await c.env.DB.prepare('SELECT COUNT(*) as total FROM alert_events').first() as { total: number }
  const events = await c.env.DB.prepare(
    'SELECT * FROM alert_events ORDER BY fired_at DESC LIMIT ? OFFSET ?'
  ).bind(pageSize, offset).all()

  return c.json(paginated(events.results || [], {
    page, page_size: pageSize, total: countResult.total, total_pages: Math.ceil(countResult.total / pageSize),
  }))
})
