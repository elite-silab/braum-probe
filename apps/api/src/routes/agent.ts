import { Hono } from 'hono'
import type {
  AgentEnrollInput,
  AgentHeartbeatInput,
  AgentProbeReportInput,
  AgentSystemInfo,
  NodeMetrics,
} from '@braum/shared'
import type { Env } from '../env'
import {
  authenticateAgent,
  createAgentSecret,
  hashAgentToken,
} from '../utils/agent-auth'
import { badRequest, success, unauthorized } from '../utils/response'
import { createLinuxInstallScript } from '../utils/install-script'
import { writeAuditLog } from '../utils/audit'

export const agentRoutes = new Hono<{ Bindings: Env }>()

const MAX_RESULTS_PER_REPORT = 100
const MAX_CLOCK_SKEW_MS = 10 * 60 * 1000

const CONTINENT_REGIONS: Record<string, string> = {
  AS: 'asia',
  EU: 'europe',
  NA: 'north_america',
  SA: 'south_america',
  OC: 'oceania',
  AF: 'africa',
}

interface AgentLocation {
  region: string | null
  country: string | null
  city: string | null
  latitude: number | null
  longitude: number | null
  isp: string | null
}

function coordinate(value: unknown, min: number, max: number): number | null {
  const parsed = typeof value === 'string' || typeof value === 'number' ? Number(value) : NaN
  return Number.isFinite(parsed) && parsed >= min && parsed <= max ? parsed : null
}

export function readAgentLocation(request: Request): AgentLocation | null {
  const cf = (request as Request & { cf?: Record<string, unknown> }).cf
  if (!cf) return null
  const region = CONTINENT_REGIONS[String(cf.continent || '').toUpperCase()] || null
  const country = typeof cf.country === 'string' && cf.country.length <= 100 ? cf.country : null
  const city = typeof cf.city === 'string' && cf.city.length <= 100 ? cf.city : null
  const latitude = coordinate(cf.latitude, -90, 90)
  const longitude = coordinate(cf.longitude, -180, 180)
  const isp = typeof cf.asOrganization === 'string' && cf.asOrganization.length <= 200 ? cf.asOrganization : null
  if (!region && !country && !city && latitude === null && longitude === null && !isp) return null
  return { region, country, city, latitude, longitude, isp }
}

function locationStatement(env: Env, nodeId: string, request: Request): D1PreparedStatement | null {
  const location = readAgentLocation(request)
  if (!location) return null
  return env.DB.prepare(`
    UPDATE nodes SET
      region = COALESCE(?, region),
      country = COALESCE(?, country),
      city = COALESCE(?, city),
      latitude = COALESCE(?, latitude),
      longitude = COALESCE(?, longitude),
      isp = COALESCE(?, isp),
      updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
    WHERE id = ?
  `).bind(
    location.region,
    location.country,
    location.city,
    location.latitude,
    location.longitude,
    location.isp,
    nodeId,
  )
}

agentRoutes.get('/install.sh', (c) => {
  let releaseUrl: URL
  try {
    releaseUrl = new URL(c.env.AGENT_RELEASE_BASE_URL)
  } catch {
    return c.text('Agent release URL is not configured.\n', 503)
  }
  if (releaseUrl.protocol !== 'https:' || releaseUrl.hostname.includes('replace-with')) {
    return c.text('Agent release URL is not configured.\n', 503)
  }

  c.header('Content-Type', 'text/x-shellscript; charset=utf-8')
  c.header('Cache-Control', 'public, max-age=300')
  c.header('X-Content-Type-Options', 'nosniff')
  return c.body(createLinuxInstallScript(releaseUrl.toString()))
})

function validText(value: unknown, max = 200): value is string {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= max
}

