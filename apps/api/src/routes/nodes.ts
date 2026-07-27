// Braum 布隆 CF 探针 — 节点管理路由

import { Hono } from 'hono'
import { calculateNetworkRateSeries } from '@braum/shared'
import type { Env } from '../env'
import { success, paginated, notFound, badRequest } from '../utils/response'
import { writeAuditLog } from '../utils/audit'
import { notifyRealtime } from '../realtime/client'

export const nodeRoutes = new Hono<{ Bindings: Env }>()

const NODE_REGIONS = new Set(['asia', 'europe', 'north_america', 'south_america', 'oceania', 'africa'])
const NODE_STATUSES = new Set(['active', 'paused', 'offline'])

function normalizeNewNode(input: Record<string, unknown>): Record<string, unknown> {
  return {
    ...input,
    id: input.id === undefined ? `node-${crypto.randomUUID().slice(0, 12)}` : input.id,
    region: input.region ?? 'asia',
    country: input.country ?? '待识别',
    city: input.city ?? '待识别',
    latitude: input.latitude ?? 0,
    longitude: input.longitude ?? 0,
    probe_type: input.probe_type ?? 'http',
    probe_interval: input.probe_interval ?? 60,
    target_ids: input.target_ids ?? [],
  }
}

function validateNode(input: Record<string, unknown>, creating: boolean): string | null {
  if (creating && (typeof input.id !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,63}$/.test(input.id))) return 'Invalid node id'
  if (typeof input.name !== 'string' || !input.name.trim() || input.name.length > 100) return 'Invalid name'
  if (!NODE_REGIONS.has(String(input.region))) return 'Invalid region'
  if (typeof input.country !== 'string' || !input.country.trim() || input.country.length > 100) return 'Invalid country'
  if (typeof input.city !== 'string' || !input.city.trim() || input.city.length > 100) return 'Invalid city'
  if (!Number.isFinite(input.latitude) || Number(input.latitude) < -90 || Number(input.latitude) > 90) return 'Invalid latitude'
  if (!Number.isFinite(input.longitude) || Number(input.longitude) < -180 || Number(input.longitude) > 180) return 'Invalid longitude'
  if (!['http', 'dns'].includes(String(input.probe_type))) return 'Invalid probe_type'
  const interval = Number(input.probe_interval ?? 60)
  if (!Number.isInteger(interval) || interval < 60 || interval > 3600) return 'Invalid probe_interval'
  if (input.status !== undefined && !NODE_STATUSES.has(String(input.status))) return 'Invalid status'
  if (input.target_ids !== undefined && (!Array.isArray(input.target_ids) || input.target_ids.length > 100 || input.target_ids.some(id => typeof id !== 'string'))) return 'Invalid target_ids'
  return null
}

