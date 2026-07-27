import type { RealtimeInternalEvent } from '@braum/shared'
import type { Env } from '../env'

const HUB_NAME = 'global'

function hub(env: Env): DurableObjectStub | null {
  if (!env.REALTIME) return null
  return env.REALTIME.get(env.REALTIME.idFromName(HUB_NAME))
}

function internalUpgradeRequest(url: URL | string): Request {
  return new Request(url, {
    method: 'GET',
    headers: { Upgrade: 'websocket' },
  })
}

export async function connectAgentRealtime(env: Env, nodeId: string): Promise<Response> {
  const stub = hub(env)
  if (!stub) return new Response('Realtime channel is unavailable', { status: 503 })
  const url = new URL('https://realtime.internal/connect/agent')
  url.searchParams.set('node_id', nodeId)
  // Agent credentials are consumed at the edge route and never forwarded to the Hub.
  return stub.fetch(internalUpgradeRequest(url))
}

export async function connectViewerRealtime(env: Env): Promise<Response> {
  const stub = hub(env)
  if (!stub) return new Response('Realtime channel is unavailable', { status: 503 })
  // Viewer cookies and headers are not needed by the public event stream.
  return stub.fetch(internalUpgradeRequest('https://realtime.internal/connect/viewer'))
}

/** 实时通知是最佳努力路径，失败不得回滚已经写入 D1 的监控数据。 */
export async function notifyRealtime(env: Env, event: RealtimeInternalEvent): Promise<void> {
  const stub = hub(env)
  if (!stub) return
  try {
    const response = await stub.fetch('https://realtime.internal/notify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(event),
    })
    if (!response.ok) console.warn(JSON.stringify({ event: 'realtime_notify_failed', status: response.status }))
  } catch (error) {
    console.warn(JSON.stringify({
      event: 'realtime_notify_failed',
      message: error instanceof Error ? error.message : String(error),
    }))
  }
}
