// Braum 布隆 CF 探针 — 认证路由

import { Hono } from 'hono'
import type { Env } from '../env'
import { success, unauthorized, badRequest } from '../utils/response'
import {
  signToken,
  verifyToken,
  hashPassword,
  isPasswordHashUnsupported,
  needsPasswordRehash,
  verifyPassword,
} from '../utils/jwt'
import { writeAuditLog } from '../utils/audit'

export const authRoutes = new Hono<{ Bindings: Env }>()

function configuredAdminEmail(env: Env): string | null {
  const email = env.ADMIN_INITIAL_EMAIL?.trim()
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null
  return email
}

// POST /api/v1/auth/login — 登录
authRoutes.post('/login', async (c) => {
  const body = await c.req.json()
  const email = typeof body.email === 'string' ? body.email.trim() : ''
  const password = typeof body.password === 'string' ? body.password : ''

  if (!email || !password) {
    return c.json(badRequest('Missing email or password'), 400)
  }

  const user = await c.env.DB.prepare(
    'SELECT * FROM users WHERE email = ? AND status = ?'
  ).bind(email, 'active').first() as Record<string, unknown> | null

  // 首次登录时，用 ADMIN_INITIAL_PASSWORD 初始化管理员密码哈希
  if (!user) {
    const adminEmail = configuredAdminEmail(c.env)
    if (!adminEmail) {
      return c.json({
        code: 50302,
        message: '初始管理员邮箱尚未配置，请在 Cloudflare Worker 中添加有效的 ADMIN_INITIAL_EMAIL',
        data: null,
      }, 503)
    }

    if (email === adminEmail) {
      const initialPassword = c.env.ADMIN_INITIAL_PASSWORD
      if (initialPassword && password === initialPassword) {
        const hashed = await hashPassword(password)
        await c.env.DB.prepare(
          `INSERT OR IGNORE INTO users (id, email, name, password_hash, role, status)
           VALUES (?, ?, ?, ?, ?, ?)`
        ).bind(
          crypto.randomUUID(),
          adminEmail,
          'Admin',
          hashed,
          'owner',
          'active'
        ).run()

        // 重新查询刚插入的用户
        const newUser = await c.env.DB.prepare(
          'SELECT * FROM users WHERE email = ? AND status = ?'
        ).bind(email, 'active').first() as Record<string, unknown> | null

        if (newUser) {
          return issueTokens(c, newUser)
        }
      }
    }
    return c.json(unauthorized('Invalid credentials'), 401)
  }

  if (!user.password_hash) {
    return c.json(unauthorized('Account not activated'), 401)
  }

  // 验证密码哈希
  let isValid = await verifyPassword(password, user.password_hash as string)

  // 早期版本生成过 210,000 次 PBKDF2 哈希，超过 Workers 的 100,000 次上限。
  // 仅允许 Owner 使用仍保存在 Worker Secret 中的初始密码完成一次性安全迁移。
  const adminEmail = configuredAdminEmail(c.env)
  if (
    !isValid
    && adminEmail !== null
    && email === adminEmail
    && password === c.env.ADMIN_INITIAL_PASSWORD
    && isPasswordHashUnsupported(user.password_hash as string)
  ) {
    const recoveredHash = await hashPassword(password)
    await c.env.DB.prepare(
      'UPDATE users SET password_hash = ? WHERE id = ?'
    ).bind(recoveredHash, user.id as string).run()
    user.password_hash = recoveredHash
    isValid = true
    console.warn(JSON.stringify({
      event: 'password_hash_recovered',
      user_id: user.id,
    }))
  }

  if (!isValid) {
    return c.json(unauthorized('Invalid credentials'), 401)
  }

  if (needsPasswordRehash(user.password_hash as string)) {
    try {
      const upgradedHash = await hashPassword(password)
      await c.env.DB.prepare(
        "UPDATE users SET password_hash = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?"
      ).bind(upgradedHash, user.id as string).run()
    } catch (error) {
      // 密码已经验证成功；旧库暂时无法升级哈希时不应阻止用户登录。
      console.error(JSON.stringify({
        event: 'password_rehash_error',
        message: error instanceof Error ? error.message : 'Unknown error',
        user_id: user.id,
      }))
    }
  }

  await writeAuditLog(c.env, {
    user_id: user.id as string,
    action: 'login',
    object_type: 'user',
    object_id: user.id as string,
    ip_address: c.req.header('CF-Connecting-IP'),
    user_agent: c.req.header('User-Agent'),
  })

  return issueTokens(c, user)
})

