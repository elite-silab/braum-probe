import type { RealtimeViewerEvent } from '@braum/shared'

export type RealtimeConnectionState = 'connecting' | 'connected' | 'fallback'

interface RealtimeConnectionOptions {
  onEvent: (event: RealtimeViewerEvent) => void
  onStateChange?: (state: RealtimeConnectionState) => void
}

function websocketURL(): string {
  const url = new URL('/api/v1/realtime', window.location.href)
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:'
  return url.toString()
}

function parseEvent(value: string): RealtimeViewerEvent | null {
  try {
    const event = JSON.parse(value) as Record<string, unknown>
    if (
      event.type === 'snapshot'
      && Array.isArray(event.connected_node_ids)
      && event.connected_node_ids.length <= 10_000
      && event.connected_node_ids.every(nodeId => typeof nodeId === 'string' && nodeId.length <= 100)
    ) {
      return event as unknown as RealtimeViewerEvent
    }
    if (
      ['node_connected', 'node_disconnected', 'metrics_updated', 'node_updated', 'node_deleted'].includes(String(event.type))
      && typeof event.node_id === 'string'
    ) {
      return event as unknown as RealtimeViewerEvent
    }
  } catch {
    // Ignore malformed realtime messages and keep the polling fallback active.
  }
  return null
}

export function createRealtimeConnection(options: RealtimeConnectionOptions): () => void {
  let socket: WebSocket | null = null
  let retryTimer: ReturnType<typeof setTimeout> | null = null
  let pingTimer: ReturnType<typeof setInterval> | null = null
  let retryDelay = 1000
  let stopped = false

  const clearTimers = () => {
    if (retryTimer) clearTimeout(retryTimer)
    if (pingTimer) clearInterval(pingTimer)
    retryTimer = null
    pingTimer = null
  }

  const scheduleReconnect = () => {
    if (stopped || document.hidden || retryTimer) return
    options.onStateChange?.('fallback')
    retryTimer = setTimeout(() => {
      retryTimer = null
      connect()
    }, retryDelay)
    retryDelay = Math.min(30_000, retryDelay * 2)
  }

  const connect = () => {
    if (stopped || document.hidden || socket) return
    options.onStateChange?.('connecting')
    try {
      socket = new WebSocket(websocketURL())
    } catch {
      socket = null
      scheduleReconnect()
      return
    }

    socket.addEventListener('open', () => {
      retryDelay = 1000
      options.onStateChange?.('connected')
      pingTimer = setInterval(() => {
        if (socket?.readyState === WebSocket.OPEN) socket.send('{"type":"ping"}')
      }, 25_000)
    })
    socket.addEventListener('message', message => {
      if (typeof message.data !== 'string') return
      const event = parseEvent(message.data)
      if (event) options.onEvent(event)
    })
    socket.addEventListener('close', () => {
      socket = null
      if (pingTimer) clearInterval(pingTimer)
      pingTimer = null
      scheduleReconnect()
    })
    socket.addEventListener('error', () => socket?.close())
  }

  const onVisibilityChange = () => {
    if (document.hidden) {
      clearTimers()
      const current = socket
      socket = null
      current?.close(1000, 'Page hidden')
      options.onStateChange?.('fallback')
      return
    }
    connect()
  }

  document.addEventListener('visibilitychange', onVisibilityChange)
  connect()

  return () => {
    stopped = true
    clearTimers()
    document.removeEventListener('visibilitychange', onVisibilityChange)
    socket?.close(1000, 'Page closed')
    socket = null
  }
}
