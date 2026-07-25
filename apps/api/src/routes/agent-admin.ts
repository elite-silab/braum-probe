import { Hono } from 'hono'
import type { AgentInstallCommand } from '@braum/shared'
import type { Env } from '../env'
import { createEnrollmentToken, hashAgentToken } from '../utils/agent-auth'
import { writeAuditLog } from '../utils/audit'
import { notFound, success } from '../utils/response'

export const agentAdminRoutes = new Hono<{ Bindings: Env }>()

const ENROLLMENT_TTL_MS = 15 * 60 * 1000

function shellQuote(value: string): string {
  return `'${value.replaceAll("'", `'"'"'`)}'`
}

agentAdminRoutes.post('/nodes/:nodeId/enrollment', async (c) => {
  const nodeId = c.req.param('nodeId')
  const node = await c.env.DB.prepare('SELECT id FROM nodes WHERE id = ?').bind(nodeId).first()
  if (!node) return c.json(notFound('Node not found'), 404)

  const token = createEnrollmentToken()
  const tokenHash = await hashAgentToken(token)
  const expiresAt = new Date(Date.now() + ENROLLMENT_TTL_MS).toISOString()
  const tokenId = crypto.randomUUID()
  const userId = c.get('userId' as never) as string | undefined

  await c.env.DB.batch([
    c.env.DB.prepare(`
      DELETE FROM agent_enrollment_tokens
      WHERE node_id = ? AND used_at IS NULL
    `).bind(nodeId),
    c.env.DB.prepare(`
      INSERT INTO agent_enrollment_tokens
        (id, node_id, token_hash, expires_at, created_by)
      VALUES (?, ?, ?, ?, ?)
    `).bind(tokenId, nodeId, tokenHash, expiresAt, userId || null),
  ])

  const requestOrigin = new URL(c.req.url).origin
  const configuredApi = c.env.AGENT_API_URL || ''
  const apiBase = (configuredApi && !configuredApi.includes('replace-with') ? configuredApi : requestOrigin).replace(/\/$/, '')
  const installer = `${apiBase}/api/agent/v1/install.sh`
  const installCommand = [
    `curl -fsSL ${shellQuote(installer)}`,
    '| sudo bash -s --',
    `--server ${shellQuote(apiBase)}`,
    `--node ${shellQuote(nodeId)}`,
    `--token ${shellQuote(token)}`,
  ].join(' ')

  const data: AgentInstallCommand = {
    node_id: nodeId,
    enrollment_token: token,
    expires_at: expiresAt,
    install_command: installCommand,
  }

  await writeAuditLog(c.env, {
    user_id: userId,
    action: 'create',
    object_type: 'agent_enrollment',
    object_id: nodeId,
    changes: { expires_at: expiresAt },
    ip_address: c.req.header('CF-Connecting-IP'),
  })

  c.header('Cache-Control', 'no-store')
  return c.json(success(data), 201)
})

agentAdminRoutes.delete('/nodes/:nodeId/credentials', async (c) => {
  const nodeId = c.req.param('nodeId')
  const node = await c.env.DB.prepare('SELECT id FROM nodes WHERE id = ?').bind(nodeId).first()
  if (!node) return c.json(notFound('Node not found'), 404)

  await c.env.DB.batch([
    c.env.DB.prepare('DELETE FROM agent_credentials WHERE node_id = ?').bind(nodeId),
    c.env.DB.prepare('DELETE FROM agent_enrollment_tokens WHERE node_id = ?').bind(nodeId),
    c.env.DB.prepare(`
      UPDATE nodes
      SET status = 'offline', last_heartbeat_at = NULL,
          updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
      WHERE id = ?
    `).bind(nodeId),
  ])

  await writeAuditLog(c.env, {
    user_id: c.get('userId' as never) as string | undefined,
    action: 'delete',
    object_type: 'agent_credential',
    object_id: nodeId,
    ip_address: c.req.header('CF-Connecting-IP'),
  })

  return c.json(success(null))
})

agentAdminRoutes.get('/nodes/:nodeId', async (c) => {
  const nodeId = c.req.param('nodeId')
  const snapshot = await c.env.DB.prepare(`
    SELECT n.id, n.status, n.last_heartbeat_at,
           CASE WHEN ac.node_id IS NULL THEN 'pending' ELSE 'registered' END AS registration_status,
           ac.issued_at, ac.last_used_at,
           ai.hostname, ai.os, ai.platform, ai.kernel_version, ai.arch,
           ai.cpu_model, ai.cpu_cores, ai.virtualization, ai.agent_version,
           ai.public_ip, ai.private_ips, ai.updated_at AS agent_info_updated_at
    FROM nodes n
    LEFT JOIN agent_credentials ac ON ac.node_id = n.id
    LEFT JOIN node_agent_info ai ON ai.node_id = n.id
    WHERE n.id = ?
  `).bind(nodeId).first()
  if (!snapshot) return c.json(notFound('Node not found'), 404)

  const latestMetrics = await c.env.DB.prepare(`
    SELECT * FROM node_metrics WHERE node_id = ? ORDER BY collected_at DESC LIMIT 1
  `).bind(nodeId).first()

  return c.json(success({ ...snapshot, latest_metrics: latestMetrics || null }))
})
