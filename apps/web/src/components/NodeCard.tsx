// Braum 布隆 CF 探针 — VPS 节点状态卡片
import { formatBytes, formatDuration, formatTransferRate } from '@braum/shared'

interface Metrics {
  cpu_usage: number
  memory_used_bytes: number
  memory_total_bytes: number
  disk_used_bytes: number
  disk_total_bytes: number
  load_1: number
  network_rx_bytes: number
  network_tx_bytes: number
  network_rx_bytes_per_second: number | null
  network_tx_bytes_per_second: number | null
  tcp_connections: number
  uptime_seconds: number
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
  agentPlatform: string | null
  agentArch: string | null
  agentVersion: string | null
  avgLatency: number | null
  uptime: number | null
  sparkline: number[]
  metrics: Metrics | null
  realtimeConnected: boolean
  variant: 'detailed' | 'compact'
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

function ResourceBar({ label, value, detail, usage }: { label: string; value: number; detail: string; usage?: string }) {
  const color = value >= 90 ? 'bg-red-500' : value >= 75 ? 'bg-amber-500' : 'bg-emerald-500'
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between gap-3 text-xs">
        <span className="font-medium text-slate-600 dark:text-slate-300">{label}</span>
        <span className="min-w-0 text-right">
          <strong className="font-mono font-semibold text-slate-800 dark:text-slate-100">{detail}</strong>
          {usage && <span className="ml-1.5 font-mono text-[10px] text-slate-400">({usage})</span>}
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700/70">
        <div className={`h-full rounded-full transition-[width] duration-500 ${color}`} style={{ width: `${value}%` }} />
      </div>
    </div>
  )
}

