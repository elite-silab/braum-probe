import type { Metadata } from 'next'
import { fetchApi } from '../../../../lib/server-api'

export const dynamic = 'force-dynamic'

const statusLabels: Record<string, string> = { investigating: '调查中', identified: '已确认', monitoring: '观察中', resolved: '已解决' }
const statusColors: Record<string, string> = { investigating: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400', identified: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400', monitoring: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400', resolved: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' }
const severityLabels: Record<string, string> = { info: '信息', warning: '警告', critical: '严重' }
const severityColors: Record<string, string> = { info: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400', warning: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400', critical: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' }

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params
  return { title: `公告 ${id}` }
}

export default async function IncidentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const result = await fetchApi<any>(`/api/v1/incidents/${encodeURIComponent(id)}`)
  const incident = result.data
  const updates = Array.isArray(incident?.updates) ? incident.updates : []

  return <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8"><nav className="mb-6 flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400"><a href="/" className="hover:text-slate-900 dark:hover:text-white">总览</a><span>/</span><a href="/incidents" className="hover:text-slate-900 dark:hover:text-white">公告</a><span>/</span><span className="text-slate-900 dark:text-white">{incident?.title || `公告 ${id}`}</span></nav>{incident ? <><div className="card mb-6"><div className="flex items-start justify-between gap-4"><div><h1 className="text-2xl font-bold text-slate-900 dark:text-white">{incident.title}</h1><p className="mt-2 text-sm text-slate-500 dark:text-slate-400">创建于 {formatDate(incident.created_at)}{incident.updated_at && incident.updated_at !== incident.created_at && <span> · 更新于 {formatDate(incident.updated_at)}</span>}</p></div><div className="flex gap-2"><Badge className={statusColors[incident.status]}>{statusLabels[incident.status] || incident.status}</Badge><Badge className={severityColors[incident.severity]}>{severityLabels[incident.severity] || incident.severity}</Badge></div></div></div>{incident.description && <div className="card mb-6"><h2 className="mb-3 text-lg font-semibold text-slate-900 dark:text-white">详情</h2><p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700 dark:text-slate-300">{incident.description}</p></div>}<div className="card"><h2 className="mb-4 text-lg font-semibold text-slate-900 dark:text-white">更新时间线</h2>{updates.length ? <div className="space-y-4">{updates.map((update: any) => <div key={update.id || update.created_at} className="border-l-2 border-brand-300 pl-4 dark:border-brand-700"><div className="flex items-center gap-2">{update.status && <Badge className={statusColors[update.status]}>{statusLabels[update.status] || update.status}</Badge>}<span className="text-xs text-slate-500 dark:text-slate-400">{formatDate(update.created_at)}</span></div><p className="mt-1 text-sm text-slate-700 dark:text-slate-300">{update.message}</p></div>)}</div> : <p className="text-sm text-slate-400 dark:text-slate-500">暂无更新记录</p>}{incident.resolved_at && <div className="mt-6 rounded-lg bg-emerald-50 p-4 dark:bg-emerald-900/20"><p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">此事件已于 {formatDate(incident.resolved_at)} 解决</p></div>}</div></> : <div className="card text-center"><p className="text-slate-500 dark:text-slate-400">公告不存在或无法访问</p><a href="/incidents" className="mt-4 inline-block text-brand-600 hover:text-brand-700 dark:text-brand-400">返回公告列表</a></div>}</div>
}

function Badge({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${className || ''}`}>{children}</span>
}

function formatDate(value: string) {
  return new Date(value).toLocaleString('zh-CN')
}
