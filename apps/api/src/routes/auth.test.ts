// Braum 布隆 CF 探针 — 认证路由测试

import { describe, it, expect, vi } from 'vitest'
import { Hono } from 'hono'
import { authRoutes } from './auth'
import { createMockKV } from '../test-helpers'
import { hashPassword, signToken } from '../utils/jwt'

function createApp(env: Record<string, unknown>) {
  const app = new Hono<{ Bindings: any }>()
  app.route('/api/v1/auth', authRoutes)
  return { fetch: (req: Request) => app.fetch(req, env) }
}

/** 创建带有指定用户数据的 mock DB */
function mockDBWithUser(user: Record<string, unknown> | null) {
  const chain = {
    bind: vi.fn().mockReturnThis(),
    first: vi.fn().mockResolvedValue(user),
    all: vi.fn().mockResolvedValue({ results: [] }),
    run: vi.fn().mockResolvedValue({ meta: { changes: 1 } }),
  }
  return {
    prepare: vi.fn().mockReturnValue(chain),
    batch: vi.fn().mockResolvedValue([]),
    _chain: chain,
  } as any
}

const ENV_BASE = {
  CACHE: createMockKV(),
  APP_VERSION: '0.1.0',
  JWT_SECRET: 'test-jwt-secret',
  JWT_REFRESH_SECRET: 'test-refresh-secret',
  ADMIN_INITIAL_PASSWORD: 'admin123',
  TELEGRAM_BOT_TOKEN: '',
  ENCRYPTION_KEY: '',
}

describe('POST /api/v1/auth/login', () => {
  it('缺少 email/password → 400', async () => {
    const db = mockDBWithUser(null)
    const app = createApp({ ...ENV_BASE, DB: db })

    const res = await app.fetch(new Request('http://localhost/api/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: '', password: '' }),
    }))
    expect(res.status).toBe(400)
    const body: any = await res.json()
    expect(body.code).toBe(40000)
  })

  it('管理员首次登录（初始密码） → 200 + tokens', async () => {
    // 第一次 first() 返回 null（用户不存在），触发初始管理员创建
    // 第二次 first() 返回新创建的用户
    const passwordHash = await hashPassword('admin123')
    const newUser = {
      id: 'admin-uuid',
      email: 'admin@braum.local',
      name: 'Admin',
      password_hash: passwordHash,
      role: 'owner',
      status: 'active',
    }

    let callCount = 0
    const chain = {
      bind: vi.fn().mockReturnThis(),
      first: vi.fn().mockImplementation(async () => {
        callCount++
        if (callCount === 1) return null // 用户不存在
        return newUser // 创建后查询
      }),
      run: vi.fn().mockResolvedValue({ meta: { changes: 1 } }),
    }
    const db = {
      prepare: vi.fn().mockReturnValue(chain),
      batch: vi.fn().mockResolvedValue([]),
    } as any

    const app = createApp({ ...ENV_BASE, DB: db })
    const res = await app.fetch(new Request('http://localhost/api/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@braum.local', password: 'admin123' }),
    }))

    expect(res.status).toBe(200)
    const body: any = await res.json()
    expect(body.code).toBe(0)
    expect(body.data.access_token).toBeDefined()
    expect(body.data.refresh_token).toBeDefined()
    expect(body.data.user.email).toBe('admin@braum.local')
  })

  it('管理员初始密码错误 → 401', async () => {
    const db = mockDBWithUser(null)
    const app = createApp({ ...ENV_BASE, DB: db })

    const res = await app.fetch(new Request('http://localhost/api/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@braum.local', password: 'wrong' }),
    }))
    expect(res.status).toBe(401)
  })

  it('已有用户正确密码登录 → 200 + tokens', async () => {
    const passwordHash = await hashPassword('my-password')
    const user = {
      id: 'user-1',
      email: 'test@example.com',
      name: 'Test',
      password_hash: passwordHash,
      role: 'admin',
      status: 'active',
    }
    const db = mockDBWithUser(user)
    const app = createApp({ ...ENV_BASE, DB: db })

    const res = await app.fetch(new Request('http://localhost/api/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'test@example.com', password: 'my-password' }),
    }))

    expect(res.status).toBe(200)
    const body: any = await res.json()
    expect(body.data.access_token).toBeDefined()
    expect(body.data.user.id).toBe('user-1')
  })

  it('最后登录时间写入失败时仍可登录', async () => {
    const passwordHash = await hashPassword('my-password')
    const user = {
      id: 'user-1',
      email: 'test@example.com',
      name: 'Test',
      password_hash: passwordHash,
      role: 'admin',
      status: 'active',
    }
    const db = mockDBWithUser(user)
    db.prepare.mockImplementation((sql: string) => {
      if (sql.includes('last_login_at')) {
        return {
          bind: vi.fn().mockReturnThis(),
          run: vi.fn().mockRejectedValue(new Error('no such column: last_login_at')),
        }
      }
      return db._chain
    })
    const app = createApp({ ...ENV_BASE, DB: db })

    const res = await app.fetch(new Request('http://localhost/api/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'test@example.com', password: 'my-password' }),
    }))

    expect(res.status).toBe(200)
    const body: any = await res.json()
    expect(body.data.access_token).toBeDefined()
  })

  it('JWT Secret 缺失时返回明确的 503', async () => {
    const passwordHash = await hashPassword('my-password')
    const user = {
      id: 'user-1',
      email: 'test@example.com',
      name: 'Test',
      password_hash: passwordHash,
      role: 'admin',
      status: 'active',
    }
    const db = mockDBWithUser(user)
    const app = createApp({
      ...ENV_BASE,
      DB: db,
      JWT_SECRET: '',
      JWT_REFRESH_SECRET: '',
    })

    const res = await app.fetch(new Request('http://localhost/api/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'test@example.com', password: 'my-password' }),
    }))

    expect(res.status).toBe(503)
    const body: any = await res.json()
    expect(body.code).toBe(50301)
    expect(body.message).toContain('JWT Secret')
  })

  it('密码错误 → 401', async () => {
    const passwordHash = await hashPassword('correct')
    const user = {
      id: 'user-1', email: 'test@example.com', name: 'Test',
      password_hash: passwordHash, role: 'admin', status: 'active',
    }
    const db = mockDBWithUser(user)
    const app = createApp({ ...ENV_BASE, DB: db })

    const res = await app.fetch(new Request('http://localhost/api/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'test@example.com', password: 'wrong' }),
    }))
    expect(res.status).toBe(401)
  })

  it('用户无 password_hash → 401', async () => {
    const user = {
      id: 'user-1', email: 'test@example.com', name: 'Test',
      password_hash: null, role: 'admin', status: 'active',
    }
    const db = mockDBWithUser(user)
    const app = createApp({ ...ENV_BASE, DB: db })

    const res = await app.fetch(new Request('http://localhost/api/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'test@example.com', password: 'any' }),
    }))
    expect(res.status).toBe(401)
    const body: any = await res.json()
    expect(body.message).toContain('not activated')
  })
})

