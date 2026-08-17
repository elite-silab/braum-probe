import { describe, expect, it, vi } from 'vitest'
import { checkNodeHeartbeats, handleScheduled } from './scheduler'

describe('Agent heartbeat scheduler', () => {
  function createSchedulerEnv(queries: string[]) {
    const statement = {
      bind: vi.fn(() => statement),
      all: vi.fn().mockResolvedValue({ results: [] }),
      first: vi.fn().mockResolvedValue(null),
      run: vi.fn().mockResolvedValue({ meta: { changes: 0 } }),
    }

    return {
      DB: {
        prepare: vi.fn((query: string) => {
          queries.push(query)
          return statement
        }),
      },
    }
  }

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
      { cron: '* * * * *', scheduledTime: Date.UTC(2026, 7, 18, 1, 1) } as ScheduledEvent,
      env as any,
      {} as ExecutionContext,
    )

    expect(queries).toHaveLength(1)
    expect(queries[0]).toContain('UPDATE nodes')
    expect(queries.join('\n')).not.toContain('node_targets')
  })

  it('单一每分钟 Cron 在偶数分钟同时执行心跳与告警', async () => {
    const queries: string[] = []
    const env = createSchedulerEnv(queries)

    await handleScheduled(
      { cron: '* * * * *', scheduledTime: Date.UTC(2026, 7, 18, 1, 2) } as ScheduledEvent,
      env as any,
      {} as ExecutionContext,
    )

    const sql = queries.join('\n')
    expect(sql).toContain('UPDATE nodes')
    expect(sql).toContain('SELECT * FROM alert_rules')
    expect(sql).not.toContain('SELECT DISTINCT node_id, target_id')
  })

  it('单一每分钟 Cron 在 UTC 02:00 执行小时与日聚合', async () => {
    const queries: string[] = []
    const env = createSchedulerEnv(queries)

    await handleScheduled(
      { cron: '* * * * *', scheduledTime: Date.UTC(2026, 7, 18, 2, 0) } as ScheduledEvent,
      env as any,
      {} as ExecutionContext,
    )

    const sql = queries.join('\n')
    expect(sql).toContain('UPDATE nodes')
    expect(sql).toContain('SELECT * FROM alert_rules')
    expect(sql).toContain('FROM probe_results')
    expect(sql).toContain("period = 'hourly'")
    expect(sql).not.toContain('DELETE FROM probe_results')
  })

  it('单一每分钟 Cron 在 UTC 03:00 执行过期数据清理', async () => {
    const queries: string[] = []
    const env = createSchedulerEnv(queries)

    await handleScheduled(
      { cron: '* * * * *', scheduledTime: Date.UTC(2026, 7, 18, 3, 0) } as ScheduledEvent,
      env as any,
      {} as ExecutionContext,
    )

    const sql = queries.join('\n')
    expect(sql).toContain('DELETE FROM probe_results')
    expect(sql).toContain('DELETE FROM probe_stats')
    expect(sql).toContain('DELETE FROM node_metrics')
    expect(sql).not.toContain("period = 'hourly' AND period_start")
  })

  it('单项任务失败不会阻断同一分钟的其他任务', async () => {
    const queries: string[] = []
    const errorLog = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const env = {
      DB: {
        prepare: vi.fn((query: string) => {
          queries.push(query)
          if (query.includes('UPDATE nodes')) {
            return { run: vi.fn().mockRejectedValue(new Error('heartbeat failed')) }
          }
          return { all: vi.fn().mockResolvedValue({ results: [] }) }
        }),
      },
    }

    await handleScheduled(
      { cron: '* * * * *', scheduledTime: Date.UTC(2026, 7, 18, 1, 2) } as ScheduledEvent,
      env as any,
      {} as ExecutionContext,
    )

    expect(queries.join('\n')).toContain('SELECT * FROM alert_rules')
    expect(errorLog).toHaveBeenCalledWith(expect.stringContaining('agent_heartbeat_check'))
    errorLog.mockRestore()
  })
})
