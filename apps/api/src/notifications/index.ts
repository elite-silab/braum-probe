// Braum 布隆 CF 探针 — 通知发送入口

import type { Env } from '../env'
import { sendTelegram, type TelegramConfig } from './telegram'
import { sendWebhook, type WebhookConfig } from './webhook'
import { decryptConfig } from '../utils/encryption'

function isTelegramConfig(config: Record<string, unknown>): config is TelegramConfig {
  return typeof config.chat_id === 'string'
    && (config.bot_token === undefined || typeof config.bot_token === 'string')
}

function isWebhookConfig(config: Record<string, unknown>): config is WebhookConfig {
  return typeof config.url === 'string'
    && (config.method === undefined || config.method === 'POST' || config.method === 'PUT')
    && (config.headers === undefined || (config.headers !== null && typeof config.headers === 'object'))
}

/**
 * 根据规则关联的通知渠道发送告警通知
 */
export async function sendNotifications(env: Env, ruleId: string, message: string): Promise<void> {
  // 查询规则关联的通知渠道
  const channels = await env.DB.prepare(`
    SELECT ac.id, ac.name, ac.channel_type, ac.config
    FROM alert_channels ac
    INNER JOIN alert_rule_channels arc ON arc.channel_id = ac.id
    WHERE arc.rule_id = ? AND ac.enabled = 1
  `).bind(ruleId).all()

  if (!channels.results?.length) {
    console.log(JSON.stringify({ event: 'no_channels', rule_id: ruleId }))
    return
  }

  for (const channel of channels.results) {
    const ch = channel as { id: string; name: string; channel_type: string; config: string }
    try {
      const config = await decryptConfig(ch.config || '{}', env.ENCRYPTION_KEY)

      switch (ch.channel_type) {
        case 'telegram':
          if (!isTelegramConfig(config)) throw new Error('Invalid Telegram channel config')
          await sendTelegram(env, config, message)
          break
        case 'webhook':
          if (!isWebhookConfig(config)) throw new Error('Invalid webhook channel config')
          await sendWebhook(config, message)
          break
        default:
          console.log(JSON.stringify({ event: 'unknown_channel_type', type: ch.channel_type }))
      }

      console.log(JSON.stringify({
        event: 'notification_sent',
        channel_id: ch.id,
        channel_type: ch.channel_type,
        rule_id: ruleId,
      }))
    } catch (error) {
      console.error(JSON.stringify({
        event: 'notification_error',
        channel_id: ch.id,
        channel_type: ch.channel_type,
        error: error instanceof Error ? error.message : 'Unknown',
      }))
    }
  }
}
