import type { Metadata } from 'next'
import { fetchApi } from '../../../lib/server-api'

export const metadata: Metadata = { title: '系统公告' }
export const dynamic = 'force-dynamic'

const statusLabels: Record<string, string> = { investigating: '调查中', identified: '已确认', monitoring: '观察中', resolved: '已解决' }
const statusColors: Record<string, string> = {
  investigating: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  identified: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  monitoring: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  resolved: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
}

export default async function IncidentsPage() {
  const result = await fetchApi<any>('/api/v1/incidents')
  const source = result.data as any
  const incidents = Array.isArray(source?.results) ? source.results : Array.isArray(source) ? source : []

  return <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8"><h1 className="mb-4 text-3xl font-bold text-slate-900 dark:text-white">系统公告</h1><p className="mb-8 text-slate-500 dark:text-slate-400">查看系统维护、故障通知和事件记录</p>{incidents.length === 0 ? <div className="card text-center"><svg className="mx-auto h-12 w-12 text-slate-300 dark:text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg><p className="mt-4 text-slate-500 dark:text-slate-400">当前无活跃公告，所有系统运行正常</p></div> : <div className="space-y-4">{incidents.map((incident: any) => <a key={incident.id} href={`/incidents/${incident.id}`} className="card block transition-shadow hover:shadow-md"><div className="flex items-start justify-between"><div><h3 className="font-medium text-slate-900 dark:text-white">{incident.title}</h3><p className="mt-1 text-sm text-slate-500 dark:text-slate-400">创建于 {incident.created_at}</p></div><span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${statusColors[incident.status] || ''}`}>{statusLabels[incident.status] || incident.status}</span></div></a>)}</div>}</div>
}