function validateSystemInfo(system: unknown): system is AgentSystemInfo {
  if (!system || typeof system !== 'object') return false
  const value = system as Record<string, unknown>
  if (!validText(value.hostname) || !validText(value.os, 50)) return false
  if (!validText(value.arch, 50) || !validText(value.agent_version, 50)) return false
  if (value.cpu_cores !== undefined && (!Number.isInteger(value.cpu_cores) || Number(value.cpu_cores) < 1 || Number(value.cpu_cores) > 4096)) return false
  if (value.private_ips !== undefined && (!Array.isArray(value.private_ips) || value.private_ips.length > 32 || value.private_ips.some(ip => !validText(ip, 64)))) return false
  return true
}

function finiteInRange(value: unknown, min: number, max: number): boolean {
  return typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max
}

function validTimestamp(value: unknown, maxAgeMs = MAX_CLOCK_SKEW_MS): value is string {
  if (typeof value !== 'string') return false
  const timestamp = Date.parse(value)
  return Number.isFinite(timestamp)
    && timestamp >= Date.now() - maxAgeMs
    && timestamp <= Date.now() + MAX_CLOCK_SKEW_MS
}

function validateMetrics(metrics: unknown): metrics is NodeMetrics {
  if (!metrics || typeof metrics !== 'object') return false
  const m = metrics as Record<string, unknown>
  if (!finiteInRange(m.cpu_usage, 0, 100)) return false

  const byteFields = [
    'memory_used_bytes', 'memory_total_bytes', 'swap_used_bytes', 'swap_total_bytes',
    'disk_used_bytes', 'disk_total_bytes', 'network_rx_bytes', 'network_tx_bytes',
  ]
  if (byteFields.some(key => !Number.isSafeInteger(m[key]) || Number(m[key]) < 0)) return false
  if (Number(m.memory_used_bytes) > Number(m.memory_total_bytes)) return false
  if (Number(m.swap_used_bytes) > Number(m.swap_total_bytes)) return false
  if (Number(m.disk_used_bytes) > Number(m.disk_total_bytes)) return false

  if (!finiteInRange(m.load_1, 0, 1_000_000) || !finiteInRange(m.load_5, 0, 1_000_000) || !finiteInRange(m.load_15, 0, 1_000_000)) return false
  for (const key of ['tcp_connections', 'process_count', 'uptime_seconds']) {
    if (!Number.isSafeInteger(m[key]) || Number(m[key]) < 0) return false
  }
  return validTimestamp(m.collected_at)
}

function systemInfoStatement(env: Env, nodeId: string, system: AgentSystemInfo, publicIp: string | undefined) {
  return env.DB.prepare(`
    INSERT INTO node_agent_info (
      node_id, hostname, os, platform, kernel_version, arch, cpu_model,
      cpu_cores, virtualization, agent_version, public_ip, private_ips
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(node_id) DO UPDATE SET
      hostname = excluded.hostname,
      os = excluded.os,
      platform = excluded.platform,
      kernel_version = excluded.kernel_version,
      arch = excluded.arch,
      cpu_model = excluded.cpu_model,
      cpu_cores = excluded.cpu_cores,
      virtualization = excluded.virtualization,
      agent_version = excluded.agent_version,
      public_ip = excluded.public_ip,
      private_ips = excluded.private_ips,
      updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
  `).bind(
    nodeId,
    system.hostname.trim(),
    system.os.trim(),
    system.platform || null,
    system.kernel_version || null,
    system.arch.trim(),
    system.cpu_model || null,
    system.cpu_cores || null,
    system.virtualization || null,
    system.agent_version.trim(),
    publicIp || null,
    JSON.stringify(system.private_ips || []),
  )
}

