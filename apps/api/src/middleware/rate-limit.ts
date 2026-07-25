// Braum 布隆 CF 探针 — KV 限流中间件

import { createMiddleware } from 'hono/factory'
import type { Env } from '../env'

/**
 * 基于 KV 的滑动窗口限流
 * 默认：每 IP 每分钟 60 次请求
 */
export const rateLimit = (maxRequests = 60, windowSeconds = 60) => {
  return createMiddleware<{ Bindings: Env }>(async (c, next) => {
    const ip = c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For') || 'unknown'
    const minute = Math.floor(Date.now() / 1000 / windowSeconds)
    const key = `ratelimit:${ip}:${minute}`

    const current = await c.env.CACHE.get(key, { type: 'text' })
    const count = current ? parseInt(current, 10) : 0

    if (count >= maxRequests) {
      return c.json({ code: 42900, message: 'Too many requests', data: null }, 429)
    }

    await c.env.CACHE.put(key, String(count + 1), { expirationTtl: windowSeconds + 10 })
    await next()
  })
}
