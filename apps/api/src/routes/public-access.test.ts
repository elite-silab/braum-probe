import { describe, expect, it } from 'vitest'
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
})
