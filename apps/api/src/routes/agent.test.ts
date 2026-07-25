import { readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import Database from 'better-sqlite3'
import { afterEach, describe, expect, it } from 'vitest'
import { Hono } from 'hono'
import { agentRoutes, readAgentLocation } from './agent'
import { agentAdminRoutes } from './agent-admin'
import { createMockKV } from '../test-helpers'

interface TestStatement {
  bind: (...values: unknown[]) => TestStatement
  first: (column?: string) => Promise<unknown>
  all: () => Promise<{ results: unknown[] }>
  run: () => Promise<{ meta: { changes: number } }>
  runSync: () => { meta: { changes: number } }
}

describe('Agent location detection', () => {
  it('从 Cloudflare 请求信息识别节点位置和 ISP', () => {
    const request = new Request('https://api.example.com/api/agent/v1/enroll')
    Object.defineProperty(request, 'cf', {
      value: {
        continent: 'EU',
        country: 'DE',
        city: 'Frankfurt',
        latitude: '50.1109',
        longitude: '8.6821',
        asOrganization: 'Example Hosting GmbH',
      },
    })

    expect(readAgentLocation(request)).toEqual({
      region: 'europe',
      country: 'DE',
      city: 'Frankfurt',
      latitude: 50.1109,
      longitude: 8.6821,
      isp: 'Example Hosting GmbH',
    })
  })

  it('本地请求没有 Cloudflare 信息时不覆盖默认位置', () => {
    expect(readAgentLocation(new Request('http://localhost/enroll'))).toBeNull()
  })
})

function createD1Adapter(database: Database.Database): D1Database {
  const db = {
    prepare(sql: string): TestStatement {
      const statement = database.prepare(sql)
      let params: unknown[] = []
      const chain: TestStatement = {
        bind(...values: unknown[]) {
          params = values
          return chain
        },
        async first(column?: string) {
          const row = statement.get(...params) as Record<string, unknown> | undefined
          return column ? row?.[column] ?? null : row ?? null
        },
        async all() {
          return { results: statement.all(...params) }
        },
        runSync() {
          const result = statement.run(...params)
          return { meta: { changes: result.changes } }
        },
        async run() {
          return chain.runSync()
        },
      }
      return chain
    },
    async batch(statements: TestStatement[]) {
      const execute = database.transaction(() => statements.map(statement => statement.runSync()))
      return execute()
    },
  }
  return db as unknown as D1Database
}

function applyMigrations(database: Database.Database) {
  const root = resolve(__dirname, '../../../..')
  const migrationDirectory = resolve(root, 'apps/api/migrations')
  const names = readdirSync(migrationDirectory)
    .filter(name => /^\d+_.+\.sql$/.test(name))
    .sort()
  for (const name of names) database.exec(readFileSync(resolve(migrationDirectory, name), 'utf8'))
}

function createApps(env: Record<string, unknown>) {
  const admin = new Hono<{ Bindings: any }>()
  admin.route('/api/admin/v1/agents', agentAdminRoutes)
  const agent = new Hono<{ Bindings: any }>()
  agent.route('/api/agent/v1', agentRoutes)
  return {
    admin: (request: Request) => admin.fetch(request, env),
    agent: (request: Request) => agent.fetch(request, env),
  }
}

function jsonRequest(url: string, body: unknown, token?: string) {
  return new Request(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  })
}

const system = {
  hostname: 'vps-01',
  os: 'linux',
  platform: 'debian',
  kernel_version: '6.1.0',
  arch: 'amd64',
  cpu_model: 'Test CPU',
  cpu_cores: 2,
  agent_version: '0.1.0',
  private_ips: ['10.0.0.2'],
}

function metrics() {
  return {
    cpu_usage: 12.5,
    memory_used_bytes: 1024,
    memory_total_bytes: 4096,
    swap_used_bytes: 0,
    swap_total_bytes: 0,
    disk_used_bytes: 2048,
    disk_total_bytes: 8192,
    load_1: 0.1,
    load_5: 0.2,
    load_15: 0.3,
    network_rx_bytes: 1000,
    network_tx_bytes: 2000,
    tcp_connections: 3,
    process_count: 42,
    uptime_seconds: 3600,
    collected_at: new Date().toISOString(),
  }
}

