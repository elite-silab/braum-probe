// Braum 布隆 CF 探针 — 用户管理路由

import { Hono } from 'hono'
import type { Env } from '../env'
import { success, paginated, notFound, badRequest } from '../utils/response'
import { writeAuditLog } from '../utils/audit'
import { hashPassword } from '../utils/jwt'

export const userRoutes = new Hono<{ Bindings: Env }>()

const USER_ROLES = new Set(['owner', 'admin', 'viewer'])
const USER_STATUSES = new Set(['active', 'disabled'])

function isValidEmail(value: unknown): value is string {
  return typeof value === 'string' && value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

function isValidPassword(value: unknown): value is string {
  return typeof value === 'string' && value.length >= 12 && value.length <= 128
}

// GET /api/admin/v1/users — 用户列表
userRoutes.get('/', async (c) => {
  const page = Number(c.req.query('page') || '1')
  const pageSize = Number(c.req.query('page_size') || '20')
  const offset = (page - 1) * pageSize

  const countResult = await c.env.DB.prepare('SELECT COUNT(*) as total FROM users').first() as { total: number }
  const users = await c.env.DB.prepare(
    'SELECT id, email, name, role, status, created_at, updated_at FROM users ORDER BY created_at DESC LIMIT ? OFFSET ?'
  ).bind(pageSize, offset).all()

  return c.json(paginated(users.results || [], {
    page,
    page_size: pageSize,
    total: countResult.total,
    total_pages: Math.ceil(countResult.total / pageSize),
  }))
})

// GET /api/admin/v1/users/:id — 用户详情
userRoutes.get('/:id', async (c) => {
  const id = c.req.param('id')
  const user = await c.env.DB.prepare(
    'SELECT id, email, name, role, status, created_at, updated_at FROM users WHERE id = ?'
  ).bind(id).first()

  if (!user) {
    return c.json(notFound('User not found'), 404)
  }

  return c.json(success(user))
})

// POST /api/admin/v1/users — 创建用户
userRoutes.post('/', async (c) => {
  const body = await c.req.json()
  const { name, email, password, role = 'viewer' } = body

  if (typeof name !== 'string' || !name.trim() || name.length > 100 || !isValidEmail(email) || !isValidPassword(password)) {
    return c.json(badRequest('Invalid name, email, or password (12-128 characters required)'), 400)
  }
  if (!USER_ROLES.has(role)) {
    return c.json(badRequest('Invalid role'), 400)
  }

  // 检查邮箱是否已存在
  const existing = await c.env.DB.prepare(
    'SELECT id FROM users WHERE email = ?'
  ).bind(email).first()

  if (existing) {
    return c.json(badRequest('Email already exists'), 409)
  }

  const id = crypto.randomUUID()
  const passwordHash = await hashPassword(password)

  await c.env.DB.prepare(
    `INSERT INTO users (id, email, name, password_hash, role, status)
     VALUES (?, ?, ?, ?, ?, 'active')`
  ).bind(id, email, name.trim(), passwordHash, role).run()

  const user = await c.env.DB.prepare(
    'SELECT id, email, name, role, status, created_at, updated_at FROM users WHERE id = ?'
  ).bind(id).first()

  await writeAuditLog(c.env, {
    user_id: c.get('userId' as never) as string | undefined,
    action: 'create',
    object_type: 'user',
    object_id: id,
    changes: { name: name.trim(), email, role },
    ip_address: c.req.header('CF-Connecting-IP'),
  })

  return c.json(success(user), 201)
})

// PUT /api/admin/v1/users/:id — 更新用户
userRoutes.put('/:id', async (c) => {
  const id = c.req.param('id')
  const body = await c.req.json()

  const existing = await c.env.DB.prepare(
    'SELECT id, role, status FROM users WHERE id = ?'
  ).bind(id).first() as { id: string; role: string; status: string } | null
  if (!existing) {
    return c.json(notFound('User not found'), 404)
  }

  const fields: string[] = []
  const values: unknown[] = []

  // 允许更新的字段
  if (body.name !== undefined) {
    if (typeof body.name !== 'string' || !body.name.trim() || body.name.length > 100) {
      return c.json(badRequest('Invalid name'), 400)
    }
    fields.push('name = ?')
    values.push(body.name.trim())
  }
  if (body.email !== undefined) {
    if (!isValidEmail(body.email)) return c.json(badRequest('Invalid email'), 400)
    fields.push('email = ?')
    values.push(body.email)
  }
  if (body.role !== undefined) {
    if (!USER_ROLES.has(body.role)) return c.json(badRequest('Invalid role'), 400)
    fields.push('role = ?')
    values.push(body.role)
  }
  if (body.status !== undefined) {
    if (!USER_STATUSES.has(body.status)) return c.json(badRequest('Invalid status'), 400)
    fields.push('status = ?')
    values.push(body.status)
  }
  if (body.password !== undefined) {
    if (!isValidPassword(body.password)) {
      return c.json(badRequest('Password must be 12-128 characters'), 400)
    }
    const passwordHash = await hashPassword(body.password)
    fields.push('password_hash = ?')
    values.push(passwordHash)
  }

  const removesActiveOwner = existing.role === 'owner' && existing.status === 'active'
    && ((body.role !== undefined && body.role !== 'owner')
      || (body.status !== undefined && body.status !== 'active'))
  if (removesActiveOwner) {
    const ownerCount = await c.env.DB.prepare(
      "SELECT COUNT(*) as count FROM users WHERE role = 'owner' AND status = 'active'"
    ).first() as { count: number }
    if (ownerCount.count <= 1) {
      return c.json(badRequest('Cannot demote or disable the last active owner'), 400)
    }
  }

  if (fields.length > 0) {
    fields.push("updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')")
    values.push(id)
    await c.env.DB.prepare(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`).bind(...values).run()
  }

  const user = await c.env.DB.prepare(
    'SELECT id, email, name, role, status, created_at, updated_at FROM users WHERE id = ?'
  ).bind(id).first()

  await writeAuditLog(c.env, {
    user_id: c.get('userId' as never) as string | undefined,
    action: 'update',
    object_type: 'user',
    object_id: id,
    changes: body,
    ip_address: c.req.header('CF-Connecting-IP'),
  })

  return c.json(success(user))
})

// DELETE /api/admin/v1/users/:id — 删除用户
userRoutes.delete('/:id', async (c) => {
  const id = c.req.param('id')

  // 防止删除最后一个有效 Owner
  const user = await c.env.DB.prepare('SELECT role, status FROM users WHERE id = ?').bind(id).first() as {
    role: string
    status: string
  } | null
  if (!user) {
    return c.json(notFound('User not found'), 404)
  }
  if (user.role === 'owner' && user.status === 'active') {
    const ownerCount = await c.env.DB.prepare(
      "SELECT COUNT(*) as count FROM users WHERE role = 'owner' AND status = 'active'"
    ).first() as { count: number }

    if (ownerCount.count <= 1) {
      return c.json(badRequest('Cannot delete the last active owner'), 400)
    }
  }

  await c.env.DB.prepare('DELETE FROM users WHERE id = ?').bind(id).run()

  await writeAuditLog(c.env, {
    user_id: c.get('userId' as never) as string | undefined,
    action: 'delete',
    object_type: 'user',
    object_id: id,
    ip_address: c.req.header('CF-Connecting-IP'),
  })

  return c.json(success(null))
})
