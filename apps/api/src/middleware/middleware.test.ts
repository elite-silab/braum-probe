// Braum 布隆 CF 探针 — 中间件测试

import { describe, it, expect, vi } from 'vitest'
import { Hono } from 'hono'
import { authMiddleware, requireRole, requireRoleForMutation } from './auth'
import { rateLimit } from './rate-limit'
import { createMockKV } from '../test-helpers'
import { signToken } from '../utils/jwt'

const JWT_SECRET = 'test-jwt-secret'

function createAuthApp(middlewares: any[], handler?: (c: any) => Response) {
  const app = new Hono<{ Bindings: any }>()
  for (const mw of middlewares) {
    app.use('/protected', mw)
  }
  app.get('/protected', handler || ((c) => c.json({ ok: true })))
  return app
}

function activeUserDB(role: 'owner' | 'admin' | 'viewer' = 'admin', status = 'active') {
  const chain = {
    bind: vi.fn().mockReturnThis(),
    first: vi.fn().mockResolvedValue({ id: 'user-1', role, status }),
  }
  return {
    prepare: vi.fn().mockReturnValue(chain),
    _chain: chain,
  }
}

describe('authMiddleware', () => {
  const env = { JWT_SECRET, DB: activeUserDB() }

  it('无 Authorization header → 401', async () => {
    const app = createAuthApp([authMiddleware])
    const res = await app.fetch(new Request('http://localhost/protected'), env)
    expect(res.status).toBe(401)
    const body: any = await res.json()
    expect(body.message).toContain('Missing')
  })

  it('无效 token → 401', async () => {
    const app = createAuthApp([authMiddleware])
    const res = await app.fetch(
      new Request('http://localhost/protected', {
        headers: { Authorization: 'Bearer invalid-token' },
      }),
      env
    )
    expect(res.status).toBe(401)
    const body: any = await res.json()
    expect(body.message).toContain('Invalid')
  })

  it('有效 token → 通过', async () => {
    const token = await signToken({ sub: 'user-1', role: 'admin' }, JWT_SECRET)
    const app = createAuthApp([authMiddleware])
    const res = await app.fetch(
      new Request('http://localhost/protected', {
        headers: { Authorization: `Bearer ${token}` },
      }),
      env
    )
    expect(res.status).toBe(200)
  })

  it('使用数据库中的当前角色，而不是 JWT 中的旧角色', async () => {
    const token = await signToken({ sub: 'user-1', role: 'owner' }, JWT_SECRET)
    const app = createAuthApp([authMiddleware, requireRole('owner')])
    const res = await app.fetch(
      new Request('http://localhost/protected', {
        headers: { Authorization: `Bearer ${token}` },
      }),
      { JWT_SECRET, DB: activeUserDB('viewer') }
    )
    expect(res.status).toBe(403)
  })

  it('已禁用用户即使持有有效 token 也被拒绝', async () => {
    const token = await signToken({ sub: 'user-1', role: 'admin' }, JWT_SECRET)
    const app = createAuthApp([authMiddleware])
    const res = await app.fetch(
      new Request('http://localhost/protected', {
        headers: { Authorization: `Bearer ${token}` },
      }),
      { JWT_SECRET, DB: activeUserDB('admin', 'disabled') }
    )
    expect(res.status).toBe(401)
  })

  it('过期 token → 401', async () => {
    const token = await signToken({ sub: 'user-1' }, JWT_SECRET, -1)
    const app = createAuthApp([authMiddleware])
    const res = await app.fetch(
      new Request('http://localhost/protected', {
        headers: { Authorization: `Bearer ${token}` },
      }),
      env
    )
    expect(res.status).toBe(401)
  })

  it('非 Bearer 格式 → 401', async () => {
    const app = createAuthApp([authMiddleware])
    const res = await app.fetch(
      new Request('http://localhost/protected', {
        headers: { Authorization: 'Basic dXNlcjpwYXNz' },
      }),
      env
    )
    expect(res.status).toBe(401)
  })
})

