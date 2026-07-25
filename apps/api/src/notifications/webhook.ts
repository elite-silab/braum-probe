// Braum 布隆 CF 探针 — Webhook 通知发送

import { parsePublicHttpUrl } from '../utils/outbound'

export interface WebhookConfig extends Record<string, unknown> {
  url: string
  method?: 'POST' | 'PUT'
  headers?: Record<string, string>
}

/**
 * 通过 HTTP Webhook 发送告警
 */
export async function sendWebhook(config: WebhookConfig, message: string): Promise<void> {
  if (!config.url) {
    throw new Error('Webhook URL not configured')
  }
  const url = parsePublicHttpUrl(config.url)
  if (!url) throw new Error('Unsafe or invalid webhook URL')

  const method = config.method || 'POST'
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(config.headers || {}),
  }

  const payload = {
    source: 'braum-probe',
    event: 'alert',
    message,
    timestamp: new Date().toISOString(),
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 10_000)
  let response: Response
  try {
    response = await fetch(url.toString(), {
      method,
      headers,
      body: JSON.stringify(payload),
      redirect: 'manual',
      signal: controller.signal,
    })
  } finally {
    clearTimeout(timeout)
  }

  if (!response.ok) {
    const body = (await response.text()).slice(0, 1000)
    throw new Error(`Webhook error: ${response.status} ${body}`)
  }
}
