// Braum 布隆 CF 探针 — 测试辅助：Mock Env 工厂

import { vi } from 'vitest'

/** D1 链式调用 mock */
interface D1Chain {
  bind: (...args: unknown[]) => D1Chain
  first: (col?: string) => Promise<unknown>
  all: () => Promise<{ results: unknown[] }>
  run: () => Promise<{ meta: { changes: number } }>
  raw: () => Promise<unknown[]>
}

function createD1Chain(responses?: {
  first?: unknown
  all?: unknown[]
  run?: { meta?: { changes?: number } }
}): D1Chain {
  const chain: D1Chain = {
    bind: vi.fn().mockReturnThis(),
    first: vi.fn().mockResolvedValue(responses?.first ?? null),
    all: vi.fn().mockResolvedValue({ results: responses?.all ?? [] }),
    run: vi.fn().mockResolvedValue(responses?.run ?? { meta: { changes: 1 } }),
    raw: vi.fn().mockResolvedValue([]),
  }
  return chain
}

/** 创建 mock D1 数据库，按调用顺序返回不同结果 */
export function createMockDB(chainResponses?: Array<Parameters<typeof createD1Chain>[0]>) {
  let callIndex = 0
  const chains = (chainResponses || [{}]).map(r => createD1Chain(r))

  const db = {
    prepare: vi.fn((_query: string) => {
      if (chains.length === 1) return chains[0]
      const chain = chains[Math.min(callIndex, chains.length - 1)]
      callIndex++
      return chain
    }),
    batch: vi.fn().mockResolvedValue([]),
    dump: vi.fn().mockResolvedValue(new ArrayBuffer(0)),
    exec: vi.fn().mockResolvedValue({ count: 0, duration: 0 }),
  }

  return db as unknown as D1Database & { prepare: ReturnType<typeof vi.fn> }
}

/** 创建 mock KV */
export function createMockKV(store?: Record<string, string>) {
  const kvStore = new Map(Object.entries(store || {}))

  return {
    get: vi.fn(async (key: string, _opts?: { type?: string }) => {
      return kvStore.get(key) ?? null
    }),
    put: vi.fn(async (key: string, value: string, _opts?: { expirationTtl?: number }) => {
      kvStore.set(key, value)
    }),
    delete: vi.fn(async (key: string) => {
      kvStore.delete(key)
    }),
    list: vi.fn(async () => ({ keys: [], list_complete: true, cursor: '' })),
    getWithMetadata: vi.fn(async () => ({ value: null, metadata: null, cacheStatus: null })),
  } as unknown as KVNamespace & { get: ReturnType<typeof vi.fn>; put: ReturnType<typeof vi.fn> }
}

/** 创建完整的 mock Env */
export function createMockEnv(overrides?: {
  dbChains?: Array<Parameters<typeof createD1Chain>[0]>
  kvStore?: Record<string, string>
}) {
  return {
    DB: createMockDB(overrides?.dbChains),
    CACHE: createMockKV(overrides?.kvStore),
    APP_VERSION: '0.1.0-test',
    JWT_SECRET: 'test-jwt-secret',
    JWT_REFRESH_SECRET: 'test-refresh-secret',
    ADMIN_INITIAL_EMAIL: 'admin@braum.local',
    ADMIN_INITIAL_PASSWORD: 'admin123',
    TELEGRAM_BOT_TOKEN: '',
    ENCRYPTION_KEY: 'test-encryption-key',
    AGENT_API_URL: 'https://api.example.com',
    AGENT_RELEASE_BASE_URL: 'https://downloads.example.com/releases',
  }
}
