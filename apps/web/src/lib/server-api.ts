import { headers } from 'next/headers'

export async function fetchApi<T>(path: string): Promise<{ ok: boolean; data: T | null }> {
  try {
    const requestHeaders = await headers()
    const host = requestHeaders.get('x-forwarded-host') || requestHeaders.get('host') || 'braum-probe.codeelite.workers.dev'
    const protocol = requestHeaders.get('x-forwarded-proto') || (host.startsWith('localhost') ? 'http' : 'https')
    const response = await fetch(`${protocol}://${host}${path}`, { cache: 'no-store' })
    const payload = await response.json() as { code?: number; data?: T }
    return { ok: response.ok && payload.code === 0, data: payload.data ?? null }
  } catch {
    return { ok: false, data: null }
  }
}
