// Braum 布隆 CF 探针 — 监控目标路由

import { Hono } from 'hono'
import type { Env } from '../env'
import { success, paginated, notFound, badRequest } from '../utils/response'
import { writeAuditLog } from '../utils/audit'
import { parsePublicHttpUrl } from '../utils/outbound'
import { notifyRealtime } from '../realtime/client'

export const targetRoutes = new Hono<{ Bindings: Env }>()

function normalizeNewTarget(input: Record<string, unknown>): Record<string, unknown> {
  const address = typeof input.address === 'string' ? input.address.trim() : input.address
  const targetType = input.target_type ?? (
    typeof address === 'string' && /^https?:\/\//i.test(address) ? 'http' : 'dns'
  )
  let inferredName = address
  if (targetType === 'http' && typeof address === 'string') {
    inferredName = parsePublicHttpUrl(address)?.hostname || address
  }
  return {
    ...input,
    address,
    target_type: targetType,
    name: typeof input.name === 'string' && input.name.trim() ? input.name.trim() : inferredName,
    expected_status: input.expected_status ?? 200,
    timeout_ms: input.timeout_ms ?? 5000,
  }
}

function validateTarget(input: Record<string, unknown>): string | null {
  if (!['http', 'dns'].includes(String(input.target_type))) return 'Invalid target_type'
  if (typeof input.name !== 'string' || !input.name.trim() || input.name.length > 100) return 'Invalid name'
  if (typeof input.address !== 'string' || !input.address.trim() || input.address.length > 2048) return 'Invalid address'
  if (input.target_type === 'http' && !parsePublicHttpUrl(input.address)) return 'Unsafe or invalid HTTP address'
  if (input.target_type === 'dns' && !/^[a-zA-Z0-9.-]{1,253}$/.test(input.address)) return 'Invalid DNS name'

  const timeout = Number(input.timeout_ms ?? 5000)
  const expectedStatus = Number(input.expected_status ?? 200)
  const port = input.port == null ? null : Number(input.port)
  if (!Number.isInteger(timeout) || timeout < 100 || timeout > 30_000) return 'Invalid timeout_ms'
  if (!Number.isInteger(expectedStatus) || expectedStatus < 100 || expectedStatus > 599) return 'Invalid expected_status'
  if (port !== null && (!Number.isInteger(port) || port < 1 || port > 65535)) return 'Invalid port'
  if (input.status !== undefined && !['active', 'paused'].includes(String(input.status))) return 'Invalid status'
  return null
}

async function notifyAssignedAgents(env: Env, targetId: string, reason: string): Promise<void> {
  const assignments = await env.DB.prepare(
    'SELECT node_id FROM node_targets WHERE target_id = ?',
  ).bind(targetId).all()
  await Promise.all((assignments.results || []).map(row => notifyRealtime(env, {
    type: 'config_changed',
    node_id: String((row as { node_id: string }).node_id),
    reason,
  })))
}

// GET /api/v1/targets — 目标列表
targetRoutes.get('/', async (c) => {
  const page = Number(c.req.query('page') || '1')
  const pageSize = Number(c.req.query('page_size') || '20')
  const offset = (page - 1) * pageSize

  const countResult = await c.env.DB.prepare('SELECT COUNT(*) as total FROM targets').first() as { total: number }
  const targets = await c.env.DB.prepare(
    'SELECT * FROM targets ORDER BY created_at DESC LIMIT ? OFFSET ?'
  ).bind(pageSize, offset).all()

  return c.json(paginated(targets.results || [], {
    page, page_size: pageSize, total: countResult.total, total_pages: Math.ceil(countResult.total / pageSize),
  }))
})

// GET /api/v1/targets/:id — 目标详情
targetRoutes.get('/:id', async (c) => {
  const target = await c.env.DB.prepare('SELECT * FROM targets WHERE id = ?').bind(c.req.param('id')).first()
  if (!target) return c.json(notFound('Target not found'), 404)
  return c.json(success(target))
})

