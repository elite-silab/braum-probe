// Braum 布隆 CF 探针 — Workers 环境类型定义

/** Workers 绑定的环境变量和资源 */
export interface Env {
  // D1 数据库绑定
  DB: D1Database

  // KV 命名空间绑定
  CACHE: KVNamespace

  // Variables (wrangler.toml [vars])
  APP_VERSION: string
  CORS_ORIGINS: string
  AGENT_API_URL: string
  AGENT_RELEASE_BASE_URL: string

  // Secrets（生产环境由 Cloudflare Dashboard 设置，本地从仓库根目录 .env 读取）
  JWT_SECRET: string
  JWT_REFRESH_SECRET: string
  ADMIN_INITIAL_PASSWORD: string
  TELEGRAM_BOT_TOKEN: string
  ENCRYPTION_KEY: string
}
