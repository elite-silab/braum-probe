import {
  REALTIME_MAX_MESSAGE_BYTES,
  REALTIME_PROTOCOL_VERSION,
  type AgentControlMessage,
  type RealtimeInternalEvent,
  type RealtimeViewerEvent,
} from '@braum/shared'
import { messageByteLength, readInternalEvent } from './protocol'

interface SocketAttachment {
  role: 'agent' | 'viewer'
  node_id?: string
}

function socketAttachment(socket: WebSocket): SocketAttachment | null {
  const value = socket.deserializeAttachment() as SocketAttachment | null
  if (!value || (value.role !== 'agent' && value.role !== 'viewer')) return null
  return value
}

function websocketResponse(socket: WebSocket): Response {
  return new Response(null, { status: 101, webSocket: socket })
}

function json(value: unknown): string {
  return JSON.stringify(value)
}

export class RealtimeHub implements DurableObject {
  constructor(private readonly state: DurableObjectState) {
    this.state.setWebSocketAutoResponse(
      new WebSocketRequestResponsePair('{"type":"ping"}', '{"type":"pong"}'),
    )
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url)
    if (request.method === 'POST' && url.pathname === '/notify') {
      const event = await readInternalEvent(request)
      if (!event) return new Response('Invalid realtime event', { status: 400 })
      this.handleInternalEvent(event)
      return new Response(null, { status: 204 })
    }

    if (request.headers.get('Upgrade')?.toLowerCase() !== 'websocket') {
      return new Response('WebSocket upgrade required', { status: 426 })
    }

    if (url.pathname === '/connect/agent') {
      const nodeId = url.searchParams.get('node_id') || ''
      if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,99}$/.test(nodeId)) {
        return new Response('Invalid node id', { status: 400 })
      }
      return this.connectAgent(nodeId)
    }

    if (url.pathname === '/connect/viewer') return this.connectViewer()
    return new Response('Not Found', { status: 404 })
  }

  webSocketMessage(socket: WebSocket, message: string | ArrayBuffer): void {
    if (messageByteLength(message) > REALTIME_MAX_MESSAGE_BYTES || typeof message !== 'string') {
      socket.close(1009, 'Message too large or unsupported')
      return
    }

    const attachment = socketAttachment(socket)
    if (attachment?.role !== 'agent') return
    try {
      const payload = JSON.parse(message) as Record<string, unknown>
      if (payload.type === 'ready' && payload.protocol_version === REALTIME_PROTOCOL_VERSION) return
      if (payload.type === 'ping') {
        socket.send('{"type":"pong"}')
        return
      }
    } catch {
      // Invalid messages are closed below.
    }
    socket.close(1003, 'Unsupported message')
  }

  webSocketClose(socket: WebSocket): void {
    const attachment = socketAttachment(socket)
    if (attachment?.role !== 'agent' || !attachment.node_id) return
    if (!this.agentSockets(attachment.node_id).some(candidate => candidate !== socket)) {
      this.broadcast({ type: 'node_disconnected', node_id: attachment.node_id, sent_at: new Date().toISOString() })
    }
  }

  webSocketError(socket: WebSocket): void {
    const attachment = socketAttachment(socket)
    if (attachment?.role !== 'agent' || !attachment.node_id) return
    if (!this.agentSockets(attachment.node_id).some(candidate => candidate !== socket)) {
      this.broadcast({ type: 'node_disconnected', node_id: attachment.node_id, sent_at: new Date().toISOString() })
    }
  }

  private connectAgent(nodeId: string): Response {
    for (const socket of this.agentSockets(nodeId)) socket.close(4001, 'Replaced by a new Agent connection')

    const pair = new WebSocketPair()
    const client = pair[0]
    const server = pair[1]
    server.serializeAttachment({ role: 'agent', node_id: nodeId } satisfies SocketAttachment)
    this.state.acceptWebSocket(server, ['agent', `node:${nodeId}`])
    this.send(server, {
      type: 'welcome',
      protocol_version: REALTIME_PROTOCOL_VERSION,
      server_time: new Date().toISOString(),
    })
    this.broadcast({ type: 'node_connected', node_id: nodeId, sent_at: new Date().toISOString() })
    return websocketResponse(client)
  }

  private connectViewer(): Response {
    const pair = new WebSocketPair()
    const client = pair[0]
    const server = pair[1]
    server.serializeAttachment({ role: 'viewer' } satisfies SocketAttachment)
    this.state.acceptWebSocket(server, ['viewer'])
    this.send(server, {
      type: 'snapshot',
      connected_node_ids: this.connectedNodeIds(),
      sent_at: new Date().toISOString(),
    })
    return websocketResponse(client)
  }

  private handleInternalEvent(event: RealtimeInternalEvent): void {
    const sentAt = new Date().toISOString()
    if (event.type === 'metrics_updated') {
      this.broadcast({ type: 'metrics_updated', node_id: event.node_id, sent_at: sentAt })
      return
    }
    if (event.type === 'config_changed') {
      const command: AgentControlMessage = {
        type: 'config_changed',
        reason: event.reason,
        sent_at: sentAt,
      }
      for (const socket of this.agentSockets(event.node_id)) this.send(socket, command)
      this.broadcast({ type: 'node_updated', node_id: event.node_id, sent_at: sentAt })
      return
    }
    if (event.type === 'disconnect_agent') {
      const command: AgentControlMessage = { type: 'disconnect', reason: event.reason, sent_at: sentAt }
      for (const socket of this.agentSockets(event.node_id)) {
        this.send(socket, command)
        socket.close(4003, event.reason)
      }
      return
    }
    for (const socket of this.agentSockets(event.node_id)) socket.close(4004, 'Node deleted')
    this.broadcast({ type: 'node_deleted', node_id: event.node_id, sent_at: sentAt })
  }

  private connectedNodeIds(): string[] {
    return [...new Set(this.state.getWebSockets('agent')
      .map(socket => socketAttachment(socket)?.node_id)
      .filter((nodeId): nodeId is string => Boolean(nodeId)))]
      .sort()
  }

  private agentSockets(nodeId: string): WebSocket[] {
    return this.state.getWebSockets(`node:${nodeId}`)
  }

  private broadcast(event: RealtimeViewerEvent): void {
    for (const socket of this.state.getWebSockets('viewer')) this.send(socket, event)
  }

  private send(socket: WebSocket, message: AgentControlMessage | RealtimeViewerEvent): void {
    try {
      socket.send(json(message))
    } catch {
      socket.close(1011, 'Send failed')
    }
  }
}