// POST /api/v1/targets — 创建目标
targetRoutes.post('/', async (c) => {
  const requestBody = await c.req.json<Record<string, unknown>>().catch(() => null)
  if (!requestBody) return c.json(badRequest('Invalid request body'), 400)
  const body = normalizeNewTarget(requestBody)
  const { name, address, target_type, port, expected_status, timeout_ms } = body

  const validationError = validateTarget(body)
  if (validationError) return c.json(badRequest(validationError), 400)

  const id = crypto.randomUUID()
  await c.env.DB.prepare(
    `INSERT INTO targets (id, name, address, target_type, port, expected_status, timeout_ms)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).bind(id, String(name).trim(), address, target_type, port ?? null, expected_status ?? 200, timeout_ms ?? 5000).run()

  const target = await c.env.DB.prepare('SELECT * FROM targets WHERE id = ?').bind(id).first()

  await writeAuditLog(c.env, {
    user_id: c.get('userId' as never) as string | undefined,
    action: 'create',
    object_type: 'target',
    object_id: id,
    changes: requestBody,
    ip_address: c.req.header('CF-Connecting-IP'),
  })

  return c.json(success(target), 201)
})

// PUT /api/v1/targets/:id — 更新目标
targetRoutes.put('/:id', async (c) => {
  const id = c.req.param('id')
  const body = await c.req.json()
  const existing = await c.env.DB.prepare('SELECT * FROM targets WHERE id = ?').bind(id).first() as Record<string, unknown> | null
  if (!existing) return c.json(notFound('Target not found'), 404)

  const candidate = { ...existing, ...body }
  const validationError = validateTarget(candidate)
  if (validationError) return c.json(badRequest(validationError), 400)

  const fields: string[] = []
  const values: unknown[] = []
  for (const [key, value] of Object.entries(body)) {
    if (['name', 'address', 'target_type', 'port', 'expected_status', 'timeout_ms', 'status'].includes(key)) {
      fields.push(`${key} = ?`)
      values.push(value)
    }
  }
  if (fields.length > 0) {
    fields.push("updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')")
    values.push(id)
    await c.env.DB.prepare(`UPDATE targets SET ${fields.join(', ')} WHERE id = ?`).bind(...values).run()
  }

  const target = await c.env.DB.prepare('SELECT * FROM targets WHERE id = ?').bind(id).first()

  await writeAuditLog(c.env, {
    user_id: c.get('userId' as never) as string | undefined,
    action: 'update',
    object_type: 'target',
    object_id: id,
    changes: body,
    ip_address: c.req.header('CF-Connecting-IP'),
  })

  await notifyAssignedAgents(c.env, id, 'target_updated')

  return c.json(success(target))
})

// DELETE /api/v1/targets/:id — 删除目标
targetRoutes.delete('/:id', async (c) => {
  const id = c.req.param('id')
  const existing = await c.env.DB.prepare('SELECT id FROM targets WHERE id = ?').bind(id).first()
  if (!existing) return c.json(notFound('Target not found'), 404)
  const assignments = await c.env.DB.prepare(
    'SELECT node_id FROM node_targets WHERE target_id = ?',
  ).bind(id).all()
  await c.env.DB.batch([
    c.env.DB.prepare('DELETE FROM probe_results WHERE target_id = ?').bind(id),
    c.env.DB.prepare('DELETE FROM probe_stats WHERE target_id = ?').bind(id),
    c.env.DB.prepare('DELETE FROM targets WHERE id = ?').bind(id),
  ])

  await writeAuditLog(c.env, {
    user_id: c.get('userId' as never) as string | undefined,
    action: 'delete',
    object_type: 'target',
    object_id: id,
    ip_address: c.req.header('CF-Connecting-IP'),
  })

  await Promise.all((assignments.results || []).map(row => notifyRealtime(c.env, {
    type: 'config_changed',
    node_id: String((row as { node_id: string }).node_id),
    reason: 'target_deleted',
  })))

  return c.json(success(null))
})
