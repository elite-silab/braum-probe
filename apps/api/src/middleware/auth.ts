// Braum 布隆 CF 探针 — JWT 鉴权中间件

import { createMiddleware } from 'hono/factory'
import type { Env } from '../env'
import { forbidden, unauthorized } from '../utils/response'
import { verifyToken } from '../utils/jwt'

export const authMiddleware = createMiddleware<{ Bindings: Env }>(async (c, next) => {
  const authHeader = c.req.header('Authorization')

  if (!authHeader?.startsWith('Bearer ')) {
    return c.json(unauthorized('Missing Authorization header'), 401)
  }

  const token = authHeader.slice(7)
  const payload = await verifyToken(token, c.env.JWT_SECRET)

  if (!payload || typeof payload.sub !== 'string') {
    return c.json(unauthorized('Invalid or expired token'), 401)
  }

  // 每次请求读取账号的当前状态和角色，避免禁用/降权后旧 JWT 继续生效。
  const user = await c.env.DB.prepare(
    'SELECT id, role, status FROM users WHERE id = ?'
  ).bind(payload.sub).first() as { id: string; role: string; status: string } | null

  if (!user || user.status !== 'active') {
    return c.json(unauthorized('User not found or inactive'), 401)
  }

  // 将用户信息注入上下文
  c.set('userId' as never, user.id)
  c.set('userRole' as never, user.role)

  await next()
})

/** 仅允许特定角色访问 */
export const requireRole = (...roles: string[]) => {
  return createMiddleware<{ Bindings: Env }>(async (c, next) => {
    const role = c.get('userRole' as never) as string | undefined

    if (!role || !roles.includes(role)) {
      return c.json(forbidden('Insufficient permissions'), 403)
    }

    await next()
  })
}

/** GET/HEAD/OPTIONS 允许已登录用户读取，其余方法要求指定角色。 */
export const requireRoleForMutation = (...roles: string[]) => {
  const safeMethods = new Set(['GET', 'HEAD', 'OPTIONS'])

  return createMiddleware<{ Bindings: Env }>(async (c, next) => {
    if (safeMethods.has(c.req.method)) {
      await next()
      return
    }

    const role = c.get('userRole' as never) as string | undefined
    if (!role || !roles.includes(role)) {
      return c.json(forbidden('Insufficient permissions'), 403)
    }

    await next()
  })
}

/** 仅当请求方法匹配时执行角色检查。 */
export const requireRoleForMethods = (methods: string[], ...roles: string[]) => {
  const protectedMethods = new Set(methods.map((method) => method.toUpperCase()))

  return createMiddleware<{ Bindings: Env }>(async (c, next) => {
    if (!protectedMethods.has(c.req.method)) {
      await next()
      return
    }

    const role = c.get('userRole' as never) as string | undefined
    if (!role || !roles.includes(role)) {
      return c.json(forbidden('Insufficient permissions'), 403)
    }

    await next()
  })
}