// GET /api/v1/nodes — 节点列表（含聚合统计）
nodeRoutes.get('/', async (c) => {
  const page = Number(c.req.query('page') || '1')
  const pageSize = Number(c.req.query('page_size') || '20')
  const offset = (page - 1) * pageSize
  const status = c.req.query('status')
  const region = c.req.query('region')
  const enrich = c.req.query('enrich') !== 'false' // 默认开启聚合

  let where = '1=1'
  const params: (string | number)[] = []

  if (status) {
    where += ' AND status = ?'
    params.push(status)
  }
  if (region) {
    where += ' AND region = ?'
    params.push(region)
  }

  const countResult = await c.env.DB.prepare(
    `SELECT COUNT(*) as total FROM nodes WHERE ${where}`
  ).bind(...params).first() as { total: number }

  const rawNodes = await c.env.DB.prepare(
    `SELECT * FROM nodes WHERE ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`
  ).bind(...params, pageSize, offset).all()

  const nodeList = (rawNodes.results || []) as Record<string, unknown>[]

  if (!enrich || nodeList.length === 0) {
    return c.json(paginated(nodeList, {
      page, page_size: pageSize, total: countResult.total,
      total_pages: Math.ceil(countResult.total / pageSize),
    }))
  }

  // ── 聚合：每个节点 24h 内的 avg_latency / uptime / total_probes ──
  const nodeIds = nodeList.map(n => n.id as string)
  const placeholders = nodeIds.map(() => '?').join(',')

  // Agent 注册状态与最新一条真实 VPS 资源指标。
  const agentRows = await c.env.DB.prepare(`
    SELECT n.id AS node_id,
           CASE WHEN ac.node_id IS NULL THEN 'pending' ELSE 'registered' END AS registration_status,
           ai.os, ai.platform, ai.arch, ai.agent_version,
           m.cpu_usage, m.memory_used_bytes, m.memory_total_bytes,
           m.swap_used_bytes, m.swap_total_bytes,
           m.disk_used_bytes, m.disk_total_bytes,
           m.load_1, m.load_5, m.load_15,
           m.network_rx_bytes, m.network_tx_bytes,
           m.tcp_connections, m.process_count, m.uptime_seconds,
           m.collected_at,
           pm.network_rx_bytes AS previous_network_rx_bytes,
           pm.network_tx_bytes AS previous_network_tx_bytes,
           pm.collected_at AS previous_collected_at
    FROM nodes n
    LEFT JOIN agent_credentials ac ON ac.node_id = n.id
    LEFT JOIN node_agent_info ai ON ai.node_id = n.id
    LEFT JOIN node_metrics m ON m.id = (
      SELECT id FROM node_metrics
      WHERE node_id = n.id
      ORDER BY collected_at DESC LIMIT 1
    )
    LEFT JOIN node_metrics pm ON pm.id = (
      SELECT id FROM node_metrics
      WHERE node_id = n.id AND collected_at < m.collected_at
      ORDER BY collected_at DESC LIMIT 1
    )
    WHERE n.id IN (${placeholders})
  `).bind(...nodeIds).all()
  const agentMap = new Map<string, Record<string, unknown>>()
  for (const row of (agentRows.results || []) as Record<string, unknown>[]) {
    agentMap.set(String(row.node_id), row)
  }

  const statsRows = await c.env.DB.prepare(
    `SELECT node_id,
            ROUND(AVG(latency_ms), 1) as avg_latency,
            ROUND(AVG(success) * 100, 2) as uptime,
            COUNT(*) as total_probes
     FROM probe_results
     WHERE node_id IN (${placeholders})
       AND julianday(probe_at) >= julianday('now', '-24 hours')
     GROUP BY node_id`
  ).bind(...nodeIds).all()

  const statsMap = new Map<string, { avg_latency: number; uptime: number; total_probes: number }>()
  for (const row of (statsRows.results || []) as any[]) {
    statsMap.set(row.node_id, {
      avg_latency: row.avg_latency || 0,
      uptime: row.uptime || 0,
      total_probes: row.total_probes || 0,
    })
  }

  // ── 聚合：sparkline（24 个小时段，每段 1h） ──
  const sparkRows = await c.env.DB.prepare(
    `SELECT node_id,
            CAST((julianday('now') - julianday(probe_at)) * 24 AS INTEGER) as bucket,
            ROUND(AVG(latency_ms), 0) as avg_ms
     FROM probe_results
     WHERE node_id IN (${placeholders})
       AND julianday(probe_at) >= julianday('now', '-24 hours')
     GROUP BY node_id, bucket
     ORDER BY node_id, bucket ASC`
  ).bind(...nodeIds).all()

  const sparkMap = new Map<string, number[]>()
  for (const row of (sparkRows.results || []) as any[]) {
    const nid = row.node_id as string
    if (!sparkMap.has(nid)) sparkMap.set(nid, new Array(24).fill(0))
    const arr = sparkMap.get(nid)!
    const idx = Math.min(23, Math.max(0, 23 - (row.bucket as number)))
    arr[idx] = row.avg_ms || 0
  }

  // ── 合并：将聚合数据附加到每个节点 ──
  const enriched = nodeList.map(n => {
    const id = n.id as string
    const s = statsMap.get(id)
    const agent = agentMap.get(id)
    const hasMetrics = agent?.collected_at != null
    const networkRates = hasMetrics && agent?.previous_collected_at
      ? calculateNetworkRateSeries([
          {
            network_rx_bytes: Number(agent.previous_network_rx_bytes),
            network_tx_bytes: Number(agent.previous_network_tx_bytes),
            collected_at: String(agent.previous_collected_at),
          },
          {
            network_rx_bytes: Number(agent.network_rx_bytes),
            network_tx_bytes: Number(agent.network_tx_bytes),
            collected_at: String(agent.collected_at),
          },
        ]).at(-1)
      : null
    return {
      ...n,
      registration_status: agent?.registration_status || 'pending',
      agent_os: agent?.os || null,
      agent_platform: agent?.platform || null,
      agent_arch: agent?.arch || null,
      agent_version: agent?.agent_version || null,
      latest_metrics: hasMetrics ? {
        cpu_usage: agent?.cpu_usage,
        memory_used_bytes: agent?.memory_used_bytes,
        memory_total_bytes: agent?.memory_total_bytes,
        swap_used_bytes: agent?.swap_used_bytes,
        swap_total_bytes: agent?.swap_total_bytes,
        disk_used_bytes: agent?.disk_used_bytes,
        disk_total_bytes: agent?.disk_total_bytes,
        load_1: agent?.load_1,
        load_5: agent?.load_5,
        load_15: agent?.load_15,
        network_rx_bytes: agent?.network_rx_bytes,
        network_tx_bytes: agent?.network_tx_bytes,
        network_rx_bytes_per_second: networkRates?.rx_bytes_per_second ?? null,
        network_tx_bytes_per_second: networkRates?.tx_bytes_per_second ?? null,
        tcp_connections: agent?.tcp_connections,
        process_count: agent?.process_count,
        uptime_seconds: agent?.uptime_seconds,
        collected_at: agent?.collected_at,
      } : null,
      avg_latency: s?.avg_latency ?? null,
      uptime: s?.uptime ?? null,
      total_probes: s?.total_probes ?? 0,
      sparkline: sparkMap.get(id) || [],
    }
  })

  // ── 全局汇总 ──
  let totalProbes = 0
  let latencySum = 0
  let uptimeSum = 0
  let counted = 0
  for (const e of enriched) {
    totalProbes += e.total_probes
    if (e.avg_latency !== null) { latencySum += e.avg_latency; counted++ }
    if (e.uptime !== null) uptimeSum += e.uptime
  }

  const targetCount = await c.env.DB.prepare(
    "SELECT COUNT(*) AS total FROM targets WHERE status = 'active'"
  ).first() as { total: number } | null

  const globalStats = {
    total_nodes: nodeList.length,
    online_nodes: nodeList.filter(n => n.status === 'active' && agentMap.get(String(n.id))?.registration_status === 'registered').length,
    total_targets: targetCount?.total || 0,
    avg_latency: counted > 0 ? Math.round(latencySum / counted) : 0,
    uptime: counted > 0 ? +(uptimeSum / counted).toFixed(2) : 0,
    total_probes: totalProbes,
  }

  return c.json({
    code: 0,
    message: 'ok',
    data: enriched,
    meta: {
      page, page_size: pageSize, total: countResult.total,
      total_pages: Math.ceil(countResult.total / pageSize),
    },
    global_stats: globalStats,
  })
})

