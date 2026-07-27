import type { Metadata } from 'next'
import { fetchApi } from '../../../lib/server-api'

export const metadata: Metadata = { title: '运行公告' }
export const dynamic = 'force-dynamic'

const statusLabels: Record<string, string> = {
  investigating: '调查中',
  identified: '已定位',
  monitoring: '观察中',
  resolved: '已解决',
  scheduled: '计划中',
}

const statusColors: Record<string, string> = {
  investigating: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  identified: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  monitoring: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  resolved: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  scheduled: 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300',
}

export default async function IncidentsPage() {
  const result = await fetchApi<any>('/api/v1/incidents')
  const source = result.data as any
  const incidents = Array.isArray(source?.results) ? source.results : Array.isArray(source) ? source : []

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <header className="mb-8 max-w-2xl">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-600 dark:text-brand-400">Service updates</p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight text-slate-950 dark:text-white sm:text-4xl">运行公告</h1>
        <p className="mt-3 text-sm leading-6 text-slate-500 dark:text-slate-400 sm:text-base">
          集中查看维护安排、故障影响与恢复进展，重要变化会持续更新。
        </p>
      </header>

      {!result.ok ? (
        <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-6 dark:border-red-900/60 dark:bg-red-950/30">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-100 text-red-600 dark:bg-red-900/50 dark:text-red-300">
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 9v4" /><path d="M12 17h.01" /><path d="M10.3 3.9 2.6 17.2A2 2 0 0 0 4.3 20h15.4a2 2 0 0 0 1.7-2.8L13.7 3.9a2 2 0 0 0-3.4 0Z" /></svg>
            </span>
            <div>
              <h2 className="font-semibold text-red-900 dark:text-red-100">公告暂时无法加载</h2>
              <p className="mt-1 text-sm text-red-700 dark:text-red-200">请稍后刷新页面。服务器状态仍可在总览页查看。</p>
            </div>
          </div>
        </div>
      ) : incidents.length === 0 ? (
        <div className="rounded-2xl border border-emerald-200/80 bg-white p-8 text-center shadow-sm dark:border-emerald-900/50 dark:bg-slate-900 sm:p-12">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-400">
            <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m5 12 4 4L19 6" /></svg>
          </span>
          <h2 className="mt-5 text-lg font-semibold text-slate-900 dark:text-white">当前没有维护或故障公告</h2>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">所有服务保持正常运行。</p>
        </div>
      ) : (
        <div className="space-y-3">
          {incidents.map((incident: any) => (
            <a
              key={incident.id}
              href={`/incidents/${incident.id}`}
              className="group block rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-md dark:border-slate-700/80 dark:bg-slate-900 dark:hover:border-brand-700 sm:p-6"
            >
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-xs text-slate-400">
                    <span>{formatDate(incident.created_at)}</span>
                    {incident.updated_at && incident.updated_at !== incident.created_at && <span>· 已更新</span>}
                  </div>
                  <h2 className="mt-2 text-base font-semibold text-slate-900 transition-colors group-hover:text-brand-700 dark:text-white dark:group-hover:text-brand-300">
                    {incident.title}
                  </h2>
                  {incident.description && <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-500 dark:text-slate-400">{incident.description}</p>}
                </div>
                <span className={`inline-flex w-fit shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${statusColors[incident.status] || statusColors.monitoring}`}>
                  {statusLabels[incident.status] || incident.status}
                </span>
              </div>
            </a>
          ))}
        </div>
      )}
    </div>
  )
}

function formatDate(value: string) {
  return value ? new Date(value).toLocaleString('zh-CN') : '--'
}
