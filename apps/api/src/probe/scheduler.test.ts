import { describe, expect, it, vi } from 'vitest'
import { checkNodeHeartbeats, handleScheduled } from './scheduler'

describe('Agent heartbeat scheduler', () => {
  it('离线判定只依赖 Agent 心跳且保留暂停节点状态', async () => {
    let sql = ''
    const chain = {
      run: vi.fn().mockResolvedValue({ meta: { changes: 0 } }),
    }
    const env = {
      DB: {
        prepare: vi.fn((query: string) => {
          sql = query
          return chain
        }),
      },
    }

    await checkNodeHeartbeats(env as any)

    expect(sql).toContain("status != 'paused'")
    expect(sql).toContain('last_heartbeat_at')
    expect(sql).toContain('probe_interval')
    expect(sql).toContain('180.0')
  })

  it('每分钟 Cron 不再代表 VPS 执行中心探测', async () => {
    const queries: string[] = []
    const env = {
      DB: {
        prepare: vi.fn((query: string) => {
          queries.push(query)
          return { run: vi.fn().mockResolvedValue({ meta: { changes: 0 } }) }
        }),
      },
    }

    await handleScheduled(
      { cron: '* * * * *' } as ScheduledEvent,
      env as any,
      {} as ExecutionContext,
    )

    expect(queries).toHaveLength(1)
    expect(queries[0]).toContain('UPDATE nodes')
    expect(queries.join('\n')).not.toContain('node_targets')
  })
})
