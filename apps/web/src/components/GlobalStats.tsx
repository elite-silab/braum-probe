// Braum 布隆 CF 探针 — 全局指标卡片（带颜色编码）

interface GlobalStatsProps {
  totalNodes: number
  onlineNodes: number
  totalTargets: number
  avgLatency: number
  uptime: number
  totalProbes: number
}

/** 可用率颜色：>= 99 绿 / 95-99 黄 / < 95 红 */
function uptimeColor(v: number) {
  if (v >= 99) return 'text-emerald-600 dark:text-emerald-400'
  if (v >= 95) return 'text-amber-600 dark:text-amber-400'
  return 'text-red-600 dark:text-red-400'
}

/** 延迟颜色：< 200 绿 / 200-500 黄 / >= 500 红 */
function latencyColor(v: number) {
  if (v < 200) return 'text-emerald-600 dark:text-emerald-400'
  if (v < 500) return 'text-amber-600 dark:text-amber-400'
  return 'text-red-600 dark:text-red-400'
}

export default function GlobalStats({
  totalNodes, onlineNodes, totalTargets, avgLatency, uptime, totalProbes,
}: GlobalStatsProps) {
  const hasProbeData = totalProbes > 0
  const stats = [
    {
      label: '在线服务器',
      value: `${onlineNodes}/${totalNodes}`,
      sub: '在线 / 总计',
      color: onlineNodes === totalNodes && totalNodes > 0
        ? 'text-emerald-600 dark:text-emerald-400'
        : onlineNodes < totalNodes * 0.8
          ? 'text-red-600 dark:text-red-400'
          : 'text-amber-600 dark:text-amber-400',
    },
    { label: '探测目标', value: String(totalTargets), sub: '网站与 DNS', color: '' },
    { label: '平均延迟', value: hasProbeData ? `${avgLatency}ms` : '--', sub: '最近 24 小时', color: hasProbeData ? latencyColor(avgLatency) : '' },
    { label: '服务可用率', value: hasProbeData ? `${uptime.toFixed(2)}%` : '--', sub: '最近 24 小时', color: hasProbeData ? uptimeColor(uptime) : '' },
    { label: '探测次数', value: totalProbes.toLocaleString(), sub: '最近 24 小时', color: '' },
  ]

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
      {stats.map((stat, index) => (
        <div key={stat.label} className={`group relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white/90 p-5 shadow-sm transition-shadow hover:shadow-md dark:border-slate-700/80 dark:bg-slate-900/80 ${index === stats.length - 1 ? 'col-span-2 sm:col-span-1' : ''}`}>
          <span className="absolute inset-x-0 top-0 h-0.5 origin-left scale-x-0 bg-brand-500 transition-transform group-hover:scale-x-100" aria-hidden="true" />
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{stat.label}</p>
          <p className={`mt-2 text-2xl font-bold transition-colors duration-500 ${stat.color || 'text-slate-900 dark:text-white'}`}>
            {stat.value}
          </p>
          <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">{stat.sub}</p>
        </div>
      ))}
    </div>
  )
}