agentRoutes.post('/enroll', async (c) => {
  const body = await c.req.json<AgentEnrollInput>().catch(() => null)
  if (!body || !validText(body.node_id, 100) || !validText(body.enrollment_token, 256) || !validateSystemInfo(body.system)) {
    return c.json(badRequest('Invalid enrollment payload'), 400)
  }

  const tokenHash = await hashAgentToken(body.enrollment_token)
  const enrollment = await c.env.DB.prepare(`
    SELECT id, node_id
    FROM agent_enrollment_tokens
    WHERE node_id = ? AND token_hash = ? AND used_at IS NULL
      AND expires_at > strftime('%Y-%m-%dT%H:%M:%fZ','now')
  `).bind(body.node_id, tokenHash).first() as { id: string; node_id: string } | null

  if (!enrollment) return c.json(unauthorized('Invalid or expired enrollment token'), 401)

  const agentSecret = createAgentSecret()
  const secretHash = await hashAgentToken(agentSecret)
  const consumed = await c.env.DB.prepare(`
    UPDATE agent_enrollment_tokens
    SET used_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
    WHERE id = ? AND used_at IS NULL
      AND expires_at > strftime('%Y-%m-%dT%H:%M:%fZ','now')
  `).bind(enrollment.id).run()

  if (consumed.meta.changes !== 1) {
    return c.json(unauthorized('Invalid or expired enrollment token'), 401)
  }

  const enrollmentStatements: D1PreparedStatement[] = [
    c.env.DB.prepare(`
      INSERT INTO agent_credentials (node_id, secret_hash)
      VALUES (?, ?)
      ON CONFLICT(node_id) DO UPDATE SET
        secret_hash = excluded.secret_hash,
        rotated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now'),
        last_used_at = NULL
    `).bind(body.node_id, secretHash),
    systemInfoStatement(c.env, body.node_id, body.system, c.req.header('CF-Connecting-IP')),
    c.env.DB.prepare(`
      UPDATE nodes
      SET status = 'active', last_heartbeat_at = strftime('%Y-%m-%dT%H:%M:%fZ','now'),
          updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
      WHERE id = ?
    `).bind(body.node_id),
  ]
  const location = locationStatement(c.env, body.node_id, c.req.raw)
  if (location) enrollmentStatements.push(location)
  await c.env.DB.batch(enrollmentStatements)

  await writeAuditLog(c.env, {
    action: 'create',
    object_type: 'agent_credential',
    object_id: body.node_id,
    changes: { agent_version: body.system.agent_version, os: body.system.os, arch: body.system.arch },
    ip_address: c.req.header('CF-Connecting-IP'),
    user_agent: c.req.header('User-Agent'),
  })

  const node = await c.env.DB.prepare('SELECT probe_interval FROM nodes WHERE id = ?').bind(body.node_id).first() as { probe_interval: number } | null
  c.header('Cache-Control', 'no-store')
  return c.json(success({
    node_id: body.node_id,
    agent_secret: agentSecret,
    heartbeat_interval: Math.max(60, node?.probe_interval || 60),
    server_time: new Date().toISOString(),
  }), 201)
})

