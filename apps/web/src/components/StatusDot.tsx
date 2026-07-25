// Braum 布隆 CF 探针 — 状态指示灯组件

type Status = 'online' | 'degraded' | 'offline' | 'unknown'

interface StatusDotProps {
  status: Status
  size?: 'sm' | 'md' | 'lg'
  pulse?: boolean
}

const statusColors: Record<Status, string> = {
  online: 'bg-emerald-500',
  degraded: 'bg-amber-500',
  offline: 'bg-red-500',
  unknown: 'bg-slate-400',
}

const sizeMap = {
  sm: 'h-2 w-2',
  md: 'h-3 w-3',
  lg: 'h-4 w-4',
}

export default function StatusDot({ status, size = 'md', pulse = true }: StatusDotProps) {
  return (
    <span className="relative inline-flex">
      {pulse && status === 'online' && (
        <span className={`absolute inline-flex h-full w-full animate-ping rounded-full ${statusColors[status]} opacity-40`} />
      )}
      <span className={`relative inline-flex rounded-full ${sizeMap[size]} ${statusColors[status]}`} />
    </span>
  )
}
