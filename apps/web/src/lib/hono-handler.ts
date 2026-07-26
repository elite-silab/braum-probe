import { getCloudflareContext } from '@opennextjs/cloudflare'
import apiWorker from '../../../api/src/index'
import type { Env } from '../../../api/src/env'

const localSecretNames = [
  'JWT_SECRET',
  'JWT_REFRESH_SECRET',
  'ADMIN_INITIAL_PASSWORD',
  'TELEGRAM_BOT_TOKEN',
  'ENCRYPTION_KEY',
  'AGENT_API_URL',
] as const

export async function handleHonoRequest(request: Request): Promise<Response> {
  const { env, ctx } = await getCloudflareContext({ async: true })
  const bindings: Record<string, unknown> = { ...env }

  if (process.env.NODE_ENV !== 'production') {
    for (const name of localSecretNames) {
      if (process.env[name] !== undefined) bindings[name] = process.env[name]
    }
  }

  return apiWorker.fetch(request, bindings as unknown as Env, ctx as ExecutionContext)
}