// GET /api/v1/nodes/:id — 节点详情
nodeRoutes.get('/:id', async (c) => {
  const id = c.req.param('id')
  const node = await c.env.DB.prepare('SELECT * FROM nodes WHERE id = ?').bind(id).first()

  if (!node) {
    return c.json(notFound('Node not found'), 404)
  }

  // 获取关联目标
  const targets = await c.env.DB.prepare(
    `SELECT t.* FROM targets t
     INNER JOIN node_targets nt ON nt.target_id = t.id
     WHERE nt.node_id = ?`
  ).bind(id).all()

  const agentInfo = await c.env.DB.prepare(`
    SELECT ai.hostname, ai.os, ai.platform, ai.kernel_version, ai.arch,
           ai.cpu_model, ai.cpu_cores, ai.virtualization, ai.agent_version,
           CASE WHEN ac.node_id IS NULL THEN 'pending' ELSE 'registered' END AS registration_status,
           m.cpu_usage, m.memory_used_bytes, m.memory_total_bytes,
           m.swap_used_bytes, m.swap_total_bytes, m.disk_used_bytes, m.disk_total_bytes,
           m.load_1, m.load_5, m.load_15, m.network_rx_bytes, m.network_tx_bytes,
           m.tcp_connections, m.process_count, m.uptime_seconds, m.collected_at
    FROM nodes n
    LEFT JOIN agent_credentials ac ON ac.node_id = n.id
    LEFT JOIN node_agent_info ai ON ai.node_id = n.id
    LEFT JOIN node_metrics m ON m.id = (
      SELECT id FROM node_metrics WHERE node_id = n.id ORDER BY collected_at DESC LIMIT 1
    )
    WHERE n.id = ?
  `).bind(id).first() as Record<string, unknown> | null

  const metricHistory = await c.env.DB.prepare(`
    SELECT cpu_usage, memory_used_bytes, memory_total_bytes,
           disk_used_bytes, disk_total_bytes, load_1,
           network_rx_bytes, network_tx_bytes, collected_at
    FROM node_metrics
    WHERE node_id = ? AND julianday(collected_at) >= julianday('now', '-24 hours')
    ORDER BY collected_at ASC
    LIMIT 500
  `).bind(id).all()

  const availability = await c.env.DB.prepare(`
    SELECT
      SUM(CASE WHEN julianday(probe_at) >= julianday('now', '-24 hours') THEN 1 ELSE 0 END) AS total_24h,
      SUM(CASE WHEN julianday(probe_at) >= julianday('now', '-24 hours') AND success = 1 THEN 1 ELSE 0 END) AS success_24h,
      SUM(CASE WHEN julianday(probe_at) >= julianday('now', '-7 days') THEN 1 ELSE 0 END) AS total_7d,
      SUM(CASE WHEN julianday(probe_at) >= julianday('now', '-7 days') AND success = 1 THEN 1 ELSE 0 END) AS success_7d,
      SUM(CASE WHEN julianday(probe_at) >= julianday('now', '-30 days') THEN 1 ELSE 0 END) AS total_30d,
      SUM(CASE WHEN julianday(probe_at) >= julianday('now', '-30 days') AND success = 1 THEN 1 ELSE 0 END) AS success_30d
    FROM probe_results WHERE node_id = ?
  `).bind(id).first() as Record<string, number | null> | null
  const availabilityValue = (success: number | null | undefined, total: number | null | undefined) =>
    total && total > 0 ? Number((((success || 0) / total) * 100).toFixed(2)) : null

  const latestMetrics = agentInfo?.collected_at ? {
    cpu_usage: agentInfo.cpu_usage,
    memory_used_bytes: agentInfo.memory_used_bytes,
    memory_total_bytes: agentInfo.memory_total_bytes,
    swap_used_bytes: agentInfo.swap_used_bytes,
    swap_total_bytes: agentInfo.swap_total_bytes,
    disk_used_bytes: agentInfo.disk_used_bytes,
    disk_total_bytes: agentInfo.disk_total_bytes,
    load_1: agentInfo.load_1,
    load_5: agentInfo.load_5,
    load_15: agentInfo.load_15,
    network_rx_bytes: agentInfo.network_rx_bytes,
    network_tx_bytes: agentInfo.network_tx_bytes,
    tcp_connections: agentInfo.tcp_connections,
    process_count: agentInfo.process_count,
    uptime_seconds: agentInfo.uptime_seconds,
    collected_at: agentInfo.collected_at,
  } : null

  return c.json(success({
    ...node,
    targets: targets.results || [],
    agent: agentInfo ? {
      hostname: agentInfo.hostname,
      os: agentInfo.os,
      platform: agentInfo.platform,
      kernel_version: agentInfo.kernel_version,
      arch: agentInfo.arch,
      cpu_model: agentInfo.cpu_model,
      cpu_cores: agentInfo.cpu_cores,
      virtualization: agentInfo.virtualization,
      agent_version: agentInfo.agent_version,
      registration_status: agentInfo.registration_status,
    } : { registration_status: 'pending' },
    latest_metrics: latestMetrics,
    metrics_history: metricHistory.results || [],
    availability_windows: {
      hours_24: availabilityValue(availability?.success_24h, availability?.total_24h),
      days_7: availabilityValue(availability?.success_7d, availability?.total_7d),
      days_30: availabilityValue(availability?.success_30d, availability?.total_30d),
    },
  }))
})

