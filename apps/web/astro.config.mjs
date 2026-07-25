import { defineConfig } from 'astro/config'
import cloudflare from '@astrojs/cloudflare'
import react from '@astrojs/react'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  output: 'server',
  adapter: cloudflare({ imageService: 'passthrough' }),
  integrations: [
    react(),
  ],
  vite: {
    // API 与 Web 共用仓库根目录的 .env，避免再维护 apps/web/.env 或 .dev.vars。
    envDir: fileURLToPath(new URL('../..', import.meta.url)),
    plugins: [tailwindcss()],
  },
})
