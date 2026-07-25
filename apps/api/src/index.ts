// Braum 布隆 CF 探针 — Workers 入口

import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { createMiddleware } from 'hono/factory'
import { secureHeaders } from 'hono/secure-headers'
import type { Env } from './env'
import { healthRoutes } from './routes/health'
import { nodeRoutes } from './routes/nodes'
import { targetRoutes } from './routes/targets'
import { probeResultRoutes } from './routes/probe-results'
import { alertRoutes } from './routes/alerts'
import { incidentRoutes } from './routes/incidents'
import { authRoutes } from './routes/auth'
import { settingsRoutes } from './routes/settings'
import { auditLogRoutes } from './routes/audit-logs'
import { userRoutes } from './routes/users'
import { agentRoutes } from './routes/agent'
import { agentAdminRoutes } from './routes/agent-admin'
import { authMiddleware, requireRoleForMethods, requireRoleForMutation } from './middleware/auth'
import { rateLimit } from './middleware/rate-limit'
import { handleScheduled } from './probe/scheduler'

const app = new Hono<{ Bindings: Env }>()

const publicReadOnly = createMiddleware<{ Bindings: Env }>(async (c, next) => {
  if (!['GET', 'HEAD', 'OPTIONS'].includes(c.req.method)) {
    c.header('Allow', 'GET, HEAD, OPTIONS')
    return c.json({ code: 40500, message: 'Method Not Allowed', data: null }, 405)
  }
  await next()
})

// ============================================
// 全局中间件
// ============================================
app.use('*', logger())
app.use('*', secureHeaders())
app.use('*', cors({
  origin: (origin, c) => {
    const allowedOrigins = (c.env.CORS_ORIGINS || '')
      .split(',')
      .map((value: string) => value.trim())
      .filter(Boolean)
    return allowedOrigins.includes(origin) ? origin : undefined
  },
  allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
  maxAge: 86400,
}))

// ============================================
// 健康检查（无需鉴权）
// ============================================
app.route('/health', healthRoutes)

// VPS Agent API — 使用节点专属凭据，不使用用户 JWT。
app.use('/api/agent/v1/*', rateLimit(180, 60))
app.route('/api/agent/v1', agentRoutes)

// ============================================
// Public API — 前端展示页查询接口（无需鉴权）
// ============================================
app.use('/api/v1/auth/login', rateLimit(5, 60))
app.use('/api/v1/auth/refresh', rateLimit(20, 60))
app.route('/api/v1/auth', authRoutes)
app.use('/api/v1/nodes', publicReadOnly)
app.use('/api/v1/nodes/*', publicReadOnly)
app.route('/api/v1/nodes', nodeRoutes)        // GET only for public
app.route('/api/v1/probe-results', probeResultRoutes) // GET only
app.use('/api/v1/incidents', publicReadOnly)
app.use('/api/v1/incidents/*', publicReadOnly)
app.route('/api/v1/incidents', incidentRoutes) // GET only for public

// ============================================
// Admin API — 管理操作接口（需鉴权）
// ============================================
const admin = new Hono<{ Bindings: Env }>()
admin.use('*', rateLimit(60, 60))  // 每 IP 每分钟 60 次
admin.use('*', authMiddleware)
admin.use('/users', requireRoleForMutation('owner'))
admin.use('/users/*', requireRoleForMutation('owner'))
admin.use('/settings', requireRoleForMutation('owner'))
admin.use('/settings/*', requireRoleForMutation('owner'))
admin.use('/nodes/*', requireRoleForMethods(['DELETE'], 'owner'))
admin.use('*', requireRoleForMutation('admin', 'owner'))
admin.route('/nodes', nodeRoutes)        // POST/PUT/DELETE
admin.route('/targets', targetRoutes)    // CRUD
admin.route('/alerts', alertRoutes)      // CRUD
admin.route('/incidents', incidentRoutes) // POST/PUT/DELETE
admin.route('/settings', settingsRoutes)   // GET/PUT
admin.route('/audit-logs', auditLogRoutes) // GET only
admin.route('/users', userRoutes)          // CRUD
admin.route('/agents', agentAdminRoutes)   // 注册令牌、凭据吊销、Agent 状态
app.route('/api/admin/v1', admin)

// 根路径
app.get('/', (c) => {
  return c.json({
    name: 'Braum Probe API',
    version: c.env.APP_VERSION,
    docs: '/docs',
  })
})

// 404 处理
app.notFound((c) => {
  return c.json({ code: 404, message: 'Not Found', data: null }, 404)
})

// 全局错误处理
app.onError((err, c) => {
  console.error(JSON.stringify({
    event: 'unhandled_error',
    message: err.message,
    stack: err.stack,
  }))
  return c.json({
    code: 500,
    message: 'Internal Server Error',
    data: null,
  }, 500)
})

// ============================================
// 导出 Workers 入口（HTTP + Scheduled）
// ============================================
export default {
  fetch: app.fetch,
  scheduled: handleScheduled,
}