// POST /api/v1/auth/refresh — 刷新 Token
authRoutes.post('/refresh', async (c) => {
  const body = await c.req.json()
  const { refresh_token } = body

  if (!refresh_token) {
    return c.json(badRequest('Missing refresh_token'), 400)
  }

  const payload = await verifyToken(refresh_token, c.env.JWT_REFRESH_SECRET)
  if (!payload || payload.type !== 'refresh') {
    return c.json(unauthorized('Invalid or expired refresh token'), 401)
  }

  // 查询用户是否仍有效
  const user = await c.env.DB.prepare(
    'SELECT id, email, name, role FROM users WHERE id = ? AND status = ?'
  ).bind(payload.sub as string, 'active').first() as Record<string, unknown> | null

  if (!user) {
    return c.json(unauthorized('User not found or inactive'), 401)
  }

  return issueTokens(c, user)
})

// POST /api/v1/auth/logout — 登出
authRoutes.post('/logout', async (c) => {
  // 客户端清除 Token 即可，服务端可选黑名单机制
  return c.json(success(null))
})

// GET /api/v1/auth/me — 当前用户信息（需要鉴权）
authRoutes.get('/me', async (c) => {
  const authHeader = c.req.header('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return c.json(unauthorized('Missing token'), 401)
  }

  const token = authHeader.slice(7)
  const payload = await verifyToken(token, c.env.JWT_SECRET)
  if (!payload) {
    return c.json(unauthorized('Invalid or expired token'), 401)
  }

  const user = await c.env.DB.prepare(
    'SELECT id, email, name, role, avatar_url, status FROM users WHERE id = ?'
  ).bind(payload.sub as string).first()

  if (!user) return c.json(unauthorized('User not found'), 401)

  return c.json(success(user))
})

/**
 * 签发 access_token + refresh_token 并返回
 */
async function issueTokens(c: { env: Env; json: (data: unknown, status?: number) => Response }, user: Record<string, unknown>) {
  if (!c.env.JWT_SECRET || !c.env.JWT_REFRESH_SECRET) {
    console.error(JSON.stringify({
      event: 'auth_config_error',
      message: 'JWT_SECRET or JWT_REFRESH_SECRET is not configured',
    }))
    return c.json({
      code: 50301,
      message: '登录服务尚未配置，请在 Cloudflare Worker 中添加 JWT Secret 后重新部署',
      data: null,
    }, 503)
  }

  const accessToken = await signToken(
    { sub: user.id, email: user.email, role: user.role },
    c.env.JWT_SECRET,
    86400 // 24h
  )

  const refreshToken = await signToken(
    { sub: user.id, type: 'refresh' },
    c.env.JWT_REFRESH_SECRET,
    604800 // 7d
  )

  // 令牌已经签发；旧库字段差异或临时 D1 写入失败不应阻止登录。
  try {
    await c.env.DB.prepare(
      "UPDATE users SET last_login_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?"
    ).bind(user.id as string).run()
  } catch (error) {
    console.error(JSON.stringify({
      event: 'last_login_update_error',
      message: error instanceof Error ? error.message : 'Unknown error',
      user_id: user.id,
    }))
  }

  return c.json(success({
    access_token: accessToken,
    refresh_token: refreshToken,
    expires_in: 86400,
    user: { id: user.id, email: user.email, name: user.name, role: user.role },
  }))
}
