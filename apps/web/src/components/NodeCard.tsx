// Braum 布隆 CF 探针 — VPS 节点状态卡片

interface Metrics {
  cpu_usage: number
  memory_used_bytes: number
  memory_total_bytes: number
  disk_used_bytes: number
  disk_total_bytes: number
  load_1: number
  collected_at: string
}

interface NodeCardProps {
  id: string
  name: string
  country: string
  city: string
  status: string
  registrationStatus: 'pending' | 'registered'
  agentOS: string | null
  agentArch: string | null
  agentVersion: string | null
  avgLatency: number | null
  uptime: number | null
  sparkline: number[]
  metrics: Metrics | null
}

function countryFlag(country: string): string {
  const normalized = country.trim().toUpperCase()
  if (/^[A-Z]{2}$/.test(normalized)) {
    return String.fromCodePoint(...[...normalized].map(char => 127397 + char.charCodeAt(0)))
  }
  const map: Record<string, string> = {
    中国: '🇨🇳', 日本: '🇯🇵', 新加坡: '🇸🇬', 德国: '🇩🇪',
    美国: '🇺🇸', 英国: '🇬🇧', 法国: '🇫🇷', 韩国: '🇰🇷',
  }
  return map[country] || '🌐'
}

function percent(used: number, total: number): number {
  if (!Number.isFinite(used) || !Number.isFinite(total) || total <= 0) return 0
  return Math.min(100, Math.max(0, used / total * 100))
}

function ageLabel(value: string): string {
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 1000))
  if (seconds < 10) return '刚刚采集'
  if (seconds < 60) return `${seconds} 秒前采集`
  if (seconds < 3600) return `${Math.floor(seconds / 60)} 分钟前采集`
  return `${Math.floor(seconds / 3600)} 小时前采集`
}

function ResourceBar({ label, value, detail }: { label: string; value: number; detail: string }) {
  const color = value >= 90 ? 'bg-red-500' : value >= 75 ? 'bg-amber-500' : 'bg-emerald-500'
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between text-xs">
        <span className="text-slate-500 dark:text-slate-400">{label}</span>
        <span className="font-mono font-medium text-slate-700 dark:text-slate-200">{detail}</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700/70">
        <div className={`h-full rounded-full transition-[width] duration-500 ${color}`} style={{ width: `${value}%` }} />
      </div>
    </div>
  )
}

function Sparkline({ data, id }: { data: number[]; id: string }) {
  const pointsData = data.filter(value => Number.isFinite(value) && value > 0)
  if (pointsData.length < 2) return <div className="h-8 rounded-lg bg-slate-50 dark:bg-slate-800/60" />
  const width = 200
  const height = 28
  const max = Math.max(...data, 1)
  const points = data.map((value, index) => {
    const x = data.length === 1 ? 0 : index / (data.length - 1) * width
    const y = height - Math.max(0, value) / max * (height - 5) - 2
    return `${x},${y}`
  }).join(' ')
  const gradientId = `spark-${id.replace(/[^a-zA-Z0-9_-]/g, '')}`

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-8 w-full" preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--theme-primary)" stopOpacity=".22" />
          <stop offset="100%" stopColor="var(--theme-primary)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={`0,${height} ${points} ${width},${height}`} fill={`url(#${gradientId})`} />
      <polyline points={points} fill="none" stroke="var(--theme-primary)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export default function NodeCard(props: NodeCardProps) {
  const { metrics } = props
  const pending = props.registrationStatus === 'pending'
  const offline = !pending && props.status === 'offline'
  const paused = props.status === 'paused'
  const status = pending
    ? { label: '等待安装', dot: 'bg-slate-400', badge: 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300' }
    : paused
      ? { label: '已暂停', dot: 'bg-amber-500', badge: 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' }
      : offline
        ? { label: '离线', dot: 'bg-red-500', badge: 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300' }
        : { label: '在线', dot: 'bg-emerald-500', badge: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' }
  const memory = metrics ? percent(metrics.memory_used_bytes, metrics.memory_total_bytes) : 0
  const disk = metrics ? percent(metrics.disk_used_bytes, metrics.disk_total_bytes) : 0

  return (
    <a href={`/node/${props.id}`} className="group block rounded-2xl border border-slate-200/80 bg-white/90 p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-lg dark:border-slate-700/80 dark:bg-slate-900/80 dark:hover:border-brand-700">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-base font-semibold text-slate-950 dark:text-white">{props.name}</h3>
          <p className="mt-1 truncate text-xs text-slate-500 dark:text-slate-400">
            {countryFlag(props.country)} {props.city || props.country}
            {props.agentOS && ` · ${props.agentOS}/${props.agentArch || '?'}`}
          </p>
        </div>
        <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${status.badge}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${status.dot}`} />
          {status.label}
        </span>
      </div>

      {metrics ? (
        <div className="mt-5 space-y-3.5">
          <ResourceBar label="CPU" value={metrics.cpu_usage} detail={`${metrics.cpu_usage.toFixed(1)}%`} />
          <ResourceBar label="内存" value={memory} detail={`${memory.toFixed(1)}%`} />
          <ResourceBar label="磁盘" value={disk} detail={`${disk.toFixed(1)}%`} />
        </div>
      ) : (
        <div className="mt-5 flex h-[91px] items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/70 px-4 text-center text-xs text-slate-500 dark:border-slate-700 dark:bg-slate-800/50 dark:text-slate-400">
          {pending ? '安装 Agent 后开始采集 VPS 资源指标' : '暂无最新资源数据，请检查 Agent 服务'}
        </div>
      )}

      <div className="mt-5 grid grid-cols-3 gap-2 border-t border-slate-100 pt-4 dark:border-slate-800">
        <div>
          <p className="font-mono text-sm font-semibold text-slate-800 dark:text-slate-100">{props.avgLatency == null ? '--' : `${Math.round(props.avgLatency)}ms`}</p>
          <p className="mt-0.5 text-[11px] text-slate-400">探测延迟</p>
        </div>
        <div>
          <p className="font-mono text-sm font-semibold text-slate-800 dark:text-slate-100">{props.uptime == null ? '--' : `${props.uptime.toFixed(2)}%`}</p>
          <p className="mt-0.5 text-[11px] text-slate-400">24h 可用率</p>
        </div>
        <div>
          <p className="font-mono text-sm font-semibold text-slate-800 dark:text-slate-100">{metrics ? metrics.load_1.toFixed(2) : '--'}</p>
          <p className="mt-0.5 text-[11px] text-slate-400">系统负载</p>
        </div>
      </div>

      <div className="mt-3"><Sparkline data={props.sparkline} id={props.id} /></div>
      <div className="mt-2 flex items-center justify-between text-[11px] text-slate-400">
        <span>{metrics ? ageLabel(metrics.collected_at) : '尚未采集'}</span>
        <span>{props.agentVersion ? `Agent ${props.agentVersion}` : '查看详情 →'}</span>
      </div>
    </a>
  )
}