// POST /api/v1/nodes — 创建节点
nodeRoutes.post('/', async (c) => {
  const requestBody = await c.req.json<Record<string, unknown>>().catch(() => null)
  if (!requestBody) return c.json(badRequest('Invalid request body'), 400)
  const body = normalizeNewNode(requestBody)
  const { id, name, region, country, city, latitude, longitude, isp, probe_type, probe_interval, target_ids } = body

  const validationError = validateNode(body, true)
  if (validationError) return c.json(badRequest(validationError), 400)

  // 检查 ID 是否已存在
  const existing = await c.env.DB.prepare('SELECT id FROM nodes WHERE id = ?').bind(id).first()
  if (existing) {
    return c.json(badRequest('Node ID already exists'), 400)
  }

  await c.env.DB.prepare(
    `INSERT INTO nodes (id, name, region, country, city, latitude, longitude, isp, probe_type, probe_interval, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'offline')`
  ).bind(id, name, region, country, city, latitude, longitude, isp || null, probe_type, probe_interval || 60).run()

  // 关联目标
  if (Array.isArray(target_ids) && target_ids.length > 0) {
    const stmts = target_ids.map((tid) =>
      c.env.DB.prepare('INSERT OR IGNORE INTO node_targets (node_id, target_id) VALUES (?, ?)').bind(id, tid)
    )
    await c.env.DB.batch(stmts)
  }

  const node = await c.env.DB.prepare('SELECT * FROM nodes WHERE id = ?').bind(id).first()

  await writeAuditLog(c.env, {
    user_id: c.get('userId' as never) as string | undefined,
    action: 'create',
    object_type: 'node',
    object_id: String(id),
    changes: requestBody,
    ip_address: c.req.header('CF-Connecting-IP'),
  })

  return c.json(success(node), 201)
})

