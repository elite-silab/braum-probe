// Braum 布隆 CF 探针 — 聚合统计

import type { Env } from '../env'

/**
 * 小时聚合：将最近一小时的 probe_results 聚合为 probe_stats
 */
export function getCompletedHourWindow(now = new Date()): { start: string; end: string } {
  const hourEnd = new Date(now)
  hourEnd.setUTCMinutes(0, 0, 0)
  const hourStart = new Date(hourEnd.getTime() - 3600000)

  return { start: hourStart.toISOString(), end: hourEnd.toISOString() }
}

export function getCompletedDayWindow(now = new Date()): { start: string; end: string } {
  const dayEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
  const dayStart = new Date(dayEnd.getTime() - 86400000)

  return { start: dayStart.toISOString(), end: dayEnd.toISOString() }
}

export async function aggregateHourly(env: Env, now = new Date()): Promise<void> {
  const { start: startStr, end: endStr } = getCompletedHourWindow(now)


  const combos = await env.DB.prepare(`
    SELECT DISTINCT node_id, target_id FROM probe_results
    WHERE probe_at >= ? AND probe_at < ?
  `).bind(startStr, endStr).all()

  if (!combos.results?.length) return

  for (const combo of combos.results) {
    const { node_id, target_id } = combo as { node_id: string; target_id: string }

    const stats = await env.DB.prepare(`
      SELECT
        COUNT(*) as total_probes,
        SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) as success_count,
        AVG(CASE WHEN success = 1 THEN latency_ms END) as avg_latency,
        MIN(CASE WHEN success = 1 THEN latency_ms END) as min_latency,
        MAX(CASE WHEN success = 1 THEN latency_ms END) as max_latency
      FROM probe_results
      WHERE node_id = ? AND target_id = ? AND probe_at >= ? AND probe_at < ?
    `).bind(node_id, target_id, startStr, endStr).first() as Record<string, number> | null

    if (!stats || stats.total_probes === 0) continue

    const availability = stats.success_count / stats.total_probes

    // 计算 P50/P95/P99（使用 ORDER BY + OFFSET 模拟百分位）
    const percentiles = await calculatePercentiles(env, node_id, target_id, startStr, endStr)

    await env.DB.prepare(`
      INSERT OR REPLACE INTO probe_stats
        (node_id, target_id, period, period_start, total_probes, success_count,
         avg_latency_ms, min_latency_ms, max_latency_ms, availability,
         p50_latency_ms, p95_latency_ms, p99_latency_ms)
      VALUES (?, ?, 'hourly', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      node_id, target_id, startStr,
      stats.total_probes, stats.success_count,
      stats.avg_latency, stats.min_latency, stats.max_latency,
      availability,
      percentiles.p50, percentiles.p95, percentiles.p99
    ).run()
  }

  console.log(JSON.stringify({ event: 'hourly_aggregation', combos: combos.results.length, start: startStr }))
}

/**
 * 日聚合：将当天的 hourly stats 聚合为 daily stats
 */
export async function aggregateDaily(env: Env, now = new Date()): Promise<void> {
  const { start: dayStr, end: dayEndStr } = getCompletedDayWindow(now)

  const combos = await env.DB.prepare(`
    SELECT DISTINCT node_id, target_id FROM probe_stats
    WHERE period = 'hourly' AND period_start >= ? AND period_start < ?
  `).bind(dayStr, dayEndStr).all()

  if (!combos.results?.length) return

  for (const combo of combos.results) {
    const { node_id, target_id } = combo as { node_id: string; target_id: string }

    const stats = await env.DB.prepare(`
      SELECT
        SUM(total_probes) as total_probes,
        SUM(success_count) as success_count,
        AVG(avg_latency_ms) as avg_latency,
        MIN(min_latency_ms) as min_latency,
        MAX(max_latency_ms) as max_latency
      FROM probe_stats
      WHERE node_id = ? AND target_id = ? AND period = 'hourly'
        AND period_start >= ? AND period_start < ?
    `).bind(node_id, target_id, dayStr, dayEndStr).first() as Record<string, number> | null

    if (!stats || stats.total_probes === 0) continue

    const availability = stats.success_count / stats.total_probes

    // 日聚合的百分位取各小时百分位的加权平均（简化实现）
    const pStats = await env.DB.prepare(`
      SELECT
        AVG(p50_latency_ms) as p50,
        AVG(p95_latency_ms) as p95,
        AVG(p99_latency_ms) as p99
      FROM probe_stats
      WHERE node_id = ? AND target_id = ? AND period = 'hourly'
        AND period_start >= ? AND period_start < ?
    `).bind(node_id, target_id, dayStr, dayEndStr).first() as { p50: number; p95: number; p99: number } | null

    await env.DB.prepare(`
      INSERT OR REPLACE INTO probe_stats
        (node_id, target_id, period, period_start, total_probes, success_count,
         avg_latency_ms, min_latency_ms, max_latency_ms, availability,
         p50_latency_ms, p95_latency_ms, p99_latency_ms)
      VALUES (?, ?, 'daily', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      node_id, target_id, dayStr,
      stats.total_probes, stats.success_count,
      stats.avg_latency, stats.min_latency, stats.max_latency,
      availability,
      pStats?.p50 || null, pStats?.p95 || null, pStats?.p99 || null
    ).run()
  }

  console.log(JSON.stringify({ event: 'daily_aggregation', combos: combos.results.length, date: dayStr }))
}

/**
 * 计算延迟百分位（P50/P95/P99）
 * 使用 ORDER BY + LIMIT 1 OFFSET n 模拟（SQLite 无内置 percentile）
 */
async function calculatePercentiles(
  env: Env,
  nodeId: string,
  targetId: string,
  startStr: string,
  endStr: string
): Promise<{ p50: number | null; p95: number | null; p99: number | null }> {
  // 先获取成功的探测总数
  const countResult = await env.DB.prepare(`
    SELECT COUNT(*) as cnt FROM probe_results
    WHERE node_id = ? AND target_id = ? AND success = 1 AND probe_at >= ? AND probe_at < ?
  `).bind(nodeId, targetId, startStr, endStr).first() as { cnt: number } | null

  const count = countResult?.cnt || 0
  if (count === 0) return { p50: null, p95: null, p99: null }

  const baseQuery = `
    SELECT latency_ms FROM probe_results
    WHERE node_id = ? AND target_id = ? AND success = 1 AND probe_at >= ? AND probe_at < ?
    ORDER BY latency_ms ASC
  `

  async function getPercentile(p: number): Promise<number | null> {
    const offset = Math.max(0, Math.floor(count * p) - 1)
    const row = await env.DB.prepare(
      `${baseQuery} LIMIT 1 OFFSET ?`
    ).bind(nodeId, targetId, startStr, endStr, offset).first() as { latency_ms: number } | null
    return row?.latency_ms ?? null
  }

  const [p50, p95, p99] = await Promise.all([
    getPercentile(0.50),
    getPercentile(0.95),
    getPercentile(0.99),
  ])

  return { p50, p95, p99 }
}
