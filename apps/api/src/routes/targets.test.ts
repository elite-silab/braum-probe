import { describe, expect, it, vi } from 'vitest'
import { Hono } from 'hono'
import { targetRoutes } from './targets'

function createApp(db: D1Database) {
  const app = new Hono<{ Bindings: any }>()
  app.route('/api/v1/targets', targetRoutes)
  return { fetch: (request: Request) => app.fetch(request, { DB: db }) }
}

function mockDB(result: Record<string, unknown>) {
  const chains = Array.from({ length: 4 }, () => ({
    bind: vi.fn().mockReturnThis(),
    first: vi.fn().mockResolvedValue(result),
    run: vi.fn().mockResolvedValue({ meta: { changes: 1 } }),
  }))
  let index = 0
  return {
    prepare: vi.fn(() => chains[Math.min(index++, chains.length - 1)]),
    _chains: chains,
  } as unknown as D1Database & { _chains: typeof chains }
}

describe('POST /api/v1/targets', () => {
  it('HTTP 探测只填写地址即可创建并自动命名', async () => {
    const db = mockDB({ id: 'target-1', name: 'example.com' })
    const app = createApp(db)
    const response = await app.fetch(new Request('http://localhost/api/v1/targets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ address: 'https://example.com/health' }),
    }))

    expect(response.status).toBe(201)
    expect(db._chains[0].bind).toHaveBeenCalledWith(
      expect.any(String),
      'example.com',
      'https://example.com/health',
      'http',
      null,
      200,
      5000,
    )
  })

  it('不带协议的地址自动识别为 DNS 探测', async () => {
    const db = mockDB({ id: 'target-2', name: 'example.com' })
    const app = createApp(db)
    const response = await app.fetch(new Request('http://localhost/api/v1/targets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ address: 'example.com' }),
    }))

    expect(response.status).toBe(201)
    expect(db._chains[0].bind).toHaveBeenCalledWith(
      expect.any(String), 'example.com', 'example.com', 'dns', null, 200, 5000,
    )
  })

  it('拒绝指向私网的 HTTP 地址', async () => {
    const db = mockDB({})
    const app = createApp(db)
    const response = await app.fetch(new Request('http://localhost/api/v1/targets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ address: 'http://127.0.0.1/admin' }),
    }))

    expect(response.status).toBe(400)
    expect(db.prepare).not.toHaveBeenCalled()
  })
})

describe('PUT /api/v1/targets/:id/assignments', () => {
  it('可以把目标分配给已存在的节点', async () => {
    const targetChain = {
      bind: vi.fn().mockReturnThis(),
      first: vi.fn().mockResolvedValue({ id: 'target-1' }),
    }
    const nodeChain = {
      bind: vi.fn().mockReturnThis(),
      all: vi.fn().mockResolvedValue({ results: [{ id: 'node-1' }, { id: 'node-2' }] }),
    }
    const previousAssignmentsChain = {
      bind: vi.fn().mockReturnThis(),
      all: vi.fn().mockResolvedValue({ results: [] }),
    }
    const mutationChain = {
      bind: vi.fn().mockReturnThis(),
      run: vi.fn().mockResolvedValue({ meta: { changes: 1 } }),
    }
    const db = {
      prepare: vi.fn()
        .mockReturnValueOnce(targetChain)
        .mockReturnValueOnce(previousAssignmentsChain)
        .mockReturnValueOnce(nodeChain)
        .mockReturnValue(mutationChain),
      batch: vi.fn().mockResolvedValue([]),
    } as unknown as D1Database
    const app = createApp(db)

    const response = await app.fetch(new Request('http://localhost/api/v1/targets/target-1/assignments', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ node_ids: ['node-1', 'node-2', 'node-1'] }),
    }))

    expect(response.status).toBe(200)
    expect(db.batch).toHaveBeenCalledOnce()
    expect((await response.json() as any).data.node_ids).toEqual(['node-1', 'node-2'])
  })

  it('拒绝不存在的节点', async () => {
    const targetChain = {
      bind: vi.fn().mockReturnThis(),
      first: vi.fn().mockResolvedValue({ id: 'target-1' }),
    }
    const nodeChain = {
      bind: vi.fn().mockReturnThis(),
      all: vi.fn().mockResolvedValue({ results: [] }),
    }
    const previousAssignmentsChain = {
      bind: vi.fn().mockReturnThis(),
      all: vi.fn().mockResolvedValue({ results: [] }),
    }
    const db = {
      prepare: vi.fn()
        .mockReturnValueOnce(targetChain)
        .mockReturnValueOnce(previousAssignmentsChain)
        .mockReturnValueOnce(nodeChain),
      batch: vi.fn(),
    } as unknown as D1Database
    const app = createApp(db)

    const response = await app.fetch(new Request('http://localhost/api/v1/targets/target-1/assignments', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ node_ids: ['missing-node'] }),
    }))

    expect(response.status).toBe(400)
    expect(db.batch).not.toHaveBeenCalled()
  })
})
