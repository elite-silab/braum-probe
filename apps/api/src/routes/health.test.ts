// Braum 布隆 CF 探针 — 健康检查路由测试

import { describe, it, expect, vi } from 'vitest'
import { Hono } from 'hono'
import { healthRoutes } from './health'
import { createMockDB, createMockKV } from '../test-helpers'

function createApp(env: Record<string, unknown>) {
  const app = new Hono<{ Bindings: any }>()
  app.route('/health', healthRoutes)
  // 注入 env bindings
  return {
    fetch: (req: Request) => app.fetch(req, env),
  }
}

describe('GET /health', () => {
  it('返回 status: ok + version + timestamp', async () => {
    const env = {
      DB: createMockDB(),
      CACHE: createMockKV(),
      APP_VERSION: '1.2.3',
    }
    const app = createApp(env)

    const res = await app.fetch(new Request('http://localhost/health'))
    expect(res.status).toBe(200)

    const body: any = await res.json()
    expect(body.status).toBe('ok')
    expect(body.version).toBe('1.2.3')
    expect(body.timestamp).toBeDefined()
  })

  it('timestamp 是有效 ISO 格式', async () => {
    const env = { DB: createMockDB(), CACHE: createMockKV(), APP_VERSION: '0.1.0' }
    const app = createApp(env)

    const res = await app.fetch(new Request('http://localhost/health'))
    const body: any = await res.json()
    expect(() => new Date(body.timestamp)).not.toThrow()
  })
})

describe('GET /health/detailed', () => {
  it('所有组件正常 → status: ok', async () => {
    const db = createMockDB([
      // SELECT 1 (D1 检查)
      { first: { 1: 1 } },
      // 节点统计
      { first: { total: 5, online: 3 } },
    ])
    const cache = createMockKV()
    const env = { DB: db, CACHE: cache, APP_VERSION: '0.1.0' }
    const app = createApp(env)

    const res = await app.fetch(new Request('http://localhost/health/detailed'))
    const body: any = await res.json()

    expect(body.status).toBe('ok')
    expect(body.d1).toBe('ok')
    expect(body.kv).toBe('ok')
    expect(body.nodes_total).toBe(5)
    expect(body.nodes_online).toBe(3)
  })

  it('D1 失败 → status: degraded', async () => {
    const db = {
      prepare: vi.fn()
        .mockReturnValueOnce({ bind: vi.fn().mockReturnThis(), first: vi.fn().mockRejectedValue(new Error('D1 down')) })
        .mockReturnValueOnce({ bind: vi.fn().mockReturnThis(), first: vi.fn().mockResolvedValue({ total: 0, online: 0 }) }),
      batch: vi.fn(),
    } as any
    const cache = createMockKV()
    const env = { DB: db, CACHE: cache, APP_VERSION: '0.1.0' }
    const app = createApp(env)

    const res = await app.fetch(new Request('http://localhost/health/detailed'))
    const body: any = await res.json()

    expect(body.status).toBe('degraded')
    expect(body.d1).toBe('error')
    expect(body.kv).toBe('ok')
  })

  it('KV 失败 → status: degraded', async () => {
    const db = createMockDB([
      { first: { 1: 1 } },
      { first: { total: 2, online: 2 } },
    ])
    const cache = {
      get: vi.fn().mockRejectedValue(new Error('KV down')),
      put: vi.fn(),
      delete: vi.fn(),
    } as any
    const env = { DB: db, CACHE: cache, APP_VERSION: '0.1.0' }
    const app = createApp(env)

    const res = await app.fetch(new Request('http://localhost/health/detailed'))
    const body: any = await res.json()

    expect(body.status).toBe('degraded')
    expect(body.d1).toBe('ok')
    expect(body.kv).toBe('error')
  })
})
