import { describe, expect, it } from 'vitest'
import {
  calculateNetworkRateSeries,
  formatBytes,
  formatDuration,
  formatTransferRate,
} from '@braum/shared'

describe('node metric presentation helpers', () => {
  it('根据相邻累计值计算上下行速率', () => {
    const points = calculateNetworkRateSeries([
      { network_rx_bytes: 1_000, network_tx_bytes: 2_000, collected_at: '2026-07-27T00:00:00Z' },
      { network_rx_bytes: 61_000, network_tx_bytes: 32_000, collected_at: '2026-07-27T00:01:00Z' },
    ])

    expect(points).toEqual([{
      collected_at: '2026-07-27T00:01:00Z',
      rx_bytes_per_second: 1_000,
      tx_bytes_per_second: 500,
    }])
  })

  it('节点重启导致累计计数器归零时不产生负速率', () => {
    const [point] = calculateNetworkRateSeries([
      { network_rx_bytes: 50_000, network_tx_bytes: 40_000, collected_at: '2026-07-27T00:00:00Z' },
      { network_rx_bytes: 500, network_tx_bytes: 200, collected_at: '2026-07-27T00:01:00Z' },
    ])

    expect(point.rx_bytes_per_second).toBe(0)
    expect(point.tx_bytes_per_second).toBe(0)
  })

  it('以适合界面的格式展示字节、速率和运行时间', () => {
    expect(formatBytes(1_610_612_736)).toBe('1.50 GB')
    expect(formatTransferRate(1_048_576)).toBe('1.00 MB/s')
    expect(formatDuration(183_720)).toBe('2 天 3 小时')
  })
})
