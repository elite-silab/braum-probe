// Braum 布隆 CF 探针 — Cron 调度器

import type { Env } from '../env'
import { aggregateHourly, aggregateDaily } from './aggregator'
import { evaluateAlerts } from './alert-evaluator'

/**
 * Workers Scheduled Event 处理器
 * 只使用一条每分钟 Cron，再按 UTC 时间分发任务，节省免费套餐的 Cron 配额。
 */
export async function handleScheduled(event: ScheduledEvent, env: Env, _ctx: ExecutionContext): Promise<void> {
  const cron = event.cron
  const scheduledAt = new Date(Number.isFinite(event.scheduledTime) ? event.scheduledTime : Date.now())
  const minute = scheduledAt.getUTCMinutes()
  const hour = scheduledAt.getUTCHours()
  const isTopOfHour = minute === 0

  const tasks: Array<{ name: string; enabled: boolean; run: () => Promise<void> }> = [
    {
      name: 'agent_heartbeat_check',
      enabled: true,
      run: () => checkNodeHeartbeats(env),
    },
    {
      name: 'alert_evaluation',
      enabled: minute % 2 === 0,
      run: () => evaluateAlerts(env),
    },
    {
      name: 'hourly_aggregation',
      enabled: isTopOfHour,
      run: () => aggregateHourly(env, scheduledAt),
    },
    {
      name: 'daily_aggregation',
      enabled: isTopOfHour && hour === 2,
      run: () => aggregateDaily(env, scheduledAt),
    },
    {
      name: 'data_cleanup',
      enabled: isTopOfHour && hour === 3,
      run: () => cleanupExpiredData(env),
    },
  ]

  for (const task of tasks) {
    if (!task.enabled) continue

    try {
      console.log(JSON.stringify({
        event: 'cron',
        task: task.name,
        cron,
        scheduled_at: scheduledAt.toISOString(),
      }))
      await task.run()
    } catch (error) {
      console.error(JSON.stringify({
        event: 'cron_error',
        task: task.name,
        cron,
        scheduled_at: scheduledAt.toISOString(),
        error: error instanceof Error ? error.message : 'Unknown error',
      }))
    }
  }
}

/**
 * 检查节点心跳，标记超时节点为离线
 */
export async function checkNodeHeartbeats(env: Env): Promise<void> {
  const result = await env.DB.prepare(`
    UPDATE nodes
    SET status = 'offline', updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
    WHERE status != 'paused'
      AND last_heartbeat_at IS NOT NULL
      AND julianday('now') - julianday(last_heartbeat_at)
        > (MAX(probe_interval * 3.0, 180.0) / 86400.0)
  `).run()

  if (result.meta.changes > 0) {
    console.log(JSON.stringify({ event: 'nodes_marked_offline', count: result.meta.changes }))
  }
}

/**
 * 清理过期数据（资源指标 7天 / 探测结果 30天 / 聚合与审计 90天）
 */
async function cleanupExpiredData(env: Env): Promise<void> {
  // 清理超过 30 天的原始探测结果
  const r1 = await env.DB.prepare(`
    DELETE FROM probe_results WHERE julianday(probe_at) < julianday('now', '-30 days')
  `).run()

  // 清理超过 90 天的聚合统计
  const r2 = await env.DB.prepare(`
    DELETE FROM probe_stats WHERE julianday(period_start) < julianday('now', '-90 days')
  `).run()

  // 清理超过 90 天的审计日志
  const r3 = await env.DB.prepare(`
    DELETE FROM audit_logs WHERE julianday(created_at) < julianday('now', '-90 days')
  `).run()

  const r4 = await env.DB.prepare(`
    DELETE FROM node_metrics WHERE julianday(collected_at) < julianday('now', '-7 days')
  `).run()

  const r5 = await env.DB.prepare(`
    DELETE FROM agent_enrollment_tokens
    WHERE julianday(expires_at) < julianday('now', '-1 day')
  `).run()

  console.log(JSON.stringify({
    event: 'data_cleanup',
    probe_results_deleted: r1.meta.changes,
    probe_stats_deleted: r2.meta.changes,
    audit_logs_deleted: r3.meta.changes,
    node_metrics_deleted: r4.meta.changes,
    enrollment_tokens_deleted: r5.meta.changes,
  }))
}
