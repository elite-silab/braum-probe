import { describe, expect, it } from 'vitest'
import worker from '../index'

const env = {
  APP_VERSION: 'test',
  CORS_ORIGINS: 'https://status.example.com',
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
})

describe('CORS origin allowlist', () => {
  it('仅为配置的前端 Origin 返回 CORS header', async () => {
    const allowed = await worker.fetch(new Request('http://localhost/health', {
      method: 'OPTIONS',
      headers: {
        Origin: 'https://status.example.com',
        'Access-Control-Request-Method': 'GET',
      },
    }), env as any, {} as any)
    expect(allowed.headers.get('Access-Control-Allow-Origin')).toBe('https://status.example.com')

    const blocked = await worker.fetch(new Request('http://localhost/health', {
      method: 'OPTIONS',
      headers: {
        Origin: 'https://evil.example.com',
        'Access-Control-Request-Method': 'GET',
      },
    }), env as any, {} as any)
    expect(blocked.headers.get('Access-Control-Allow-Origin')).toBeNull()
  })
})
