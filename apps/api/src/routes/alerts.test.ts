import { afterEach, describe, expect, it, vi } from 'vitest'
import { Hono } from 'hono'
import { alertRoutes } from './alerts'
import { encryptConfig } from '../utils/encryption'

const ENCRYPTION_KEY = 'test-alert-channel-encryption-key'

function chain(result: { first?: unknown; all?: unknown[] } = {}) {
  return {
    bind: vi.fn().mockReturnThis(),
    first: vi.fn().mockResolvedValue(result.first ?? null),
    all: vi.fn().mockResolvedValue({ results: result.all ?? [] }),
    run: vi.fn().mockResolvedValue({ meta: { changes: 1 } }),
  }
}

function createApp(db: D1Database, telegramBotToken = '') {
  const app = new Hono<{ Bindings: any }>()
  app.route('/alerts', alertRoutes)
  return {
    fetch: (request: Request) => app.fetch(request, {
      DB: db,
      ENCRYPTION_KEY,
      TELEGRAM_BOT_TOKEN: telegramBotToken,
    }),
  }
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('alert channel configuration', () => {
  it('编辑列表回填 Chat ID 和 Token 状态，但不返回 Token 明文', async () => {
    const encrypted = await encryptConfig({
      chat_id: '-1001234567890',
      bot_token: '123456:secret-token',
    }, ENCRYPTION_KEY)
    const db = {
      prepare: vi.fn(() => chain({
        all: [{
          id: 'channel-1',
          name: 'Telegram 通知',
          channel_type: 'telegram',
          config: encrypted,
          enabled: 1,
          created_at: '2026-07-27T00:00:00Z',
          updated_at: '2026-07-27T00:00:00Z',
        }],
      })),
    } as unknown as D1Database

    const response = await createApp(db).fetch(new Request('http://localhost/alerts/channels'))
    const body = await response.json() as any

    expect(response.status).toBe(200)
    expect(body.data[0].config).toEqual({
      chat_id: '-1001234567890',
      bot_token_configured: true,
    })
    expect(JSON.stringify(body)).not.toContain('123456:secret-token')
    expect(JSON.stringify(body)).not.toContain(encrypted)
  })

  it('使用加密保存的 Telegram 配置发送测试消息', async () => {
    const encrypted = await encryptConfig({
      chat_id: '-1001234567890',
      bot_token: '123456:secret-token',
    }, ENCRYPTION_KEY)
    const db = {
      prepare: vi.fn(() => chain({
        first: {
          id: 'channel-1',
          name: 'Telegram 通知',
          channel_type: 'telegram',
          config: encrypted,
        },
      })),
    } as unknown as D1Database
    const telegramFetch = vi.fn().mockResolvedValue(new Response('{"ok":true}', {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }))
    vi.stubGlobal('fetch', telegramFetch)

    const response = await createApp(db).fetch(new Request('http://localhost/alerts/channels/channel-1/test', {
      method: 'POST',
    }))
    const body = await response.json() as any

    expect(response.status).toBe(200)
    expect(body.data).toEqual({ sent: true })
    expect(telegramFetch).toHaveBeenCalledOnce()
    const [url, options] = telegramFetch.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('https://api.telegram.org/bot123456:secret-token/sendMessage')
    const payload = JSON.parse(String(options.body))
    expect(payload.chat_id).toBe('-1001234567890')
    expect(payload.text).toContain('测试成功')
  })

  it('找不到渠道时不发送测试消息', async () => {
    const db = {
      prepare: vi.fn(() => chain()),
    } as unknown as D1Database
    const telegramFetch = vi.fn()
    vi.stubGlobal('fetch', telegramFetch)

    const response = await createApp(db).fetch(new Request('http://localhost/alerts/channels/missing/test', {
      method: 'POST',
    }))

    expect(response.status).toBe(404)
    expect(telegramFetch).not.toHaveBeenCalled()
  })

  it('Webhook 测试消息使用 test 事件类型', async () => {
    const encrypted = await encryptConfig({ url: 'https://hooks.example.com/braum' }, ENCRYPTION_KEY)
    const db = {
      prepare: vi.fn(() => chain({
        first: {
          id: 'channel-2',
          name: 'Webhook 通知',
          channel_type: 'webhook',
          config: encrypted,
        },
      })),
    } as unknown as D1Database
    const webhookFetch = vi.fn().mockResolvedValue(new Response(null, { status: 204 }))
    vi.stubGlobal('fetch', webhookFetch)

    const response = await createApp(db).fetch(new Request('http://localhost/alerts/channels/channel-2/test', {
      method: 'POST',
    }))

    expect(response.status).toBe(200)
    expect(webhookFetch).toHaveBeenCalledOnce()
    const [, options] = webhookFetch.mock.calls[0] as [string, RequestInit]
    const payload = JSON.parse(String(options.body))
    expect(payload.event).toBe('test')
    expect(payload.message).toContain('测试成功')
  })
})