describe('POST /api/v1/auth/refresh', () => {
  it('缺少 refresh_token → 400', async () => {
    const db = mockDBWithUser(null)
    const app = createApp({ ...ENV_BASE, DB: db })

    const res = await app.fetch(new Request('http://localhost/api/v1/auth/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    }))
    expect(res.status).toBe(400)
  })

  it('无效 refresh_token → 401', async () => {
    const db = mockDBWithUser(null)
    const app = createApp({ ...ENV_BASE, DB: db })

    const res = await app.fetch(new Request('http://localhost/api/v1/auth/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: 'invalid-token' }),
    }))
    expect(res.status).toBe(401)
  })

  it('有效 refresh_token 但用户不存在 → 401', async () => {
    const refreshToken = await signToken(
      { sub: 'non-existent', type: 'refresh' },
      'test-refresh-secret',
      604800
    )
    const db = mockDBWithUser(null)
    const app = createApp({ ...ENV_BASE, DB: db })

    const res = await app.fetch(new Request('http://localhost/api/v1/auth/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refreshToken }),
    }))
    expect(res.status).toBe(401)
  })
})

describe('POST /api/v1/auth/logout', () => {
  it('返回成功', async () => {
    const db = mockDBWithUser(null)
    const app = createApp({ ...ENV_BASE, DB: db })

    const res = await app.fetch(new Request('http://localhost/api/v1/auth/logout', {
      method: 'POST',
    }))
    expect(res.status).toBe(200)
    const body: any = await res.json()
    expect(body.code).toBe(0)
  })
})

describe('GET /api/v1/auth/me', () => {
  it('无 token → 401', async () => {
    const db = mockDBWithUser(null)
    const app = createApp({ ...ENV_BASE, DB: db })

    const res = await app.fetch(new Request('http://localhost/api/v1/auth/me'))
    expect(res.status).toBe(401)
  })

  it('有效 token → 返回用户信息', async () => {
    const token = await signToken(
      { sub: 'user-1', email: 'test@example.com', role: 'admin' },
      'test-jwt-secret'
    )
    const user = { id: 'user-1', email: 'test@example.com', name: 'Test', role: 'admin', avatar_url: null, status: 'active' }
    const db = mockDBWithUser(user)
    const app = createApp({ ...ENV_BASE, DB: db })

    const res = await app.fetch(new Request('http://localhost/api/v1/auth/me', {
      headers: { Authorization: `Bearer ${token}` },
    }))

    expect(res.status).toBe(200)
    const body: any = await res.json()
    expect(body.data.email).toBe('test@example.com')
  })

  it('过期 token → 401', async () => {
    const token = await signToken({ sub: 'user-1' }, 'test-jwt-secret', -1)
    const db = mockDBWithUser(null)
    const app = createApp({ ...ENV_BASE, DB: db })

    const res = await app.fetch(new Request('http://localhost/api/v1/auth/me', {
      headers: { Authorization: `Bearer ${token}` },
    }))
    expect(res.status).toBe(401)
  })
})
