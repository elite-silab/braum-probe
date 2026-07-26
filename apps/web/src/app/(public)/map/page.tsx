import type { CSSProperties } from 'react'
import type { Metadata } from 'next'
import { fetchApi } from '../../../lib/server-api'

export const metadata: Metadata = { title: '节点分布' }
export const dynamic = 'force-dynamic'

const regionLabels: Record<string, string> = {
  asia: '亚洲', europe: '欧洲', north_america: '北美洲', south_america: '南美洲', oceania: '大洋洲', africa: '非洲',
}

function nodeState(node: any) {
  if (node.registration_status === 'pending') return { label: '等待安装', color: 'bg-slate-400', ring: 'ring-slate-300' }
  if (node.status === 'active') return { label: '在线', color: 'bg-emerald-500', ring: 'ring-emerald-300' }
  if (node.status === 'paused') return { label: '暂停', color: 'bg-amber-500', ring: 'ring-amber-300' }
  return { label: '离线', color: 'bg-red-500', ring: 'ring-red-300' }
}

function pointStyle(node: any): CSSProperties {
  const longitude = Math.max(-180, Math.min(180, Number(node.longitude) || 0))
  const latitude = Math.max(-90, Math.min(90, Number(node.latitude) || 0))
  return { left: `${(longitude + 180) / 360 * 100}%`, top: `${(90 - latitude) / 180 * 100}%` }
}

export default async function MapPage() {
  const result = await fetchApi<any[]>('/api/v1/nodes?page_size=100')
  const nodes = Array.isArray(result.data) ? result.data : []
  const locatedNodes = nodes.filter((node) => node.country !== '待识别' && node.city !== '待识别' && !(Number(node.latitude) === 0 && Number(node.longitude) === 0))

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8"><p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-600 dark:text-brand-400">Infrastructure map</p><h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950 dark:text-white">VPS 节点分布</h1><p className="mt-2 max-w-2xl text-slate-500 dark:text-slate-400">位置由 VPS Agent 首次连接时自动识别，也可以在后台手动修正。</p></div>
      {!result.ok && <div role="alert" className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/30 dark:text-red-200">暂时无法加载节点分布，请稍后刷新。</div>}

      <section className="overflow-hidden rounded-3xl border border-slate-200 bg-slate-950 shadow-xl dark:border-slate-700">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-5 py-4 text-white">
          <div><h2 className="font-semibold">全球节点视图</h2><p className="mt-0.5 text-xs text-slate-400">{locatedNodes.length} 个已定位 · {nodes.length} 个节点</p></div>
          <div className="flex gap-4 text-xs text-slate-300"><span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-emerald-500" />在线</span><span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-red-500" />离线</span><span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-slate-400" />待安装</span></div>
        </div>
        <div className="relative aspect-[16/8] min-h-80 overflow-hidden bg-[radial-gradient(circle_at_50%_45%,#1e3a5f_0%,#0f172a_55%,#020617_100%)]">
          <div className="absolute inset-0 opacity-30" style={{ backgroundImage: 'linear-gradient(rgba(148,163,184,.25) 1px,transparent 1px),linear-gradient(90deg,rgba(148,163,184,.25) 1px,transparent 1px)', backgroundSize: '10% 20%' }} />
          <div className="absolute inset-x-[8%] top-[21%] h-[28%] rounded-[45%] border border-dashed border-slate-500/30" />
          <div className="absolute left-[12%] top-[31%] h-[31%] w-[21%] rotate-[-8deg] rounded-[55%_40%_60%_35%] bg-slate-700/30" />
          <div className="absolute left-[44%] top-[25%] h-[28%] w-[18%] rounded-[40%_55%_45%_60%] bg-slate-700/30" />
          <div className="absolute left-[66%] top-[28%] h-[25%] w-[22%] rounded-[55%_40%_60%_35%] bg-slate-700/30" />
          <div className="absolute left-[75%] top-[65%] h-[12%] w-[10%] rotate-12 rounded-[50%] bg-slate-700/30" />
          {locatedNodes.map((node) => {
            const state = nodeState(node)
            return <a key={node.id} href={`/node/${node.id}`} className="group absolute z-10 -translate-x-1/2 -translate-y-1/2" style={pointStyle(node)} aria-label={`${node.name}，${state.label}`}><span className={`absolute -inset-2 rounded-full opacity-20 ${node.status === 'active' ? `animate-ping ${state.color}` : 'hidden'}`} /><span className={`relative block h-3.5 w-3.5 rounded-full border-2 border-white shadow-lg ring-4 ring-opacity-30 ${state.color} ${state.ring}`} /><span className="pointer-events-none absolute bottom-5 left-1/2 hidden w-max -translate-x-1/2 rounded-lg border border-white/10 bg-slate-950/95 px-3 py-2 text-xs text-white shadow-xl group-hover:block group-focus:block"><strong className="block">{node.name}</strong><span className="mt-1 block text-slate-400">{node.city}, {node.country} · {state.label}</span></span></a>
          })}
        </div>
      </section>

      <section className="mt-8">
        <div className="mb-4 flex items-center justify-between"><h2 className="text-xl font-semibold text-slate-900 dark:text-white">节点目录</h2><span className="text-sm text-slate-400">按配置地区展示</span></div>
        {nodes.length ? <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{nodes.map((node) => {
          const state = nodeState(node)
          return <a key={node.id} href={`/node/${node.id}`} className="rounded-2xl border border-slate-200 bg-white p-5 transition hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-md dark:border-slate-700 dark:bg-slate-900 dark:hover:border-brand-700"><div className="flex items-start justify-between gap-3"><div><h3 className="font-semibold text-slate-900 dark:text-white">{node.name}</h3><p className="mt-1 text-xs text-slate-500">{node.city}, {node.country} · {regionLabels[node.region] || node.region}</p></div><span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs text-white ${state.color}`}><i className="h-1.5 w-1.5 rounded-full bg-white" />{state.label}</span></div><div className="mt-4 grid grid-cols-3 gap-2 border-t border-slate-100 pt-4 text-xs dark:border-slate-800"><Metric value={node.latest_metrics ? `${Number(node.latest_metrics.cpu_usage).toFixed(1)}%` : '--'} label="CPU" /><Metric value={node.avg_latency == null ? '--' : `${Math.round(node.avg_latency)}ms`} label="延迟" /><Metric value={node.uptime == null ? '--' : `${Number(node.uptime).toFixed(2)}%`} label="可用率" /></div></a>
        })}</div> : <div className="rounded-2xl border border-dashed border-slate-300 p-10 text-center text-slate-500 dark:border-slate-700">还没有可展示的 VPS 节点</div>}
      </section>
    </div>
  )
}

function Metric({ value, label }: { value: string; label: string }) {
  return <div><p className="font-mono font-semibold text-slate-800 dark:text-slate-100">{value}</p><p className="mt-1 text-slate-400">{label}</p></div>
}
