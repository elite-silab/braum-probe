// Braum 布隆 CF 探针 — 告警评估引擎

import type { Env } from '../env'
import { sendNotifications } from '../notifications'

interface AlertRule {
  id: string
  name: string
  metric: 'availability' | 'latency_ms' | 'consecutive_failures'
    | 'cpu_usage' | 'memory_usage' | 'disk_usage' | 'load_1' | 'heartbeat_age_seconds'
  operator: '>' | '<' | '>=' | '<=' | '=='
  threshold: number
  duration_seconds: number
  suppress_minutes: number
  notify_on_recovery: number
}

/**
 * 评估所有启用的告警规则
 */
export async function evaluateAlerts(env: Env): Promise<void> {
  const rules = await env.DB.prepare(
    'SELECT * FROM alert_rules WHERE enabled = 1'
  ).all()

  if (!rules.results?.length) return

  for (const rule of rules.results) {
    try {
      await evaluateRule(env, rule as unknown as AlertRule)
    } catch (error) {
      console.error(JSON.stringify({
        event: 'alert_evaluation_error',
        rule_id: (rule as unknown as AlertRule).id,
        error: error instanceof Error ? error.message : 'Unknown',
      }))
    }
  }
}

/**
 * 评估单条告警规则
 */
async function evaluateRule(env: Env, rule: AlertRule): Promise<void> {
  // 获取规则关联的节点（scope=all 时关联所有活跃节点）
  const nodeIds = await getRuleNodeIds(env, rule.id)
  if (!nodeIds.length) return

  for (const nodeId of nodeIds) {
    const triggered = await checkThreshold(env, rule, nodeId)

    if (triggered) {
      await fireAlert(env, rule, nodeId, triggered)
    } else {
      // 检查是否需要发送恢复通知
      if (rule.notify_on_recovery) {
        await checkRecovery(env, rule, nodeId)
      }
    }
  }
}

/**
 * 获取规则关联的节点 ID 列表
 */
async function getRuleNodeIds(env: Env, ruleId: string): Promise<string[]> {
  // 检查 scope
  const rule = await env.DB.prepare('SELECT scope FROM alert_rules WHERE id = ?').bind(ruleId).first() as { scope: string } | null
  if (!rule) return []

  if (rule.scope === 'all') {
    const nodes = await env.DB.prepare(`
      SELECT n.id FROM nodes n
      INNER JOIN agent_credentials ac ON ac.node_id = n.id
      WHERE n.status != 'paused'
    `).all()
    return (nodes.results || []).map((n: any) => n.id as string)
  }

  // 通过 alert_rule_nodes 关联表
  const result = await env.DB.prepare(
    'SELECT node_id FROM alert_rule_nodes WHERE rule_id = ?'
  ).bind(ruleId).all()
  return (result.results || []).map((r: any) => r.node_id as string)
}

/**
 * 检查阈值是否触发
 * @returns 触发时的描述信息，未触发返回 null
 */
async function checkThreshold(
  env: Env,
  rule: AlertRule,
  nodeId: string
): Promise<{ metric_value: number; message: string } | null> {
  const now = new Date()
  const since = new Date(now.getTime() - rule.duration_seconds * 1000)
  const sinceStr = since.toISOString()

  switch (rule.metric) {
    case 'availability': {
      const stats = await env.DB.prepare(`
        SELECT
          COUNT(*) as total,
          SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) as success
        FROM probe_results
        WHERE node_id = ? AND probe_at >= ?
      `).bind(nodeId, sinceStr).first() as { total: number; success: number } | null

      if (!stats || stats.total === 0) return null

      const availability = stats.success / stats.total
      const triggered = compareValue(availability, rule.operator, rule.threshold)

      if (triggered) {
        return {
          metric_value: availability,
          message: `节点 ${nodeId} 可用率 ${(availability * 100).toFixed(1)}% ${rule.operator} 阈值 ${(rule.threshold * 100).toFixed(1)}%`,
        }
      }
      break
    }

    case 'latency_ms': {
      const stats = await env.DB.prepare(`
        SELECT AVG(latency_ms) as avg_latency
        FROM probe_results
        WHERE node_id = ? AND success = 1 AND probe_at >= ?
      `).bind(nodeId, sinceStr).first() as { avg_latency: number } | null

      if (!stats || stats.avg_latency == null) return null

      const triggered = compareValue(stats.avg_latency, rule.operator, rule.threshold)

      if (triggered) {
        return {
          metric_value: stats.avg_latency,
          message: `节点 ${nodeId} 平均延迟 ${stats.avg_latency.toFixed(0)}ms ${rule.operator} 阈值 ${rule.threshold}ms`,
        }
      }
      break
    }

    case 'consecutive_failures': {
      // 统计最近连续失败次数
      const results = await env.DB.prepare(`
        SELECT success FROM probe_results
        WHERE node_id = ?
        ORDER BY probe_at DESC
        LIMIT 100
      `).bind(nodeId).all()

      if (!results.results?.length) return null

      let consecutiveFails = 0
      for (const r of results.results) {
        if ((r as any).success === 0) {
          consecutiveFails++
        } else {
          break
        }
      }

      const triggered = compareValue(consecutiveFails, rule.operator, rule.threshold)

      if (triggered) {
        return {
          metric_value: consecutiveFails,
          message: `节点 ${nodeId} 连续失败 ${consecutiveFails} 次 ${rule.operator} 阈值 ${rule.threshold} 次`,
        }
      }
      break
    }

    case 'cpu_usage':
    case 'memory_usage':
    case 'disk_usage':
    case 'load_1': {
      const expressions = {
        cpu_usage: 'AVG(cpu_usage)',
        memory_usage: 'AVG(memory_used_bytes * 100.0 / NULLIF(memory_total_bytes, 0))',
        disk_usage: 'AVG(disk_used_bytes * 100.0 / NULLIF(disk_total_bytes, 0))',
        load_1: 'AVG(load_1)',
      } as const
      const labels = {
        cpu_usage: 'CPU 使用率', memory_usage: '内存使用率',
        disk_usage: '磁盘使用率', load_1: '系统负载',
      } as const
      const unit = rule.metric === 'load_1' ? '' : '%'
      const stats = await env.DB.prepare(`
        SELECT ${expressions[rule.metric]} AS metric_value
        FROM node_metrics
        WHERE node_id = ? AND collected_at >= ?
      `).bind(nodeId, sinceStr).first() as { metric_value: number | null } | null
      if (!stats || stats.metric_value == null) return null
      if (compareValue(stats.metric_value, rule.operator, rule.threshold)) {
        return {
          metric_value: stats.metric_value,
          message: `节点 ${nodeId} ${labels[rule.metric]} ${stats.metric_value.toFixed(1)}${unit} ${rule.operator} 阈值 ${rule.threshold}${unit}`,
        }
      }
      break
    }

    case 'heartbeat_age_seconds': {
      const heartbeat = await env.DB.prepare(`
        SELECT (julianday('now') - julianday(last_heartbeat_at)) * 86400.0 AS age_seconds
        FROM nodes WHERE id = ? AND last_heartbeat_at IS NOT NULL
      `).bind(nodeId).first() as { age_seconds: number | null } | null
      if (!heartbeat || heartbeat.age_seconds == null) return null
      if (compareValue(heartbeat.age_seconds, rule.operator, rule.threshold)) {
        return {
          metric_value: heartbeat.age_seconds,
          message: `节点 ${nodeId} 心跳中断 ${heartbeat.age_seconds.toFixed(0)} 秒 ${rule.operator} 阈值 ${rule.threshold} 秒`,
        }
      }
      break
    }
  }

  return null
}