// PUT /api/v1/nodes/:id — 更新节点
nodeRoutes.put('/:id', async (c) => {
  const id = c.req.param('id')
  const body = await c.req.json()

  const existing = await c.env.DB.prepare('SELECT * FROM nodes WHERE id = ?').bind(id).first() as Record<string, unknown> | null
  if (!existing) {
    return c.json(notFound('Node not found'), 404)
  }
  const validationError = validateNode({ ...existing, ...body }, false)
  if (validationError) return c.json(badRequest(validationError), 400)

  const fields: string[] = []
  const values: unknown[] = []

  for (const [key, value] of Object.entries(body)) {
    if (['name', 'region', 'country', 'city', 'latitude', 'longitude', 'isp', 'probe_type', 'probe_interval', 'status'].includes(key)) {
      fields.push(`${key} = ?`)
      values.push(value)
    }
  }

  if (fields.length > 0) {
    fields.push("updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')")
    values.push(id)
    await c.env.DB.prepare(
      `UPDATE nodes SET ${fields.join(', ')} WHERE id = ?`
    ).bind(...values).run()
  }

  // 更新关联目标
  if (body.target_ids) {
    await c.env.DB.prepare('DELETE FROM node_targets WHERE node_id = ?').bind(id).run()
    if (body.target_ids.length > 0) {
      const stmts = body.target_ids.map((tid: string) =>
        c.env.DB.prepare('INSERT OR IGNORE INTO node_targets (node_id, target_id) VALUES (?, ?)').bind(id, tid)
      )
      await c.env.DB.batch(stmts)
    }
  }

  const node = await c.env.DB.prepare('SELECT * FROM nodes WHERE id = ?').bind(id).first()

  await writeAuditLog(c.env, {
    user_id: c.get('userId' as never) as string | undefined,
    action: 'update',
    object_type: 'node',
    object_id: id,
    changes: body,
    ip_address: c.req.header('CF-Connecting-IP'),
  })

  await notifyRealtime(c.env, { type: 'config_changed', node_id: id, reason: 'node_updated' })

  return c.json(success(node))
})

// DELETE /api/v1/nodes/:id — 删除节点
nodeRoutes.delete('/:id', async (c) => {
  const id = c.req.param('id')
  const existing = await c.env.DB.prepare('SELECT id FROM nodes WHERE id = ?').bind(id).first()
  if (!existing) {
    return c.json(notFound('Node not found'), 404)
  }

  await c.env.DB.batch([
    c.env.DB.prepare('DELETE FROM probe_results WHERE node_id = ?').bind(id),
    c.env.DB.prepare('DELETE FROM probe_stats WHERE node_id = ?').bind(id),
    c.env.DB.prepare('DELETE FROM nodes WHERE id = ?').bind(id),
  ])

  await writeAuditLog(c.env, {
    user_id: c.get('userId' as never) as string | undefined,
    action: 'delete',
    object_type: 'node',
    object_id: id,
    ip_address: c.req.header('CF-Connecting-IP'),
  })

  await notifyRealtime(c.env, { type: 'node_deleted', node_id: id })

  return c.json(success(null))
})
