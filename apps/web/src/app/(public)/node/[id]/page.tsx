import type { Metadata } from 'next'
import StatusDot from '../../../../components/StatusDot'
import { fetchApi } from '../../../../lib/server-api'

export const metadata: Metadata = { title: '节点详情' }
export const dynamic = 'force-dynamic'

const statusMap: Record<string, string> = { active: '在线', online: '在线', offline: '离线', degraded: '降级', paused: '暂停' }
const regionLabels: Record<string, string> = { asia: '亚洲', europe: '欧洲', north_america: '北美洲', south_america: '南美洲', oceania: '大洋洲', africa: '非洲' }

export default async function NodePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const encodedId = encodeURIComponent(id)
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString()
  const [nodeResult, probesResult] = await Promise.all([
    fetchApi<any>(`/api/v1/nodes/${encodedId}`),
    fetchApi<any>(`/api/v1/probe-results?node_id=${encodedId}&page_size=200&start_time=${encodeURIComponent(thirtyDaysAgo)}`),
  ])
  const node = nodeResult.data
  const probeSource = probesResult.data
  const probeResults: any[] = Array.isArray(probeSource?.results) ? probeSource.results : Array.isArray(probeSource) ? probeSource : []

  if (!node) return <MissingNode id={id} />

  const latestMetrics = node.latest_metrics || null
  const agent = node.agent || null
  const metricsHistory: any[] = Array.isArray(node.metrics_history) ? node.metrics_history : []
  const availability = calculateAvailability(node.availability_windows, probeResults)
  const memoryPercent = latestMetrics ? percent(latestMetrics.memory_used_bytes, latestMetrics.memory_total_bytes) : 0
  const diskPercent = latestMetrics ? percent(latestMetrics.disk_used_bytes, latestMetrics.disk_total_bytes) : 0
  const cpuPoints = seriesPoints(metricsHistory.map((item) => Number(item.cpu_usage) || 0))
  const memoryPoints = seriesPoints(metricsHistory.map((item) => percent(Number(item.memory_used_bytes), Number(item.memory_total_bytes))))

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <nav className="mb-6 flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400"><a href="/" className="hover:text-slate-900 dark:hover:text-white">总览</a><span>/</span><span className="text-slate-900 dark:text-white">{node.name || `节点 ${id}`}</span></nav>

      <div className="mb-6 rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div><h1 className="text-2xl font-bold text-slate-900 dark:text-white">{node.name}</h1><p className="mt-1 text-sm text-slate-500 dark:text-slate-400">ID: <code className="rounded bg-slate-100 px-2 py-0.5 dark:bg-slate-700">{id}</code></p></div>
          <div className="flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1.5 text-sm font-medium dark:bg-slate-800"><StatusDot status={node.status === 'active' ? 'online' : node.status === 'offline' ? 'offline' : 'degraded'} size="sm" /><span>{agent?.registration_status === 'pending' ? '等待安装 Agent' : statusMap[node.status] || node.status}</span></div>
        </div>
        <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-4"><Info label="主机名" value={agent?.hostname || '尚未上报'} /><Info label="区域" value={node.country === '待识别' ? '安装后自动识别' : regionLabels[node.region] || node.region} /><Info label="位置" value={node.city === '待识别' ? '安装后自动识别' : [node.city, node.country].filter(Boolean).join(', ') || '--'} /><Info label="探测间隔" value={`${node.probe_interval || 60}s`} /></div>
      </div>

      <section className="mb-6">
        <div className="mb-4 flex items-end justify-between"><div><h2 className="text-lg font-semibold text-slate-900 dark:text-white">VPS 资源</h2><p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{latestMetrics?.collected_at ? `采集于 ${formatDate(latestMetrics.collected_at)}` : '等待 Agent 首次上报'}</p></div>{agent?.agent_version && <span className="rounded-full bg-brand-50 px-3 py-1 text-xs text-brand-700 dark:bg-brand-950/40 dark:text-brand-300">Agent {agent.agent_version}</span>}</div>
        {latestMetrics ? <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <ResourceMetric label="CPU" value={`${Number(latestMetrics.cpu_usage).toFixed(1)}%`} percentage={Number(latestMetrics.cpu_usage)} detail={`${agent?.cpu_cores || '--'} 核`} />
          <ResourceMetric label="内存" value={`${memoryPercent.toFixed(1)}%`} percentage={memoryPercent} detail={`${formatBytes(latestMetrics.memory_used_bytes)} / ${formatBytes(latestMetrics.memory_total_bytes)}`} />
          <ResourceMetric label="磁盘" value={`${diskPercent.toFixed(1)}%`} percentage={diskPercent} detail={`${formatBytes(latestMetrics.disk_used_bytes)} / ${formatBytes(latestMetrics.disk_total_bytes)}`} />
          <ResourceMetric label="系统负载" value={Number(latestMetrics.load_1).toFixed(2)} percentage={Math.min(100, Number(latestMetrics.load_1) / Math.max(1, Number(agent?.cpu_cores) || 1) * 100)} detail={`5m ${Number(latestMetrics.load_5).toFixed(2)} · 15m ${Number(latestMetrics.load_15).toFixed(2)}`} />
        </div> : <div className="rounded-2xl border border-dashed border-slate-300 bg-white/70 p-10 text-center dark:border-slate-700 dark:bg-slate-900/70"><p className="font-medium text-slate-700 dark:text-slate-200">还没有收到资源指标</p><p className="mt-1 text-sm text-slate-500">请在管理后台为该节点生成安装命令，并在 VPS 上启动 Agent。</p></div>}
      </section>

      {metricsHistory.length > 1 && <div className="card mb-6"><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-semibold text-slate-900 dark:text-white">24 小时资源趋势</h2><div className="flex gap-4 text-xs text-slate-500"><Legend color="bg-brand-500" label="CPU" /><Legend color="bg-emerald-500" label="内存" /></div></div><svg viewBox="0 0 600 100" className="mt-5 h-36 w-full" preserveAspectRatio="none" role="img" aria-label="CPU 和内存使用率趋势"><line x1="0" y1="97" x2="600" y2="97" stroke="currentColor" className="text-slate-200 dark:text-slate-700" /><line x1="0" y1="50" x2="600" y2="50" stroke="currentColor" strokeDasharray="4 6" className="text-slate-200 dark:text-slate-700" /><polyline points={cpuPoints} fill="none" stroke="#3b82f6" strokeWidth="2" vectorEffect="non-scaling-stroke" /><polyline points={memoryPoints} fill="none" stroke="#10b981" strokeWidth="2" vectorEffect="non-scaling-stroke" /></svg></div>}

      {agent?.registration_status === 'registered' && <div className="card mb-6"><h2 className="mb-4 text-lg font-semibold text-slate-900 dark:text-white">主机信息</h2><dl className="grid gap-x-6 gap-y-4 text-sm sm:grid-cols-2 lg:grid-cols-4"><Description label="系统" value={[agent.platform || agent.os, agent.arch].filter(Boolean).join(' · ')} /><Description label="内核" value={agent.kernel_version || '--'} mono /><Description label="处理器" value={agent.cpu_model || '--'} /><Description label="运行时间" value={latestMetrics ? `${Math.floor(latestMetrics.uptime_seconds / 86400)} 天` : '--'} /></dl></div>}

      <div className="card mb-6"><h2 className="mb-4 text-lg font-semibold text-slate-900 dark:text-white">最近探测</h2>{probeResults.length ? <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="border-b border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800"><tr>{['目标', '状态', '延迟', 'HTTP Code', '时间'].map((label) => <th key={label} className="px-4 py-3 font-medium text-slate-500 dark:text-slate-400">{label}</th>)}</tr></thead><tbody className="divide-y divide-slate-100 dark:divide-slate-700">{probeResults.slice(0, 20).map((probe) => <tr key={probe.id || `${probe.target_id}-${probe.probe_at}`} className="hover:bg-slate-50 dark:hover:bg-slate-800/50"><td className="px-4 py-3 text-slate-700 dark:text-slate-300">{probe.target_name || probe.target_id?.slice(0, 8) || '--'}</td><td className="px-4 py-3"><span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${probe.success ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'}`}>{probe.success ? '成功' : '失败'}</span></td><td className="px-4 py-3 text-slate-700 dark:text-slate-300">{probe.latency_ms ? `${probe.latency_ms}ms` : '--'}</td><td className="px-4 py-3 text-slate-500 dark:text-slate-400">{probe.status_code || '--'}</td><td className="px-4 py-3 text-slate-500 dark:text-slate-400">{probe.probe_at ? formatDate(probe.probe_at) : '--'}</td></tr>)}</tbody></table></div> : <p className="text-center text-slate-400 dark:text-slate-500">暂无探测数据</p>}</div>

      <div className="card"><h2 className="mb-4 text-lg font-semibold text-slate-900 dark:text-white">可用率</h2><div className="space-y-3"><AvailabilityRow label="24 小时" {...availability.hours24} /><AvailabilityRow label="7 天" {...availability.days7} /><AvailabilityRow label="30 天" {...availability.days30} /></div></div>
    </div>
  )
}

function MissingNode({ id }: { id: string }) {
  return <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8"><div className="card text-center"><p className="text-slate-500 dark:text-slate-400">节点 {id} 不存在或无法访问</p><a href="/" className="mt-4 inline-block text-brand-600 hover:text-brand-700 dark:text-brand-400">返回首页</a></div></div>
}

function Info({ label, value }: { label: string; value: string }) { return <div><p className="text-sm text-slate-500 dark:text-slate-400">{label}</p><p className="mt-1 font-medium text-slate-900 dark:text-white">{value}</p></div> }
function Description({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) { return <div><dt className="text-slate-500">{label}</dt><dd className={`mt-1 truncate text-slate-900 dark:text-white ${mono ? 'font-mono text-xs' : 'font-medium'}`} title={value}>{value}</dd></div> }
function Legend({ color, label }: { color: string; label: string }) { return <span className="flex items-center gap-1.5"><i className={`h-2 w-2 rounded-full ${color}`} />{label}</span> }

function ResourceMetric({ label, value, percentage, detail }: { label: string; value: string; percentage: number; detail: string }) {
  const color = percentage >= 90 ? 'bg-red-500' : percentage >= 75 ? 'bg-amber-500' : 'bg-emerald-500'
  return <div className="rounded-2xl border border-slate-200/80 bg-white p-5 dark:border-slate-700 dark:bg-slate-900"><p className="text-xs font-medium uppercase tracking-wider text-slate-400">{label}</p><p className="mt-2 font-mono text-2xl font-bold text-slate-950 dark:text-white">{value}</p><div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700"><div className={`h-full rounded-full ${color}`} style={{ width: `${Math.min(100, Math.max(0, percentage))}%` }} /></div><p className="mt-2 truncate text-xs text-slate-500 dark:text-slate-400">{detail}</p></div>
}

function AvailabilityRow({ label, text, pct }: { label: string; text: string; pct: number }) {
  return <div><div className="flex justify-between text-sm"><span className="text-slate-500 dark:text-slate-400">{label}</span><span className="font-medium text-slate-900 dark:text-white">{text}</span></div><div className="mt-1 h-2 rounded-full bg-slate-100 dark:bg-slate-700"><div className="h-2 rounded-full bg-emerald-500" style={{ width: `${Math.min(100, Math.max(0, pct))}%` }} /></div></div>
}

function calculateAvailability(windows: any, results: any[]) {
  const fromValue = (value: number | null | undefined) => value == null ? { text: '--', pct: 0 } : { text: `${Number(value).toFixed(2)}%`, pct: Number(value) }
  if (windows) return { hours24: fromValue(windows.hours_24), days7: fromValue(windows.days_7), days30: fromValue(windows.days_30) }
  const now = Date.now()
  const calculate = (hours: number) => {
    const filtered = results.filter((item) => new Date(item.probe_at).getTime() >= now - hours * 3600000)
    if (!filtered.length) return { text: '--', pct: 0 }
    const pct = filtered.filter((item) => item.success).length / filtered.length * 100
    return { text: `${pct.toFixed(2)}%`, pct }
  }
  return { hours24: calculate(24), days7: calculate(168), days30: calculate(720) }
}

function percent(used: number, total: number) { return total > 0 ? Math.min(100, Math.max(0, used / total * 100)) : 0 }
function formatDate(value: string) { return new Date(value).toLocaleString('zh-CN') }
function formatBytes(value: number) {
  if (!Number.isFinite(value)) return '--'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let size = value
  let unit = 0
  while (size >= 1024 && unit < units.length - 1) { size /= 1024; unit++ }
  return `${size.toFixed(unit >= 3 ? 1 : 0)} ${units[unit]}`
}
function seriesPoints(values: number[], max = 100) {
  return values.map((value, index) => `${values.length <= 1 ? 0 : index / (values.length - 1) * 600},${100 - Math.min(max, Math.max(0, value)) / max * 94 - 3}`).join(' ')
}