describe('requireRole', () => {
  const env = { JWT_SECRET, DB: activeUserDB() }

  it('允许指定角色访问', async () => {
    const token = await signToken({ sub: 'user-1', role: 'admin' }, JWT_SECRET)
    const app = createAuthApp([authMiddleware, requireRole('admin')])
    const res = await app.fetch(
      new Request('http://localhost/protected', {
        headers: { Authorization: `Bearer ${token}` },
      }),
      env
    )
    expect(res.status).toBe(200)
  })

  it('非允许角色 → 403', async () => {
    const token = await signToken({ sub: 'user-1', role: 'viewer' }, JWT_SECRET)
    const app = createAuthApp([authMiddleware, requireRole('admin', 'owner')])
    const res = await app.fetch(
      new Request('http://localhost/protected', {
        headers: { Authorization: `Bearer ${token}` },
      }),
      { JWT_SECRET, DB: activeUserDB('viewer') }
    )
    expect(res.status).toBe(403)
  })

  it('多角色中匹配一个即可', async () => {
    const token = await signToken({ sub: 'user-1', role: 'owner' }, JWT_SECRET)
    const app = createAuthApp([authMiddleware, requireRole('admin', 'owner')])
    const res = await app.fetch(
      new Request('http://localhost/protected', {
        headers: { Authorization: `Bearer ${token}` },
      }),
      { JWT_SECRET, DB: activeUserDB('owner') }
    )
    expect(res.status).toBe(200)
  })
})

describe('requireRoleForMutation', () => {
  it('viewer 可以读取管理资源', async () => {
    const token = await signToken({ sub: 'user-1', role: 'viewer' }, JWT_SECRET)
    const app = createAuthApp([authMiddleware, requireRoleForMutation('admin', 'owner')])
    const res = await app.fetch(new Request('http://localhost/protected', {
      headers: { Authorization: `Bearer ${token}` },
    }), { JWT_SECRET, DB: activeUserDB('viewer') })
    expect(res.status).toBe(200)
  })

  it('viewer 不能修改管理资源', async () => {
    const token = await signToken({ sub: 'user-1', role: 'viewer' }, JWT_SECRET)
    const app = new Hono<{ Bindings: any }>()
    app.use('/protected', authMiddleware, requireRoleForMutation('admin', 'owner'))
    app.put('/protected', (c) => c.json({ ok: true }))

    const res = await app.fetch(new Request('http://localhost/protected', {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}` },
    }), { JWT_SECRET, DB: activeUserDB('viewer') })
    expect(res.status).toBe(403)
  })

  it('admin 可以修改业务资源', async () => {
    const token = await signToken({ sub: 'user-1', role: 'admin' }, JWT_SECRET)
    const app = new Hono<{ Bindings: any }>()
    app.use('/protected', authMiddleware, requireRoleForMutation('admin', 'owner'))
    app.delete('/protected', (c) => c.json({ ok: true }))

    const res = await app.fetch(new Request('http://localhost/protected', {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    }), { JWT_SECRET, DB: activeUserDB('admin') })
    expect(res.status).toBe(200)
  })
})

describe('rateLimit', () => {
  it('未超限 → 通过', async () => {
    const cache = createMockKV()
    const app = new Hono<{ Bindings: any }>()
    app.use('/api', rateLimit(10, 60))
    app.get('/api', (c) => c.json({ ok: true }))

    const res = await app.fetch(
      new Request('http://localhost/api', {
        headers: { 'CF-Connecting-IP': '1.2.3.4' },
      }),
      { CACHE: cache }
    )
    expect(res.status).toBe(200)
  })

  it('超限 → 429', async () => {
    // KV mock 对所有 ratelimit: key 返回超限计数
    const cache = {
      get: vi.fn(async () => '10'),
      put: vi.fn(),
      delete: vi.fn(),
    } as any
    const app = new Hono<{ Bindings: any }>()
    app.use('/api', rateLimit(10, 60))
    app.get('/api', (c) => c.json({ ok: true }))

    const res = await app.fetch(
      new Request('http://localhost/api', {
        headers: { 'CF-Connecting-IP': '1.2.3.4' },
      }),
      { CACHE: cache }
    )
    expect(res.status).toBe(429)
    const body: any = await res.json()
    expect(body.code).toBe(42900)
  })

  it('不同 IP 独立计数', async () => {
    // 对 1.1.1.1 返回超限，对 2.2.2.2 返回空
    const cache = {
      get: vi.fn(async (key: string) => {
        if (key.includes('1.1.1.1')) return '10'
        return null
      }),
      put: vi.fn(),
      delete: vi.fn(),
    } as any
    const app = new Hono<{ Bindings: any }>()
    app.use('/api', rateLimit(10, 60))
    app.get('/api', (c) => c.json({ ok: true }))

    // IP 1.1.1.1 已超限
    const res1 = await app.fetch(
      new Request('http://localhost/api', {
        headers: { 'CF-Connecting-IP': '1.1.1.1' },
      }),
      { CACHE: cache }
    )
    expect(res1.status).toBe(429)

    // IP 2.2.2.2 未超限
    const res2 = await app.fetch(
      new Request('http://localhost/api', {
        headers: { 'CF-Connecting-IP': '2.2.2.2' },
      }),
      { CACHE: cache }
    )
    expect(res2.status).toBe(200)
  })
})
