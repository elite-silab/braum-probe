import { readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import Database from 'better-sqlite3'
import { afterEach, describe, expect, it } from 'vitest'
import { aggregateHourly } from './probe/aggregator'
import { evaluateAlerts } from './probe/alert-evaluator'

function createD1Adapter(database: Database.Database): D1Database {
  return {
    prepare(sql: string) {
      const statement = database.prepare(sql)
      let params: unknown[] = []
      const chain = {
        bind(...values: unknown[]) {
          params = values
          return chain
        },
        async first(column?: string) {
          const row = statement.get(...params) as Record<string, unknown> | undefined
          return column ? row?.[column] ?? null : row ?? null
        },
        async all() {
          return { results: statement.all(...params), success: true, meta: {} }
        },
        async run() {
          const result = statement.run(...params)
          return { success: true, meta: { changes: result.changes } }
        },
        async raw() {
          return statement.raw().all(...params)
        },
      }
      return chain
    },
    async batch() { return [] },
    async exec(sql: string) { database.exec(sql); return { count: 0, duration: 0 } },
    async dump() { return new ArrayBuffer(0) },
  } as unknown as D1Database
}

function applyMigrations(database: Database.Database) {
  const root = resolve(__dirname, '../../..')
  const migrationDirectory = resolve(root, 'apps/api/migrations')
  const names = readdirSync(migrationDirectory)
    .filter(name => /^\d+_.+\.sql$/.test(name))
    .sort()
  for (const name of names) {
    database.exec(readFileSync(resolve(migrationDirectory, name), 'utf8'))
  }
}

function seedProbeData(database: Database.Database, probeAt = '2026-07-25T07:30:00.000Z') {
  database.prepare(`
    INSERT INTO nodes
      (id, name, region, country, city, latitude, longitude, probe_type, probe_interval, status)
    VALUES ('n1', 'Node', 'asia', 'CN', 'Shanghai', 31.2, 121.5, 'http', 60, 'active')
  `).run()
  database.prepare(`
    INSERT INTO targets (id, name, address, target_type, expected_status, timeout_ms, status)
    VALUES ('t1', 'Target', 'https://example.com', 'http', 200, 5000, 'active')
  `).run()
  database.prepare(`
    INSERT INTO agent_credentials (node_id, secret_hash)
    VALUES ('n1', 'seed-agent-secret')
  `).run()
  database.prepare(`
    INSERT INTO probe_results (node_id, target_id, success, latency_ms, status_code, probe_at)
    VALUES ('n1', 't1', 0, NULL, 503, ?)
  `).run(probeAt)
}

describe('runtime SQL matches migrations', () => {
  let database: Database.Database | undefined

  afterEach(() => database?.close())

  it('真实迁移上可以触发并持久化告警事件', async () => {
    database = new Database(':memory:')
    applyMigrations(database)
    seedProbeData(database, new Date(Date.now() - 30 * 60 * 1000).toISOString())
    database.prepare(`
      INSERT INTO alert_rules
        (id, name, metric, operator, threshold, duration_seconds, scope, suppress_minutes, notify_on_recovery, enabled)
      VALUES ('r1', 'Availability', 'availability', '<', 0.9, 7200, 'all', 15, 1, 1)
    `).run()

    await evaluateAlerts({ DB: createD1Adapter(database) } as any)

    const event = database.prepare(
      'SELECT trigger_value, event_type, message, fired_at FROM alert_events WHERE rule_id = ?'
    ).get('r1') as Record<string, unknown>
    expect(event.trigger_value).toBe(0)
    expect(event.event_type).toBe('firing')
    expect(event.fired_at).toBeTruthy()
  })

  it('真实迁移上可以写入上一小时聚合', async () => {
    database = new Database(':memory:')
    applyMigrations(database)
    seedProbeData(database)

    await aggregateHourly(
      { DB: createD1Adapter(database) } as any,
      new Date('2026-07-25T08:23:00.000Z')
    )

    const stats = database.prepare(
      'SELECT total_probes, success_count, p50_latency_ms FROM probe_stats WHERE period = ?'
    ).get('hourly') as Record<string, unknown>
    expect(stats.total_probes).toBe(1)
    expect(stats.success_count).toBe(0)
    expect(stats.p50_latency_ms).toBeNull()
  })

  it('真实迁移支持 Agent 凭据、主机信息和资源指标', () => {
    database = new Database(':memory:')
    applyMigrations(database)
    database.prepare(`
      INSERT INTO nodes
        (id, name, region, country, city, latitude, longitude, probe_type, probe_interval, status)
      VALUES ('agent-node', 'Agent Node', 'asia', 'CN', 'Shanghai', 31.2, 121.5, 'http', 60, 'active')
    `).run()
    database.prepare(`
      INSERT INTO agent_credentials (node_id, secret_hash)
      VALUES ('agent-node', 'secret-hash')
    `).run()
    database.prepare(`
      INSERT INTO node_agent_info (node_id, hostname, os, arch, agent_version)
      VALUES ('agent-node', 'vps-01', 'linux', 'amd64', '0.1.0')
    `).run()
    database.prepare(`
      INSERT INTO node_metrics (
        node_id, cpu_usage, memory_used_bytes, memory_total_bytes,
        disk_used_bytes, disk_total_bytes, collected_at
      ) VALUES ('agent-node', 12.5, 1024, 4096, 2048, 8192, '2026-07-25T10:00:00.000Z')
    `).run()

    const snapshot = database.prepare(`
      SELECT i.hostname, m.cpu_usage
      FROM node_agent_info i
      JOIN node_metrics m ON m.node_id = i.node_id
      WHERE i.node_id = ?
    `).get('agent-node') as Record<string, unknown>
    expect(snapshot.hostname).toBe('vps-01')
    expect(snapshot.cpu_usage).toBe(12.5)
  })

  it('真实迁移支持 Agent CPU 资源告警', async () => {
    database = new Database(':memory:')
    applyMigrations(database)
    seedProbeData(database)
    database.prepare(`
      INSERT INTO node_metrics (
        node_id, cpu_usage, memory_used_bytes, memory_total_bytes,
        disk_used_bytes, disk_total_bytes, collected_at
      ) VALUES ('n1', 92.5, 1024, 4096, 2048, 8192, strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    `).run()
    database.prepare(`
      INSERT INTO alert_rules
        (id, name, metric, operator, threshold, duration_seconds, scope, suppress_minutes, notify_on_recovery, enabled)
      VALUES ('cpu-rule', 'CPU high', 'cpu_usage', '>', 90, 300, 'all', 15, 1, 1)
    `).run()

    await evaluateAlerts({ DB: createD1Adapter(database) } as any)

    const event = database.prepare(
      'SELECT trigger_value, message FROM alert_events WHERE rule_id = ?'
    ).get('cpu-rule') as Record<string, unknown>
    expect(event.trigger_value).toBe(92.5)
    expect(event.message).toContain('CPU')
  })
})
