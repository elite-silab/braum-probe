import { describe, expect, it, vi } from 'vitest'
import worker from '../index'

const env = {
  APP_VERSION: 'test',
  CACHE: { get: async () => null, put: async () => undefined },
}

describe('public API method boundary', () => {
  it.each([
    '/api/v1/nodes',
    '/api/v1/nodes/node-1',
    '/api/v1/incidents',
    '/api/v1/incidents/incident-1',
  ])('未认证写请求 %s 被拒绝', async (path) => {
    const res = await worker.fetch(new Request(`http://localhost${path}`, {
      method: path.endsWith('nodes') || path.endsWith('incidents') ? 'POST' : 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    }), env as any, {} as any)

    expect(res.status).toBe(405)
  })

  it('普通 HTTP 响应仍包含安全头', async () => {
    const res = await worker.fetch(
      new Request('http://localhost/health'),
      env as any,
      {} as any,
    )

    expect(res.status).toBe(200)
    expect(res.headers.get('X-Frame-Options')).toBe('SAMEORIGIN')
  })

  it('WebSocket 升级响应不再尝试追加 HTTP 安全头', async () => {
    const realtimeFetch = vi.fn().mockResolvedValue(new Response(null, { status: 204 }))
    const wsEnv = {
      ...env,
      REALTIME: {
        idFromName: vi.fn().mockReturnValue('global-id'),
        get: vi.fn().mockReturnValue({ fetch: realtimeFetch }),
      },
    }

    const res = await worker.fetch(new Request('http://localhost/api/v1/realtime', {
      headers: {
        Upgrade: 'websocket',
        'CF-Connecting-IP': '203.0.113.10',
      },
    }), wsEnv as any, {} as any)

    expect(res.status).toBe(204)
    expect(res.headers.get('X-Frame-Options')).toBeNull()
    expect(realtimeFetch).toHaveBeenCalledOnce()
  })
})