function osFamily(value: string | null): string {
  if (!value) return 'Linux'
  const normalized = value.toLowerCase()
  const families: Array<[string, string]> = [
    ['debian', 'Debian'], ['ubuntu', 'Ubuntu'], ['alpine', 'Alpine'],
    ['centos', 'CentOS'], ['rocky', 'Rocky'], ['alma', 'AlmaLinux'],
    ['fedora', 'Fedora'], ['arch', 'Arch'], ['opensuse', 'openSUSE'],
  ]
  return families.find(([keyword]) => normalized.includes(keyword))?.[1] || value.split(/[\s/]+/)[0]
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
  const systemName = props.agentPlatform || props.agentOS
  const totalTraffic = metrics ? metrics.network_rx_bytes + metrics.network_tx_bytes : 0

  if (props.variant === 'compact') {
    return (
      <a href={`/node/${props.id}`} className="group block min-w-0 rounded-xl border border-slate-200/80 bg-white/90 p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-md dark:border-slate-700/80 dark:bg-slate-900/80 dark:hover:border-brand-700">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="truncate text-sm font-semibold text-slate-950 dark:text-white">{props.name}</h3>
            <p className="mt-1 truncate text-[11px] text-slate-500 dark:text-slate-400">
              {countryFlag(props.country)} {props.city || props.country || '位置待识别'}
            </p>
          </div>
          <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2 py-1 text-[11px] font-medium ${status.badge}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${status.dot}`} />
            {status.label}
          </span>
        </div>

        <div className="mt-3 flex items-center justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2 text-[11px] dark:bg-slate-800/60">
          <span className="min-w-0 truncate font-medium text-slate-700 dark:text-slate-200">
            {systemName ? osFamily(systemName) : '等待探针识别'}
          </span>
          <span className="shrink-0 font-mono text-slate-400">{props.agentArch || '--'}</span>
        </div>

        {metrics ? (
          <>
            <div className="mt-3 grid grid-cols-3 divide-x divide-slate-100 dark:divide-slate-800">
              <CompactMetric label="CPU" value={`${metrics.cpu_usage.toFixed(1)}%`} alert={metrics.cpu_usage} />
              <CompactMetric label="内存" value={`${memory.toFixed(1)}%`} alert={memory} />
              <CompactMetric label="磁盘" value={`${disk.toFixed(1)}%`} alert={disk} />
            </div>
            <div className="mt-3 space-y-2 border-t border-slate-100 pt-3 dark:border-slate-800">
              <div className="flex min-w-0 items-start justify-between gap-3">
                <p className="shrink-0 text-[10px] text-slate-400">实时网络</p>
                <p className="min-w-0 break-words text-right font-mono text-[11px] font-semibold leading-4 text-slate-700 dark:text-slate-200">
                  ↑{formatTransferRate(metrics.network_tx_bytes_per_second)} · ↓{formatTransferRate(metrics.network_rx_bytes_per_second)}
                </p>
              </div>
              <div className="flex min-w-0 items-start justify-between gap-3">
                <p className="shrink-0 text-[10px] text-slate-400">运行时间</p>
                <p className="min-w-0 break-words text-right font-mono text-[11px] font-semibold leading-4 text-slate-700 dark:text-slate-200">
                  {formatDuration(metrics.uptime_seconds)}
                </p>
              </div>
            </div>
          </>
        ) : (
          <div className="mt-3 rounded-lg border border-dashed border-slate-200 px-3 py-5 text-center text-xs text-slate-500 dark:border-slate-700 dark:text-slate-400">
            {pending ? '等待安装探针' : '暂未收到资源数据'}
          </div>
        )}

        <div className="mt-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-[10px] text-slate-400">
          <span>{metrics ? ageLabel(metrics.collected_at) : '尚未采集'}</span>
          <span className="shrink-0 font-mono">{props.avgLatency == null ? '--' : `${Math.round(props.avgLatency)}ms`}</span>
        </div>
      </a>
    )
  }

  return (
    <a href={`/node/${props.id}`} className="group block rounded-2xl border border-slate-200/80 bg-white/90 p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-lg dark:border-slate-700/80 dark:bg-slate-900/80 dark:hover:border-brand-700">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-base font-semibold text-slate-950 dark:text-white">{props.name}</h3>
          <p className="mt-1 truncate text-xs text-slate-500 dark:text-slate-400">{countryFlag(props.country)} {props.city || props.country}</p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1.5">
          <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${status.badge}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${status.dot}`} />
            {status.label}
          </span>
          {!pending && (
            <span className={`text-[10px] font-medium ${props.realtimeConnected ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'}`}>
              {props.realtimeConnected ? '● 实时通道' : '心跳模式'}
            </span>
          )}
        </div>
      </div>

      <div className="mt-4 rounded-xl border border-slate-100 bg-slate-50/80 px-3.5 py-3 dark:border-slate-800 dark:bg-slate-800/50">
        <div className="flex items-start justify-between gap-4">
          <span className="pt-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">OS</span>
          <div className="min-w-0 text-right">
            <p className="break-words text-sm font-semibold leading-5 text-slate-800 dark:text-slate-100">{systemName || '等待探针识别'}</p>
            <p className="mt-0.5 font-mono text-[11px] text-slate-400">{systemName ? `${osFamily(systemName)} / ${props.agentArch || '?'}` : '-- / --'}</p>
          </div>
        </div>
      </div>

      {metrics ? (
        <div className="mt-5 space-y-4">
          <ResourceBar label="CPU" value={metrics.cpu_usage} detail={`${metrics.cpu_usage.toFixed(1)}%`} />
          <ResourceBar label="内存" value={memory} detail={`${memory.toFixed(1)}%`} usage={`${formatBytes(metrics.memory_used_bytes)} / ${formatBytes(metrics.memory_total_bytes)}`} />
          <ResourceBar label="磁盘" value={disk} detail={`${disk.toFixed(1)}%`} usage={`${formatBytes(metrics.disk_used_bytes)} / ${formatBytes(metrics.disk_total_bytes)}`} />
        </div>
      ) : (
        <div className="mt-5 flex h-[91px] items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/70 px-4 text-center text-xs text-slate-500 dark:border-slate-700 dark:bg-slate-800/50 dark:text-slate-400">
          {pending ? '安装探针后开始采集服务器资源' : '暂未收到最新数据，请检查探针服务'}
        </div>
      )}

      {metrics && (
        <div className="mt-5 overflow-hidden rounded-xl border border-slate-100 bg-slate-50/80 dark:border-slate-800 dark:bg-slate-800/50">
          <DataRow
            label="总流量"
            note="本次开机"
            value={formatBytes(totalTraffic)}
            detail={`↑ ${formatBytes(metrics.network_tx_bytes)}  ↓ ${formatBytes(metrics.network_rx_bytes)}`}
          />
          <DataRow
            label="实时网络"
            value={`↑ ${formatTransferRate(metrics.network_tx_bytes_per_second)}`}
            detail={`↓ ${formatTransferRate(metrics.network_rx_bytes_per_second)}`}
          />
          <DataRow label="运行时间" value={formatDuration(metrics.uptime_seconds)} />
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
        <span>{props.agentVersion ? `探针 ${props.agentVersion}` : '查看详情 →'}</span>
      </div>
    </a>
  )
}

function CompactMetric({ label, value, alert }: { label: string; value: string; alert: number }) {
  const color = alert >= 90
    ? 'text-red-600 dark:text-red-400'
    : alert >= 75
      ? 'text-amber-600 dark:text-amber-400'
      : 'text-slate-800 dark:text-slate-100'
  return (
    <div className="px-2 text-center first:pl-0 last:pr-0">
      <p className={`font-mono text-sm font-semibold ${color}`}>{value}</p>
      <p className="mt-0.5 text-[10px] text-slate-400">{label}</p>
    </div>
  )
}

function DataRow({ label, note, value, detail }: { label: string; note?: string; value: string; detail?: string }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-slate-100 px-3.5 py-3 last:border-b-0 dark:border-slate-700/70">
      <div className="shrink-0">
        <p className="text-xs font-medium text-slate-600 dark:text-slate-300">{label}</p>
        {note && <p className="mt-0.5 text-[10px] text-slate-400">{note}</p>}
      </div>
      <div className="min-w-0 text-right font-mono">
        <p className="break-words text-xs font-semibold text-slate-800 dark:text-slate-100">{value}</p>
        {detail && <p className="mt-0.5 break-words text-[10px] text-slate-400">{detail}</p>}
      </div>
    </div>
  )
}
