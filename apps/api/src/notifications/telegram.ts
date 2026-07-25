// Braum 布隆 CF 探针 — Telegram 通知发送

import type { Env } from '../env'

export interface TelegramConfig extends Record<string, unknown> {
  bot_token?: string
  chat_id: string
}

/**
 * 通过 Telegram Bot API 发送消息
 */
export async function sendTelegram(env: Env, config: TelegramConfig, message: string): Promise<void> {
  const botToken = config.bot_token || env.TELEGRAM_BOT_TOKEN
  if (!botToken) {
    throw new Error('Telegram bot token not configured')
  }
  if (!config.chat_id) {
    throw new Error('Telegram chat_id not configured')
  }

  const url = `https://api.telegram.org/bot${botToken}/sendMessage`

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: config.chat_id,
      text: `🔔 Braum 告警\n\n${message}\n\n⏰ ${new Date().toISOString()}`,
    }),
  })

  if (!response.ok) {
    const body = await response.text()
    throw new Error(`Telegram API error: ${response.status} ${body}`)
  }
}
