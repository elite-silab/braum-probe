// Braum 布隆 CF 探针 — 节点路由测试

import { describe, it, expect, vi } from 'vitest'
import { Hono } from 'hono'
import { nodeRoutes } from './nodes'
import { createMockKV } from '../test-helpers'

function createApp(env: Record<string, unknown>) {
  const app = new Hono<{ Bindings: any }>()
  app.route('/api/v1/nodes', nodeRoutes)
  return { fetch: (req: Request) => app.fetch(req, env) }
}

function mockDBWithChains(chains: Array<{
  first?: unknown
  all?: unknown[]
  run?: unknown
}>) {
  let idx = 0
  const mockChains = chains.map(c => ({
    bind: vi.fn().mockReturnThis(),
    first: vi.fn().mockResolvedValue(c.first ?? null),
    all: vi.fn().mockResolvedValue({ results: c.all ?? [] }),
    run: vi.fn().mockResolvedValue(c.run ?? { meta: { changes: 1 } }),
  }))
  return {
    prepare: vi.fn(() => {
      const chain = mockChains[Math.min(idx, mockChains.length - 1)]
      idx++
      return chain
    }),
    batch: vi.fn().mockResolvedValue([]),
    _chains: mockChains,
  } as any
}

const ENV_BASE = {
  CACHE: createMockKV(),
  APP_VERSION: '0.1.0',
  JWT_SECRET: 'test',
  JWT_REFRESH_SECRET: 'test',
  ADMIN_INITIAL_PASSWORD: 'test',
  TELEGRAM_BOT_TOKEN: '',
  ENCRYPTION_KEY: '',
}

const SAMPLE_NODE = {
  id: 'node-1', name: '东京节点', region: 'asia', country: 'JP', city: 'Tokyo',
  latitude: 35.68, longitude: 139.69, isp: 'NTT', probe_type: 'http',
  probe_interval: 60, status: 'active', metadata: '{}',
  created_at: '2025-01-01T00:00:00Z', updated_at: '2025-01-01T00:00:00Z',
}

describe('GET /api/v1/nodes', () => {
  it('返回空列表', async () => {
    const db = mockDBWithChains([
      { first: { total: 0 } }, // count
      { all: [] },              // nodes query
    ])
    const app = createApp({ ...ENV_BASE, DB: db })

    const res = await app.fetch(new Request('http://localhost/api/v1/nodes'))
    expect(res.status).toBe(200)
    const body: any = await res.json()
    expect(body.code).toBe(0)
    expect(body.data).toEqual([])
    expect(body.meta.total).toBe(0)
  })

  it('返回节点列表（无聚合）', async () => {
    const db = mockDBWithChains([
      { first: { total: 1 } },
      { all: [SAMPLE_NODE] },
    ])
    const app = createApp({ ...ENV_BASE, DB: db })

    const res = await app.fetch(new Request('http://localhost/api/v1/nodes?enrich=false'))
    const body: any = await res.json()
    expect(body.data).toHaveLength(1)
    expect(body.data[0].id).toBe('node-1')
  })

  it('支持 status 过滤', async () => {
    const db = mockDBWithChains([
      { first: { total: 0 } },
      { all: [] },
    ])
    const app = createApp({ ...ENV_BASE, DB: db })

    await app.fetch(new Request('http://localhost/api/v1/nodes?status=active'))
    // 验证 prepare 被调用时传入了正确的 WHERE 条件
    expect(db.prepare).toHaveBeenCalledWith(
      expect.stringContaining('AND status = ?')
    )
  })

  it('支持 region 过滤', async () => {
    const db = mockDBWithChains([
      { first: { total: 0 } },
      { all: [] },
    ])
    const app = createApp({ ...ENV_BASE, DB: db })

    await app.fetch(new Request('http://localhost/api/v1/nodes?region=asia'))
    expect(db.prepare).toHaveBeenCalledWith(
      expect.stringContaining('AND region = ?')
    )
  })

  it('分页参数正确传递', async () => {
    const db = mockDBWithChains([
      { first: { total: 50 } },
      { all: [] },
    ])
    const app = createApp({ ...ENV_BASE, DB: db })

    const res = await app.fetch(new Request('http://localhost/api/v1/nodes?page=2&page_size=10&enrich=false'))
    const body: any = await res.json()
    expect(body.meta.page).toBe(2)
    expect(body.meta.page_size).toBe(10)
    expect(body.meta.total_pages).toBe(5)
  })
})

