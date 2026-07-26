export interface NetworkCounterSample {
  network_rx_bytes: number
  network_tx_bytes: number
  collected_at: string
}

export interface NetworkRatePoint {
  collected_at: string
  rx_bytes_per_second: number
  tx_bytes_per_second: number
}

/** 根据累计网络字节差计算采样区间平均速度；计数器重置时该方向速度归零。 */
export function calculateNetworkRateSeries(samples: NetworkCounterSample[]): NetworkRatePoint[] {
  const ordered = samples
    .filter(sample => Number.isFinite(sample.network_rx_bytes)
      && Number.isFinite(sample.network_tx_bytes)
      && Number.isFinite(Date.parse(sample.collected_at)))
    .slice()
    .sort((a, b) => Date.parse(a.collected_at) - Date.parse(b.collected_at))

  const result: NetworkRatePoint[] = []
  for (let index = 1; index < ordered.length; index++) {
    const previous = ordered[index - 1]
    const current = ordered[index]
    const seconds = (Date.parse(current.collected_at) - Date.parse(previous.collected_at)) / 1000
    if (seconds <= 0) continue

    const rxDelta = current.network_rx_bytes - previous.network_rx_bytes
    const txDelta = current.network_tx_bytes - previous.network_tx_bytes
    result.push({
      collected_at: current.collected_at,
      rx_bytes_per_second: rxDelta >= 0 ? rxDelta / seconds : 0,
      tx_bytes_per_second: txDelta >= 0 ? txDelta / seconds : 0,
    })
  }
  return result
}

export function formatBytes(value: number): string {
  if (!Number.isFinite(value) || value < 0) return '--'
  const units = ['B', 'KB', 'MB', 'GB', 'TB', 'PB']
  let size = value
  let unit = 0
  while (size >= 1024 && unit < units.length - 1) {
    size /= 1024
    unit++
  }
  const decimals = unit === 0 || size >= 100 ? 0 : size >= 10 ? 1 : 2
  return `${size.toFixed(decimals)} ${units[unit]}`
}

export function formatTransferRate(value: number | null | undefined): string {
  return value == null || !Number.isFinite(value) ? '--' : `${formatBytes(value)}/s`
}

export function formatDuration(totalSeconds: number): string {
  if (!Number.isFinite(totalSeconds) || totalSeconds < 0) return '--'
  const seconds = Math.floor(totalSeconds)
  const days = Math.floor(seconds / 86400)
  const hours = Math.floor((seconds % 86400) / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  if (days > 0) return `${days} 天 ${hours} 小时`
  if (hours > 0) return `${hours} 小时 ${minutes} 分钟`
  if (minutes > 0) return `${minutes} 分钟`
  return `${seconds} 秒`
}
