import { describe, expect, it, vi } from 'vitest'
import { Hono } from 'hono'
import { userRoutes } from './users'

function createApp(db: any) {
  const app = new Hono<{ Bindings: any }>()
  app.route('/users', userRoutes)
  return { fetch: (request: Request) => app.fetch(request, { DB: db }) }
}

function chain(result: { first?: unknown; all?: unknown[] } = {}) {
  return {
    bind: vi.fn().mockReturnThis(),
    first: vi.fn().mockResolvedValue(result.first ?? null),
    all: vi.fn().mockResolvedValue({ results: result.all ?? [] }),
    run: vi.fn().mockResolvedValue({ meta: { changes: 1 } }),
  }
}

describe('userRoutes database contract', () => {
  it('用户列表读取 name 列而不是不存在的 username', async () => {
    const db = {
      prepare: vi.fn((sql: string) => sql.includes('COUNT')
        ? chain({ first: { total: 1 } })
        : chain({ all: [{ id: 'u1', email: 'a@example.com', name: 'Alice', role: 'viewer' }] })),
    }

    const res = await createApp(db).fetch(new Request('http://localhost/users'))
    expect(res.status).toBe(200)
    const listSql = db.prepare.mock.calls.map((call: string[]) => call[0]).find((sql: string) => sql.includes('ORDER BY'))
    expect(listSql).toContain('name')
    expect(listSql).not.toContain('username')
  })

  it('创建用户写入 canonical name 列', async () => {
    const created = { id: 'u1', email: 'a@example.com', name: 'Alice', role: 'viewer', status: 'active' }
    const db = {
      prepare: vi.fn((sql: string) => {
        if (sql.includes('SELECT id FROM users WHERE email')) return chain({ first: null })
        if (sql.includes('SELECT id, email, name')) return chain({ first: created })
        return chain()
      }),
    }

    const res = await createApp(db).fetch(new Request('http://localhost/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Alice', email: 'a@example.com', password: 'long-password-123', role: 'viewer' }),
    }))

    expect(res.status).toBe(201)
    const insertSql = db.prepare.mock.calls.map((call: string[]) => call[0]).find((sql: string) => sql.includes('INSERT INTO users'))
    expect(insertSql).toContain('(id, email, name, password_hash, role, status)')
    expect(insertSql).not.toContain('username')
  })

  it('拒绝未知角色且不访问数据库', async () => {
    const db = { prepare: vi.fn() }
    const res = await createApp(db).fetch(new Request('http://localhost/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Alice', email: 'a@example.com', password: 'long-password-123', role: 'superuser' }),
    }))
    expect(res.status).toBe(400)
    expect(db.prepare).not.toHaveBeenCalled()
  })

  it('拒绝删除最后一个 active owner', async () => {
    const db = {
      prepare: vi.fn((sql: string) => {
        if (sql.includes('SELECT role, status')) return chain({ first: { role: 'owner', status: 'active' } })
        if (sql.includes('COUNT')) return chain({ first: { count: 1 } })
        return chain()
      }),
    }
    const res = await createApp(db).fetch(new Request('http://localhost/users/u1', { method: 'DELETE' }))
    expect(res.status).toBe(400)
    expect(db.prepare.mock.calls.some((call: string[]) => call[0].startsWith('DELETE'))).toBe(false)
  })
})
