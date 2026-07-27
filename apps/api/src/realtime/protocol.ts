import {
  REALTIME_MAX_MESSAGE_BYTES,
  type RealtimeInternalEvent,
} from '@braum/shared'

const INTERNAL_EVENT_TYPES = new Set([
  'metrics_updated',
  'config_changed',
  'disconnect_agent',
  'node_deleted',
])

export function messageByteLength(message: string | ArrayBuffer): number {
  return typeof message === 'string'
    ? new TextEncoder().encode(message).byteLength
    : message.byteLength
}

export function parseInternalEvent(value: unknown): RealtimeInternalEvent | null {
  if (!value || typeof value !== 'object') return null
  const event = value as Record<string, unknown>
  if (typeof event.type !== 'string' || !INTERNAL_EVENT_TYPES.has(event.type)) return null
  if (typeof event.node_id !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,99}$/.test(event.node_id)) return null

  if (event.type === 'config_changed' || event.type === 'disconnect_agent') {
    if (typeof event.reason !== 'string' || !event.reason.trim() || event.reason.length > 100) return null
  }

  return event as RealtimeInternalEvent
}

export async function readInternalEvent(request: Request): Promise<RealtimeInternalEvent | null> {
  const contentLength = Number(request.headers.get('Content-Length') || '0')
  if (contentLength > REALTIME_MAX_MESSAGE_BYTES) return null
  const text = await request.text()
  if (new TextEncoder().encode(text).byteLength > REALTIME_MAX_MESSAGE_BYTES) return null
  try {
    return parseInternalEvent(JSON.parse(text))
  } catch {
    return null
  }
}
