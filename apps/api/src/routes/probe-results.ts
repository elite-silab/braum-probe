// Braum 布隆 CF 探针 — 探测结果路由

import { Hono } from 'hono'
import type { Env } from '../env'
import { success, paginated } from '../utils/response'

export const probeResultRoutes = new Hono<{ Bindings: Env }>()

// GET /api/v1/probe-results — 探测结果列表
probeResultRoutes.get('/', async (c) => {
  const page = Number(c.req.query('page') || '1')
  const pageSize = Math.min(Number(c.req.query('page_size') || '50'), 200)
  const offset = (page - 1) * pageSize
  const nodeId = c.req.query('node_id')
  const targetId = c.req.query('target_id')
  const startTime = c.req.query('start_time')
  const endTime = c.req.query('end_time')

  let where = '1=1'
  const params: (string | number)[] = []

  if (nodeId) { where += ' AND node_id = ?'; params.push(nodeId) }
  if (targetId) { where += ' AND target_id = ?'; params.push(targetId) }
  if (startTime) { where += ' AND probe_at >= ?'; params.push(startTime) }
  if (endTime) { where += ' AND probe_at <= ?'; params.push(endTime) }

  const countResult = await c.env.DB.prepare(
    `SELECT COUNT(*) as total FROM probe_results WHERE ${where}`
  ).bind(...params).first() as { total: number }

  const results = await c.env.DB.prepare(
    `SELECT pr.*, n.name AS node_name, t.name AS target_name
     FROM probe_results pr
     LEFT JOIN nodes n ON n.id = pr.node_id
     LEFT JOIN targets t ON t.id = pr.target_id
     WHERE ${where.replaceAll('node_id', 'pr.node_id').replaceAll('target_id', 'pr.target_id').replaceAll('probe_at', 'pr.probe_at')}
     ORDER BY pr.probe_at DESC LIMIT ? OFFSET ?`
  ).bind(...params, pageSize, offset).all()

  return c.json(paginated(results.results || [], {
    page, page_size: pageSize, total: countResult.total, total_pages: Math.ceil(countResult.total / pageSize),
  }))
})

// GET /api/v1/probe-results/stats — 聚合统计查询
probeResultRoutes.get('/stats', async (c) => {
  const nodeId = c.req.query('node_id')
  const targetId = c.req.query('target_id')
  const period = c.req.query('period') || 'hourly'
  const startTime = c.req.query('start_time')
  const endTime = c.req.query('end_time')

  let where = 'period = ?'
  const params: (string | number)[] = [period]

  if (nodeId) { where += ' AND node_id = ?'; params.push(nodeId) }
  if (targetId) { where += ' AND target_id = ?'; params.push(targetId) }
  if (startTime) { where += ' AND period_start >= ?'; params.push(startTime) }
  if (endTime) { where += ' AND period_start <= ?'; params.push(endTime) }

  const stats = await c.env.DB.prepare(
    `SELECT * FROM probe_stats WHERE ${where} ORDER BY period_start ASC LIMIT 500`
  ).bind(...params).all()

  return c.json(success(stats.results || []))
})

// GET /api/v1/probe-results/latest/:nodeId/:targetId — 最新探测结果（KV 缓存）
probeResultRoutes.get('/latest/:nodeId/:targetId', async (c) => {
  const { nodeId, targetId } = c.req.param()
  const cached = await c.env.CACHE.get(`latest:${nodeId}:${targetId}`, 'json')

  if (cached) {
    return c.json(success(cached))
  }

  // Fallback to D1
  const result = await c.env.DB.prepare(
    'SELECT * FROM probe_results WHERE node_id = ? AND target_id = ? ORDER BY probe_at DESC LIMIT 1'
  ).bind(nodeId, targetId).first()

  return c.json(success(result))
})
