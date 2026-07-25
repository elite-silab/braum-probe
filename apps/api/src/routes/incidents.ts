// Braum 布隆 CF 探针 — 公告路由

import { Hono } from 'hono'
import type { Env } from '../env'
import { success, paginated, notFound, badRequest } from '../utils/response'
import { writeAuditLog } from '../utils/audit'

export const incidentRoutes = new Hono<{ Bindings: Env }>()

const INCIDENT_SEVERITIES = new Set(['critical', 'major', 'minor'])
const INCIDENT_STATUSES = new Set(['investigating', 'identified', 'monitoring', 'resolved', 'scheduled'])

// GET /api/v1/incidents — 公告列表
incidentRoutes.get('/', async (c) => {
  const page = Number(c.req.query('page') || '1')
  const pageSize = Number(c.req.query('page_size') || '20')
  const offset = (page - 1) * pageSize
  const status = c.req.query('status')

  let where = '1=1'
  const params: (string | number)[] = []
  if (status) { where += ' AND status = ?'; params.push(status) }

  const countResult = await c.env.DB.prepare(`SELECT COUNT(*) as total FROM incidents WHERE ${where}`).bind(...params).first() as { total: number }
  const incidents = await c.env.DB.prepare(
    `SELECT * FROM incidents WHERE ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`
  ).bind(...params, pageSize, offset).all()

  return c.json(paginated(incidents.results || [], {
    page, page_size: pageSize, total: countResult.total, total_pages: Math.ceil(countResult.total / pageSize),
  }))
})

// GET /api/v1/incidents/:id — 公告详情
incidentRoutes.get('/:id', async (c) => {
  const id = c.req.param('id')
  const incident = await c.env.DB.prepare('SELECT * FROM incidents WHERE id = ?').bind(id).first()
  if (!incident) return c.json(notFound('Incident not found'), 404)

  const updates = await c.env.DB.prepare(
    'SELECT * FROM incident_updates WHERE incident_id = ? ORDER BY created_at DESC'
  ).bind(id).all()

  return c.json(success({ ...incident, updates: updates.results || [] }))
})

// POST /api/v1/incidents — 创建公告
incidentRoutes.post('/', async (c) => {
  const body = await c.req.json()
  const { title, description, severity, status, affected_node_ids, affected_target_ids } = body

  if (!title || !description || !INCIDENT_SEVERITIES.has(severity)
    || (status !== undefined && !INCIDENT_STATUSES.has(status))) {
    return c.json(badRequest('Missing required fields: title, description, severity'), 400)
  }

  const id = crypto.randomUUID()
  const userId = c.get('userId' as never) as string

  await c.env.DB.prepare(
    'INSERT INTO incidents (id, title, description, severity, status, created_by) VALUES (?, ?, ?, ?, ?, ?)'
  ).bind(id, title, description, severity, status || 'investigating', userId).run()

  // 关联受影响节点和目标
  if (affected_node_ids?.length) {
    const stmts = affected_node_ids.map((nid: string) =>
      c.env.DB.prepare('INSERT INTO incident_nodes (incident_id, node_id) VALUES (?, ?)').bind(id, nid)
    )
    await c.env.DB.batch(stmts)
  }
  if (affected_target_ids?.length) {
    const stmts = affected_target_ids.map((tid: string) =>
      c.env.DB.prepare('INSERT INTO incident_targets (incident_id, target_id) VALUES (?, ?)').bind(id, tid)
    )
    await c.env.DB.batch(stmts)
  }

  const incident = await c.env.DB.prepare('SELECT * FROM incidents WHERE id = ?').bind(id).first()

  await writeAuditLog(c.env, {
    user_id: userId,
    action: 'create',
    object_type: 'incident',
    object_id: id,
    changes: body,
    ip_address: c.req.header('CF-Connecting-IP'),
  })

  return c.json(success(incident), 201)
})

// PUT /api/v1/incidents/:id — 更新公告
incidentRoutes.put('/:id', async (c) => {
  const id = c.req.param('id')
  const body = await c.req.json()
  if (body.severity !== undefined && !INCIDENT_SEVERITIES.has(body.severity)) {
    return c.json(badRequest('Invalid severity'), 400)
  }
  if (body.status !== undefined && !INCIDENT_STATUSES.has(body.status)) {
    return c.json(badRequest('Invalid status'), 400)
  }
  const existing = await c.env.DB.prepare('SELECT id FROM incidents WHERE id = ?').bind(id).first()
  if (!existing) return c.json(notFound('Incident not found'), 404)

  const fields: string[] = []
  const values: unknown[] = []
  for (const [key, value] of Object.entries(body)) {
    if (['title', 'description', 'severity', 'status'].includes(key)) {
      fields.push(`${key} = ?`)
      values.push(value)
    }
  }
  if (body.status === 'resolved') {
    fields.push("resolved_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')")
  }
  if (fields.length > 0) {
    fields.push("updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')")
    values.push(id)
    await c.env.DB.prepare(`UPDATE incidents SET ${fields.join(', ')} WHERE id = ?`).bind(...values).run()
  }

  const incident = await c.env.DB.prepare('SELECT * FROM incidents WHERE id = ?').bind(id).first()

  await writeAuditLog(c.env, {
    user_id: c.get('userId' as never) as string | undefined,
    action: 'update',
    object_type: 'incident',
    object_id: id,
    changes: body,
    ip_address: c.req.header('CF-Connecting-IP'),
  })

  return c.json(success(incident))
})

// POST /api/v1/incidents/:id/updates — 追加时间线更新
incidentRoutes.post('/:id/updates', async (c) => {
  const incidentId = c.req.param('id')
  const body = await c.req.json()
  const { status, message } = body

  if (!message) return c.json(badRequest('Missing required field: message'), 400)
  if (status !== undefined && !INCIDENT_STATUSES.has(status)) {
    return c.json(badRequest('Invalid status'), 400)
  }

  const existing = await c.env.DB.prepare('SELECT id FROM incidents WHERE id = ?').bind(incidentId).first()
  if (!existing) return c.json(notFound('Incident not found'), 404)

  const updateId = crypto.randomUUID()
  const userId = c.get('userId' as never) as string

  await c.env.DB.prepare(
    'INSERT INTO incident_updates (id, incident_id, status, message, created_by) VALUES (?, ?, ?, ?, ?)'
  ).bind(updateId, incidentId, status || null, message, userId).run()

  // 如果状态变更，同步更新 incident 状态
  if (status) {
    await c.env.DB.prepare("UPDATE incidents SET status = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?").bind(status, incidentId).run()
  }

  return c.json(success({ id: updateId, incident_id: incidentId, status, message }), 201)
})

// DELETE /api/v1/incidents/:id — 删除公告
incidentRoutes.delete('/:id', async (c) => {
  const id = c.req.param('id')
  const existing = await c.env.DB.prepare('SELECT id FROM incidents WHERE id = ?').bind(id).first()
  if (!existing) return c.json(notFound('Incident not found'), 404)

  await c.env.DB.prepare('DELETE FROM incidents WHERE id = ?').bind(id).run()
  await writeAuditLog(c.env, {
    user_id: c.get('userId' as never) as string | undefined,
    action: 'delete',
    object_type: 'incident',
    object_id: id,
    ip_address: c.req.header('CF-Connecting-IP'),
  })

  return c.json(success(null))
})
