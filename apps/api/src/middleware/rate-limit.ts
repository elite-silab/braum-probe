// Braum 布隆 CF 探针 — 低写入限流中间件

import { createMiddleware } from 'hono/factory'
import type { Env } from '../env'

interface RateLimitOptions {
  /** 不同接口组使用独立计数空间，避免彼此消耗额度。 */
  scope?: string
  /** 仅低频敏感接口启用 KV 协同；KV 异常时自动退回进程内限流。 */
  distributed?: boolean
}

interface MemoryBucket {
  count: number
  expiresAt: number
}

const memoryBuckets = new Map<string, MemoryBucket>()
let lastCleanupAt = 0

function cleanupExpiredBuckets(now: number): void {
  if (memoryBuckets.size < 1_000 && now - lastCleanupAt < 60_000) return
  for (const [key, bucket] of memoryBuckets) {
    if (bucket.expiresAt <= now) memoryBuckets.delete(key)
  }
  lastCleanupAt = now
}

function consumeMemoryBucket(key: string, maxRequests: number, expiresAt: number, now: number): boolean {
  cleanupExpiredBuckets(now)
  const existing = memoryBuckets.get(key)
  const bucket = !existing || existing.expiresAt <= now
    ? { count: 0, expiresAt }
    : existing
  if (bucket.count >= maxRequests) return false
  bucket.count += 1
  memoryBuckets.set(key, bucket)
  return true
}

function clientIp(header: string | undefined): string {
  return (header || 'unknown').split(',')[0].trim().slice(0, 100) || 'unknown'
}

/**
 * 高频请求默认只使用 Worker isolate 内存，避免 Cloudflare KV 免费额度被
 * Agent 心跳和 WebSocket 握手快速耗尽。登录等低频敏感接口可开启 KV
 * 协同；KV 达到额度或临时不可用时，仍由进程内计数兜底，不返回 500。
 */
export const rateLimit = (
  maxRequests = 60,
  windowSeconds = 60,
  options: RateLimitOptions = {},
) => {
  const scope = options.scope || 'default'
  const windowMs = windowSeconds * 1_000

  return createMiddleware<{ Bindings: Env }>(async (c, next) => {
    const ip = clientIp(c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For'))
    const now = Date.now()
    const windowId = Math.floor(now / windowMs)
    const expiresAt = (windowId + 1) * windowMs
    const key = `ratelimit:${scope}:${ip}:${windowId}`

    if (!consumeMemoryBucket(key, maxRequests, expiresAt, now)) {
      return c.json({ code: 42900, message: 'Too many requests', data: null }, 429)
    }

    if (options.distributed) {
      try {
        const current = await c.env.CACHE.get(key, { type: 'text' })
        const count = current ? Number.parseInt(current, 10) : 0
        if (Number.isFinite(count) && count >= maxRequests) {
          return c.json({ code: 42900, message: 'Too many requests', data: null }, 429)
        }
        await c.env.CACHE.put(key, String((Number.isFinite(count) ? count : 0) + 1), {
          expirationTtl: windowSeconds + 10,
        })
      } catch (error) {
        console.warn(JSON.stringify({
          event: 'rate_limit_kv_unavailable',
          scope,
          message: error instanceof Error ? error.message : String(error),
        }))
      }
    }

    await next()
  })
}