/**
 * 比较值与阈值
 */
export function compareValue(value: number, operator: string, threshold: number): boolean {
  switch (operator) {
    case '<': return value < threshold
    case '>': return value > threshold
    case '<=': return value <= threshold
    case '>=': return value >= threshold
    case '==': return value === threshold
    default: return false
  }
}

/**
 * 触发告警事件
 */
async function fireAlert(
  env: Env,
  rule: AlertRule,
  nodeId: string,
  detail: { metric_value: number; message: string }
): Promise<void> {
  // 检查抑制期：同一规则+节点在 suppress_minutes 内不重复告警
  const suppressSince = new Date(Date.now() - rule.suppress_minutes * 60000).toISOString()
  const recent = await env.DB.prepare(`
    SELECT id FROM alert_events
    WHERE rule_id = ? AND node_id = ? AND event_type = 'firing' AND fired_at >= ?
  `).bind(rule.id, nodeId, suppressSince).first()

  if (recent) return // 仍在抑制期内

  // 创建告警事件
  const eventId = crypto.randomUUID()
  const firedAt = new Date().toISOString()
  await env.DB.prepare(`
    INSERT INTO alert_events
      (id, rule_id, node_id, target_id, trigger_value, event_type, message, notified, fired_at)
    VALUES (?, ?, ?, NULL, ?, 'firing', ?, 0, ?)
  `).bind(
    eventId, rule.id, nodeId, detail.metric_value, detail.message, firedAt
  ).run()

  console.log(JSON.stringify({
    event: 'alert_fired',
    rule_id: rule.id,
    rule_name: rule.name,
    node_id: nodeId,
    message: detail.message,
  }))

  // 发送通知
  await sendNotifications(env, rule.id, detail.message)
}

/**
 * 检查恢复状态并发送恢复通知
 */
async function checkRecovery(env: Env, rule: AlertRule, nodeId: string): Promise<void> {
  // 查找该规则+节点最近的未恢复事件
  const lastEvent = await env.DB.prepare(`
    SELECT id, message, fired_at FROM alert_events
    WHERE rule_id = ? AND node_id = ?
      AND event_type = 'firing' AND resolved_at IS NULL
    ORDER BY fired_at DESC LIMIT 1
  `).bind(rule.id, nodeId).first() as { id: string; message: string; fired_at: string } | null

  if (!lastEvent) return

  // 再次检查阈值，如果不再触发说明已恢复
  const stillTriggered = await checkThreshold(env, rule, nodeId)
  if (stillTriggered) return

  // 标记事件为已恢复
  await env.DB.prepare(
    "UPDATE alert_events SET resolved_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?"
  ).bind(lastEvent.id).run()

  const recoveryMessage = `节点 ${nodeId} 告警已恢复（规则: ${rule.name}）`

  console.log(JSON.stringify({
    event: 'alert_recovered',
    rule_id: rule.id,
    node_id: nodeId,
  }))

  await sendNotifications(env, rule.id, recoveryMessage)
}
