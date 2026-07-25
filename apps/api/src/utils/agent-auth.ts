import type { Env } from '../env'
import { unauthorized } from './response'

const encoder = new TextEncoder()

export async function hashAgentToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(token))
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('')
}

function randomToken(prefix: string): string {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  const value = btoa(String.fromCharCode(...bytes))
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replaceAll('=', '')
  return `${prefix}_${value}`
}

export function createEnrollmentToken(): string {
  return randomToken('brm_enroll')
}

export function createAgentSecret(): string {
  return randomToken('brm_agent')
}

export function readBearerToken(header?: string): string | null {
  if (!header?.startsWith('Bearer ')) return null
  const value = header.slice(7).trim()
  return value || null
}

export async function authenticateAgent(
  env: Env,
  nodeId: string,
  authorization?: string,
): Promise<{ ok: true; node: { id: string; status: string; probe_interval: number } } | { ok: false; response: ReturnType<typeof unauthorized> }> {
  const secret = readBearerToken(authorization)
  if (!secret || secret.length > 256) {
    return { ok: false, response: unauthorized('Invalid agent credentials') }
  }

  const secretHash = await hashAgentToken(secret)
  const node = await env.DB.prepare(`
    SELECT n.id, n.status, n.probe_interval
    FROM nodes n
    INNER JOIN agent_credentials ac ON ac.node_id = n.id
    WHERE n.id = ? AND ac.secret_hash = ?
  `).bind(nodeId, secretHash).first() as { id: string; status: string; probe_interval: number } | null

  if (!node) return { ok: false, response: unauthorized('Invalid agent credentials') }
  return { ok: true, node }
}
