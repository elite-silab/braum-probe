// Braum 布隆 CF 探针 — 系统设置路由

import { Hono } from 'hono'
import type { Env } from '../env'
import { success, badRequest } from '../utils/response'
import { writeAuditLog } from '../utils/audit'

export const settingsRoutes = new Hono<{ Bindings: Env }>()

// GET /api/admin/v1/settings — 获取所有系统设置
settingsRoutes.get('/', async (c) => {
  const settings = await c.env.DB.prepare('SELECT * FROM settings ORDER BY key ASC').all()

  // 将结果转换为 key-value 对象
  const settingsMap: Record<string, string> = {}
  for (const row of settings.results || []) {
    const { key, value } = row as { key: string; value: string }
    settingsMap[key] = value
  }

  return c.json(success(settingsMap))
})

// GET /api/admin/v1/settings/:key — 获取单个设置
settingsRoutes.get('/:key', async (c) => {
  const key = c.req.param('key')
  const setting = await c.env.DB.prepare('SELECT * FROM settings WHERE key = ?').bind(key).first()

  if (!setting) {
    return c.json({ code: 404, message: 'Setting not found', data: null }, 404)
  }

  return c.json(success(setting))
})

// PUT /api/admin/v1/settings — 批量更新设置
settingsRoutes.put('/', async (c) => {
  const body = await c.req.json()
  const updates = body.settings as Record<string, string>

  if (!updates || typeof updates !== 'object') {
    return c.json(badRequest('Missing or invalid settings object'), 400)
  }

  const stmts = Object.entries(updates).map(([key, value]) =>
    c.env.DB.prepare(
      `INSERT INTO settings (key, value, updated_at)
       VALUES (?, ?, strftime('%Y-%m-%dT%H:%M:%fZ','now'))
       ON CONFLICT(key) DO UPDATE SET
         value = excluded.value,
         updated_at = excluded.updated_at`
    ).bind(key, String(value))
  )

  if (stmts.length > 0) {
    await c.env.DB.batch(stmts)
  }

  await writeAuditLog(c.env, {
    user_id: c.get('userId' as never) as string | undefined,
    action: 'update',
    object_type: 'setting',
    object_id: 'system',
    changes: updates,
    ip_address: c.req.header('CF-Connecting-IP'),
  })

  return c.json(success({ updated: Object.keys(updates).length }))
})

// PUT /api/admin/v1/settings/:key — 更新单个设置
settingsRoutes.put('/:key', async (c) => {
  const key = c.req.param('key')
  const body = await c.req.json()
  const { value } = body

  if (value === undefined) {
    return c.json(badRequest('Missing value field'), 400)
  }

  await c.env.DB.prepare(
    `INSERT INTO settings (key, value, updated_at)
     VALUES (?, ?, strftime('%Y-%m-%dT%H:%M:%fZ','now'))
     ON CONFLICT(key) DO UPDATE SET
       value = excluded.value,
       updated_at = excluded.updated_at`
  ).bind(key, String(value)).run()

  await writeAuditLog(c.env, {
    user_id: c.get('userId' as never) as string | undefined,
    action: 'update',
    object_type: 'setting',
    object_id: key,
    changes: { [key]: value },
    ip_address: c.req.header('CF-Connecting-IP'),
  })

  return c.json(success({ key, value }))
})