agentRoutes.post('/heartbeat', async (c) => {
  const body = await c.req.json<AgentHeartbeatInput>().catch(() => null)
  if (!body || !validText(body.node_id, 100) || !validateSystemInfo(body.system) || !validateMetrics(body.metrics)) {
    return c.json(badRequest('Invalid heartbeat payload'), 400)
  }

  const auth = await authenticateAgent(c.env, body.node_id, c.req.header('Authorization'))
  if (!auth.ok) return c.json(auth.response, 401)

  const m = body.metrics
  await c.env.DB.batch([
    systemInfoStatement(c.env, body.node_id, body.system, c.req.header('CF-Connecting-IP')),
    c.env.DB.prepare(`
      INSERT INTO node_metrics (
        node_id, cpu_usage, memory_used_bytes, memory_total_bytes,
        swap_used_bytes, swap_total_bytes, disk_used_bytes, disk_total_bytes,
        load_1, load_5, load_15, network_rx_bytes, network_tx_bytes,
        tcp_connections, process_count, uptime_seconds, collected_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      body.node_id, m.cpu_usage, m.memory_used_bytes, m.memory_total_bytes,
      m.swap_used_bytes, m.swap_total_bytes, m.disk_used_bytes, m.disk_total_bytes,
      m.load_1, m.load_5, m.load_15, m.network_rx_bytes, m.network_tx_bytes,
      m.tcp_connections, m.process_count, m.uptime_seconds, m.collected_at,
    ),
    c.env.DB.prepare(`
      UPDATE nodes
      SET status = CASE WHEN status = 'paused' THEN 'paused' ELSE 'active' END,
          last_heartbeat_at = strftime('%Y-%m-%dT%H:%M:%fZ','now'),
          updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
      WHERE id = ?
    `).bind(body.node_id),
    c.env.DB.prepare(`
      UPDATE agent_credentials
      SET last_used_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
      WHERE node_id = ?
    `).bind(body.node_id),
  ])

  const targets = auth.node.status === 'paused'
    ? { results: [] }
    : await c.env.DB.prepare(`
        SELECT t.id, t.name, t.target_type, t.address, t.port,
               t.expected_status, t.timeout_ms
        FROM targets t
        INNER JOIN node_targets nt ON nt.target_id = t.id
        WHERE nt.node_id = ? AND t.status = 'active'
        ORDER BY t.name ASC
        LIMIT 100
      `).bind(body.node_id).all()

  return c.json(success({
    heartbeat_interval: Math.max(60, auth.node.probe_interval),
    server_time: new Date().toISOString(),
    targets: targets.results || [],
  }))
})

agentRoutes.post('/probe-results', async (c) => {
  const body = await c.req.json<AgentProbeReportInput>().catch(() => null)
  if (!body || !validText(body.node_id, 100) || !Array.isArray(body.results) || body.results.length > MAX_RESULTS_PER_REPORT) {
    return c.json(badRequest('Invalid probe report'), 400)
  }

  const auth = await authenticateAgent(c.env, body.node_id, c.req.header('Authorization'))
  if (!auth.ok) return c.json(auth.response, 401)
  if (auth.node.status === 'paused') return c.json(badRequest('Node is paused'), 409)
  if (body.results.length === 0) return c.json(success({ accepted: 0 }))

  const uniqueTargetIds = [...new Set(body.results.map(result => result.target_id))]
  if (uniqueTargetIds.some(id => !validText(id, 100))) return c.json(badRequest('Invalid target id'), 400)
  const placeholders = uniqueTargetIds.map(() => '?').join(',')
  const assigned = await c.env.DB.prepare(`
    SELECT target_id FROM node_targets
    WHERE node_id = ? AND target_id IN (${placeholders})
  `).bind(body.node_id, ...uniqueTargetIds).all()
  const assignedIds = new Set((assigned.results || []).map(row => String((row as { target_id: string }).target_id)))
  if (assignedIds.size !== uniqueTargetIds.length) return c.json(badRequest('Target is not assigned to this node'), 400)

  for (const result of body.results) {
    if (typeof result.success !== 'boolean' || !validTimestamp(result.probe_at, 24 * 60 * 60 * 1000)) return c.json(badRequest('Invalid probe result'), 400)
    if (result.latency_ms !== null && !finiteInRange(result.latency_ms, 0, 300_000)) return c.json(badRequest('Invalid probe latency'), 400)
    if (result.dns_time_ms !== null && !finiteInRange(result.dns_time_ms, 0, 300_000)) return c.json(badRequest('Invalid DNS latency'), 400)
    if (result.status_code !== null && (!Number.isInteger(result.status_code) || result.status_code < 100 || result.status_code > 599)) return c.json(badRequest('Invalid status code'), 400)
    if (result.error_message !== null && (typeof result.error_message !== 'string' || result.error_message.length > 500)) return c.json(badRequest('Invalid error message'), 400)
  }

  await c.env.DB.batch(body.results.map(result => c.env.DB.prepare(`
    INSERT INTO probe_results (
      node_id, target_id, success, latency_ms, status_code,
      dns_time_ms, error_message, probe_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    body.node_id, result.target_id, result.success ? 1 : 0,
    result.latency_ms, result.status_code, result.dns_time_ms,
    result.error_message, result.probe_at,
  )))

  await Promise.all(body.results.map(result => c.env.CACHE.put(
    `latest:${body.node_id}:${result.target_id}`,
    JSON.stringify({ node_id: body.node_id, ...result }),
    { expirationTtl: 300 },
  )))

  return c.json(success({ accepted: body.results.length }))
})
