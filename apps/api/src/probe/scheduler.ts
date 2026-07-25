// Braum 布隆 CF 探针 — Cron 调度器

import type { Env } from '../env'
import { aggregateHourly, aggregateDaily } from './aggregator'
import { evaluateAlerts } from './alert-evaluator'

/**
 * Workers Scheduled Event 处理器
 * 根据 Cron 表达式分发不同任务
 */
export async function handleScheduled(event: ScheduledEvent, env: Env, _ctx: ExecutionContext): Promise<void> {
  const cron = event.cron

  try {
    switch (cron) {
      case '*/2 * * * *':
        // 每 2 分钟：告警状态评估
        console.log(JSON.stringify({ event: 'cron', task: 'alert_evaluation', cron }))
        await evaluateAlerts(env)
        break

      case '* * * * *':
        // 每分钟：只检查 Agent 心跳。探测任务由 VPS Agent 在本机执行。
        console.log(JSON.stringify({ event: 'cron', task: 'agent_heartbeat_check', cron }))
        await checkNodeHeartbeats(env)
        break

      case '0 * * * *':
        // 每小时整点：小时聚合
        console.log(JSON.stringify({ event: 'cron', task: 'hourly_aggregation', cron }))
        await aggregateHourly(env)
        break

      case '0 2 * * *':
        // 每天凌晨 2 点：日聚合
        console.log(JSON.stringify({ event: 'cron', task: 'daily_aggregation', cron }))
        await aggregateDaily(env)
        break

      case '0 3 * * *':
        // 每天凌晨 3 点：过期数据清理
        console.log(JSON.stringify({ event: 'cron', task: 'data_cleanup', cron }))
        await cleanupExpiredData(env)
        break

      default:
        console.log(JSON.stringify({ event: 'cron', task: 'unknown', cron }))
    }
  } catch (error) {
    console.error(JSON.stringify({
      event: 'cron_error',
      cron,
      error: error instanceof Error ? error.message : 'Unknown error',
    }))
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
