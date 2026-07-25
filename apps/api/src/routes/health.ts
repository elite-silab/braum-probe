// Braum 布隆 CF 探针 — 健康检查路由

import { Hono } from 'hono'
import type { Env } from '../env'

export const healthRoutes = new Hono<{ Bindings: Env }>()

// GET /health — 基础存活检查
healthRoutes.get('/', async (c) => {
  return c.json({
    status: 'ok',
    version: c.env.APP_VERSION,
    timestamp: new Date().toISOString(),
  })
})

// GET /health/detailed — 详细依赖检查
healthRoutes.get('/detailed', async (c) => {
  const checks: Record<string, string> = {}

  // 检查 D1 连接
  try {
    await c.env.DB.prepare('SELECT 1').first()
    checks.d1 = 'ok'
  } catch {
    checks.d1 = 'error'
  }

  // 检查 KV 连接
  try {
    await c.env.CACHE.get('health_check')
    checks.kv = 'ok'
  } catch {
    checks.kv = 'error'
  }

  // 统计节点状态
  let nodesOnline = 0
  let nodesTotal = 0
  try {
    const result = await c.env.DB.prepare(
      `SELECT
        COUNT(*) as total,
        SUM(CASE WHEN n.status = 'active' AND ac.node_id IS NOT NULL THEN 1 ELSE 0 END) as online
       FROM nodes n
       LEFT JOIN agent_credentials ac ON ac.node_id = n.id`
    ).first() as { total: number; online: number } | null
    nodesTotal = result?.total ?? 0
    nodesOnline = result?.online ?? 0
  } catch {
    // ignore
  }

  const allOk = Object.values(checks).every(v => v === 'ok')

  return c.json({
    status: allOk ? 'ok' : 'degraded',
    version: c.env.APP_VERSION,
    timestamp: new Date().toISOString(),
    ...checks,
    nodes_online: nodesOnline,
    nodes_total: nodesTotal,
  })
})
