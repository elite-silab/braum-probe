import { Hono } from 'hono'
import type { Env } from '../env'
import { connectViewerRealtime } from '../realtime/client'

export const realtimeRoutes = new Hono<{ Bindings: Env }>()

realtimeRoutes.get('/', async (c) => {
  if (c.req.header('Upgrade')?.toLowerCase() !== 'websocket') {
    return c.json({ code: 42600, message: 'WebSocket upgrade required', data: null }, 426)
  }
  return connectViewerRealtime(c.env)
})
