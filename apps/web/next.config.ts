import type { NextConfig } from 'next'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { initOpenNextCloudflareForDev } from '@opennextjs/cloudflare'

const rootEnv = fileURLToPath(new URL('../../.env', import.meta.url))
const localBindingsState = fileURLToPath(new URL('../../.wrangler/state/v3', import.meta.url))
if (existsSync(rootEnv)) {
  process.loadEnvFile(rootEnv)
}

if (process.env.NODE_ENV === 'development') {
  initOpenNextCloudflareForDev({
    configPath: '../../wrangler.jsonc',
    persist: { path: localBindingsState },
    remoteBindings: false,
  })
}

const nextConfig: NextConfig = {
  transpilePackages: ['@braum/shared'],
}

export default nextConfig
