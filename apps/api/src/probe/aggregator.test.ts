import { describe, expect, it, vi } from 'vitest'
import { aggregateHourly, getCompletedDayWindow, getCompletedHourWindow } from './aggregator'

function queryChain(result: { all?: unknown[]; first?: unknown } = {}) {
  return {
    bind: vi.fn().mockReturnThis(),
    all: vi.fn().mockResolvedValue({ results: result.all ?? [] }),
    first: vi.fn().mockResolvedValue(result.first ?? null),
    run: vi.fn().mockResolvedValue({ meta: { changes: 1 } }),
  }
}

describe('completed aggregation windows', () => {
  it('小时聚合使用上一完整小时', () => {
    expect(getCompletedHourWindow(new Date('2026-07-25T08:23:45.000Z'))).toEqual({
      start: '2026-07-25T07:00:00.000Z',
      end: '2026-07-25T08:00:00.000Z',
    })
  })

  it('日聚合使用上一完整 UTC 日', () => {
    expect(getCompletedDayWindow(new Date('2026-07-25T02:00:00.000Z'))).toEqual({
      start: '2026-07-24T00:00:00.000Z',
      end: '2026-07-25T00:00:00.000Z',
    })
  })
})

describe('aggregateHourly migration contract', () => {
  it('写入迁移定义的 p50_latency_ms/p95_latency_ms/p99_latency_ms 列', async () => {
    const preparedSql: string[] = []
    const db = {
      prepare: vi.fn((sql: string) => {
        preparedSql.push(sql)
        if (sql.includes('SELECT DISTINCT')) return queryChain({ all: [{ node_id: 'n1', target_id: 't1' }] })
        if (sql.includes('COUNT(*) as total_probes')) {
          return queryChain({ first: { total_probes: 1, success_count: 1, avg_latency: 10, min_latency: 10, max_latency: 10 } })
        }
        if (sql.includes('COUNT(*) as cnt')) return queryChain({ first: { cnt: 1 } })
        if (sql.includes('SELECT latency_ms')) return queryChain({ first: { latency_ms: 10 } })
        return queryChain()
      }),
    }

    await aggregateHourly({ DB: db } as any, new Date('2026-07-25T08:23:45.000Z'))

    const insert = preparedSql.find((sql) => sql.includes('INSERT OR REPLACE INTO probe_stats')) || ''
    expect(insert).toContain('p50_latency_ms')
    expect(insert).toContain('p95_latency_ms')
    expect(insert).toContain('p99_latency_ms')
    expect(insert).not.toContain('latency_p50')
  })
})
