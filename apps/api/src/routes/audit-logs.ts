// Braum 布隆 CF 探针 — 审计日志路由

import { Hono } from 'hono'
import type { Env } from '../env'
import { paginated } from '../utils/response'

export const auditLogRoutes = new Hono<{ Bindings: Env }>()

// GET /api/admin/v1/audit-logs — 审计日志列表（分页 + 筛选）
auditLogRoutes.get('/', async (c) => {
  const page = Number(c.req.query('page') || '1')
  const pageSize = Number(c.req.query('page_size') || '20')
  const offset = (page - 1) * pageSize

  // 筛选条件
  const action = c.req.query('action')
  const objectType = c.req.query('object_type')
  const userId = c.req.query('user_id')
  const startDate = c.req.query('start_date')
  const endDate = c.req.query('end_date')

  const conditions: string[] = []
  const bindings: unknown[] = []

  if (action) {
    conditions.push('action = ?')
    bindings.push(action)
  }
  if (objectType) {
    conditions.push('object_type = ?')
    bindings.push(objectType)
  }
  if (userId) {
    conditions.push('user_id = ?')
    bindings.push(userId)
  }
  if (startDate) {
    conditions.push('created_at >= ?')
    bindings.push(startDate)
  }
  if (endDate) {
    conditions.push('created_at <= ?')
    bindings.push(endDate)
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

  // 查询总数
  const countResult = await c.env.DB.prepare(
    `SELECT COUNT(*) as total FROM audit_logs ${whereClause}`
  ).bind(...bindings).first() as { total: number }

  // 查询分页数据
  const logs = await c.env.DB.prepare(
    `SELECT * FROM audit_logs ${whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?`
  ).bind(...bindings, pageSize, offset).all()

  // 解析 changes JSON 字段
  const results = (logs.results || []).map((row: Record<string, unknown>) => ({
    ...row,
    changes: row.changes ? JSON.parse(row.changes as string) : null,
  }))

  return c.json(paginated(results, {
    page,
    page_size: pageSize,
    total: countResult.total,
    total_pages: Math.ceil(countResult.total / pageSize),
  }))
})

// GET /api/admin/v1/audit-logs/:id — 审计日志详情
auditLogRoutes.get('/:id', async (c) => {
  const id = c.req.param('id')
  const log = await c.env.DB.prepare('SELECT * FROM audit_logs WHERE id = ?').bind(id).first()

  if (!log) {
    return c.json({ code: 404, message: 'Audit log not found', data: null }, 404)
  }

  const result = {
    ...(log as Record<string, unknown>),
    changes: (log as Record<string, unknown>).changes
      ? JSON.parse((log as Record<string, unknown>).changes as string)
      : null,
  }

  return c.json({ code: 200, message: 'success', data: result })
})