describe('VPS Agent registration and reporting', () => {
  let database: Database.Database | undefined

  afterEach(() => database?.close())

  function setup() {
    database = new Database(':memory:')
    database.pragma('foreign_keys = ON')
    applyMigrations(database)
    database.prepare(`
      INSERT INTO nodes
        (id, name, region, country, city, latitude, longitude, probe_type, probe_interval, status)
      VALUES ('node-1', 'Tokyo VPS', 'asia', 'JP', 'Tokyo', 35.6, 139.6, 'http', 60, 'offline')
    `).run()
    database.prepare(`
      INSERT INTO targets (id, name, address, target_type, expected_status, timeout_ms, status)
      VALUES ('target-1', 'Example', 'https://example.com', 'http', 200, 5000, 'active')
    `).run()
    database.prepare(`
      INSERT INTO node_targets (node_id, target_id) VALUES ('node-1', 'target-1')
    `).run()
    const env = {
      DB: createD1Adapter(database),
      CACHE: createMockKV(),
      AGENT_API_URL: 'https://api.example.com',
      AGENT_RELEASE_BASE_URL: 'https://downloads.example.com',
    }
    return { ...createApps(env), env }
  }

  async function enroll(apps: ReturnType<typeof setup>) {
    const commandResponse = await apps.admin(new Request(
      'https://api.example.com/api/admin/v1/agents/nodes/node-1/enrollment',
      { method: 'POST' },
    ))
    expect(commandResponse.status).toBe(201)
    const commandBody = await commandResponse.json() as any
    expect(commandBody.data.install_command).toContain('/api/agent/v1/install.sh')
    expect(commandBody.data.install_command).not.toContain('undefined')

    const enrollResponse = await apps.agent(jsonRequest(
      'https://api.example.com/api/agent/v1/enroll',
      { node_id: 'node-1', enrollment_token: commandBody.data.enrollment_token, system },
    ))
    expect(enrollResponse.status).toBe(201)
    const enrollBody = await enrollResponse.json() as any
    expect(enrollBody.data.agent_secret).toMatch(/^brm_agent_/)
    return { enrollmentToken: commandBody.data.enrollment_token as string, secret: enrollBody.data.agent_secret as string }
  }

  it('提供带下载校验和 systemd 沙箱的通用安装脚本', async () => {
    const apps = setup()
    const response = await apps.agent(new Request('https://api.example.com/api/agent/v1/install.sh'))
    expect(response.status).toBe(200)
    expect(response.headers.get('Content-Type')).toContain('text/x-shellscript')
    const script = await response.text()
    expect(script).toContain('https://downloads.example.com')
    expect(script).toContain('sha256sum -c')
    expect(script).toContain('User=braum-agent')
  })

  it('一次性令牌注册后不可重复使用，且数据库不保存明文密钥', async () => {
    const apps = setup()
    const credentials = await enroll(apps)

    const second = await apps.agent(jsonRequest(
      'https://api.example.com/api/agent/v1/enroll',
      { node_id: 'node-1', enrollment_token: credentials.enrollmentToken, system },
    ))
    expect(second.status).toBe(401)

    const stored = database!.prepare(`
      SELECT aet.token_hash, aet.used_at, ac.secret_hash
      FROM agent_enrollment_tokens aet
      JOIN agent_credentials ac ON ac.node_id = aet.node_id
      WHERE aet.node_id = 'node-1'
    `).get() as Record<string, unknown>
    expect(stored.used_at).toBeTruthy()
    expect(stored.token_hash).not.toBe(credentials.enrollmentToken)
    expect(stored.secret_hash).not.toBe(credentials.secret)
  })

  it('合法心跳写入资源指标、更新主机信息并返回关联探测目标', async () => {
    const apps = setup()
    const { secret } = await enroll(apps)

    const response = await apps.agent(jsonRequest(
      'https://api.example.com/api/agent/v1/heartbeat',
      { node_id: 'node-1', system, metrics: metrics() },
      secret,
    ))
    expect(response.status).toBe(200)
    const body = await response.json() as any
    expect(body.data.targets).toHaveLength(1)
    expect(body.data.targets[0].id).toBe('target-1')

    const snapshot = database!.prepare(`
      SELECT n.status, n.last_heartbeat_at, i.hostname, m.cpu_usage
      FROM nodes n
      JOIN node_agent_info i ON i.node_id = n.id
      JOIN node_metrics m ON m.node_id = n.id
      WHERE n.id = 'node-1'
    `).get() as Record<string, unknown>
    expect(snapshot.status).toBe('active')
    expect(snapshot.last_heartbeat_at).toBeTruthy()
    expect(snapshot.hostname).toBe('vps-01')
    expect(snapshot.cpu_usage).toBe(12.5)
  })

  it('拒绝错误密钥和越权目标，只接受分配给本节点的结果', async () => {
    const apps = setup()
    const { secret } = await enroll(apps)

    const wrongSecret = await apps.agent(jsonRequest(
      'https://api.example.com/api/agent/v1/heartbeat',
      { node_id: 'node-1', system, metrics: metrics() },
      'brm_agent_wrong',
    ))
    expect(wrongSecret.status).toBe(401)

    const invalidTarget = await apps.agent(jsonRequest(
      'https://api.example.com/api/agent/v1/probe-results',
      {
        node_id: 'node-1',
        results: [{
          target_id: 'not-assigned', success: true, latency_ms: 20,
          status_code: 200, dns_time_ms: null, error_message: null,
          probe_at: new Date().toISOString(),
        }],
      },
      secret,
    ))
    expect(invalidTarget.status).toBe(400)

    const valid = await apps.agent(jsonRequest(
      'https://api.example.com/api/agent/v1/probe-results',
      {
        node_id: 'node-1',
        results: [{
          target_id: 'target-1', success: true, latency_ms: 18.2,
          status_code: 200, dns_time_ms: null, error_message: null,
          probe_at: new Date().toISOString(),
        }],
      },
      secret,
    ))
    expect(valid.status).toBe(200)
    expect(database!.prepare('SELECT COUNT(*) AS count FROM probe_results').get()).toEqual({ count: 1 })
  })

  it('吊销凭据后旧 Agent 密钥立即失效', async () => {
    const apps = setup()
    const { secret } = await enroll(apps)

    const revoke = await apps.admin(new Request(
      'https://api.example.com/api/admin/v1/agents/nodes/node-1/credentials',
      { method: 'DELETE' },
    ))
    expect(revoke.status).toBe(200)

    const heartbeat = await apps.agent(jsonRequest(
      'https://api.example.com/api/agent/v1/heartbeat',
      { node_id: 'node-1', system, metrics: metrics() },
      secret,
    ))
    expect(heartbeat.status).toBe(401)
  })
})