describe('GET /api/v1/nodes/:id', () => {
  it('存在的节点 → 200', async () => {
    const db = mockDBWithChains([
      { first: SAMPLE_NODE },  // node query
      { all: [] },             // targets query
    ])
    const app = createApp({ ...ENV_BASE, DB: db })

    const res = await app.fetch(new Request('http://localhost/api/v1/nodes/node-1'))
    expect(res.status).toBe(200)
    const body: any = await res.json()
    expect(body.data.id).toBe('node-1')
    expect(body.data.targets).toBeDefined()
  })

  it('不存在的节点 → 404', async () => {
    const db = mockDBWithChains([{ first: null }])
    const app = createApp({ ...ENV_BASE, DB: db })

    const res = await app.fetch(new Request('http://localhost/api/v1/nodes/nonexistent'))
    expect(res.status).toBe(404)
    const body: any = await res.json()
    expect(body.code).toBe(40400)
  })
})

describe('POST /api/v1/nodes', () => {
  it('缺少节点名称 → 400', async () => {
    const db = mockDBWithChains([{}])
    const app = createApp({ ...ENV_BASE, DB: db })

    const res = await app.fetch(new Request('http://localhost/api/v1/nodes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    }))
    expect(res.status).toBe(400)
  })

  it('只填写名称即可创建并自动补齐默认值', async () => {
    const newNode = { ...SAMPLE_NODE, id: 'node-generated', name: '我的 VPS' }
    const db = mockDBWithChains([
      { first: null },
      { run: {} },
      { first: newNode },
      { run: {} },
    ])
    const app = createApp({ ...ENV_BASE, DB: db })

    const res = await app.fetch(new Request('http://localhost/api/v1/nodes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: '我的 VPS' }),
    }))

    expect(res.status).toBe(201)
    expect(db._chains[1].bind).toHaveBeenCalledWith(
      expect.stringMatching(/^node-[a-f0-9-]{12}$/),
      '我的 VPS',
      'asia',
      '待识别',
      '待识别',
      0,
      0,
      null,
      'http',
      60,
    )
  })

  it('ID 已存在 → 400', async () => {
    const db = mockDBWithChains([
      { first: { id: 'node-1' } }, // existing check
    ])
    const app = createApp({ ...ENV_BASE, DB: db })

    const res = await app.fetch(new Request('http://localhost/api/v1/nodes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: 'node-1', name: 'Test', region: 'asia', country: 'JP',
        city: 'Tokyo', latitude: 35, longitude: 139, probe_type: 'http',
      }),
    }))
    expect(res.status).toBe(400)
    const body: any = await res.json()
    expect(body.message).toContain('already exists')
  })

  it('创建成功 → 201', async () => {
    const newNode = { ...SAMPLE_NODE, id: 'new-node' }
    const db = mockDBWithChains([
      { first: null },       // existing check (不存在)
      { run: {} },           // INSERT
      { first: newNode },    // 查询新节点
      { run: {} },           // audit log
    ])
    const app = createApp({ ...ENV_BASE, DB: db })

    const res = await app.fetch(new Request('http://localhost/api/v1/nodes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: 'new-node', name: 'New Node', region: 'asia', country: 'JP',
        city: 'Osaka', latitude: 34, longitude: 135, probe_type: 'http',
      }),
    }))
    expect(res.status).toBe(201)
    const body: any = await res.json()
    expect(body.data.id).toBe('new-node')
  })
})

describe('PUT /api/v1/nodes/:id', () => {
  it('不存在的节点 → 404', async () => {
    const db = mockDBWithChains([{ first: null }])
    const app = createApp({ ...ENV_BASE, DB: db })

    const res = await app.fetch(new Request('http://localhost/api/v1/nodes/nonexistent', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Updated' }),
    }))
    expect(res.status).toBe(404)
  })

  it('更新成功 → 200', async () => {
    const updated = { ...SAMPLE_NODE, name: 'Updated Name' }
    const db = mockDBWithChains([
      { first: SAMPLE_NODE },  // existing check
      { run: {} },             // UPDATE
      { first: updated },      // 查询更新后
      { run: {} },             // audit log
    ])
    const app = createApp({ ...ENV_BASE, DB: db })

    const res = await app.fetch(new Request('http://localhost/api/v1/nodes/node-1', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Updated Name' }),
    }))
    expect(res.status).toBe(200)
    const body: any = await res.json()
    expect(body.data.name).toBe('Updated Name')
  })
})

describe('DELETE /api/v1/nodes/:id', () => {
  it('不存在的节点 → 404', async () => {
    const db = mockDBWithChains([{ first: null }])
    const app = createApp({ ...ENV_BASE, DB: db })

    const res = await app.fetch(new Request('http://localhost/api/v1/nodes/nonexistent', {
      method: 'DELETE',
    }))
    expect(res.status).toBe(404)
  })

  it('删除成功 → 200', async () => {
    const db = mockDBWithChains([
      { first: SAMPLE_NODE },  // existing check
      { run: {} },             // DELETE
      { run: {} },             // audit log
    ])
    const app = createApp({ ...ENV_BASE, DB: db })

    const res = await app.fetch(new Request('http://localhost/api/v1/nodes/node-1', {
      method: 'DELETE',
    }))
    expect(res.status).toBe(200)
    const body: any = await res.json()
    expect(body.code).toBe(0)
  })
})
