import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { fetchApi } from '../../../../lib/server-api'

export const dynamic = 'force-dynamic'

const statusLabels: Record<string, string> = {
  investigating: '调查中', identified: '已定位', monitoring: '观察中', resolved: '已解决', scheduled: '计划中',
}
const statusColors: Record<string, string> = {
  investigating: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  identified: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  monitoring: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  resolved: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  scheduled: 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300',
}
const severityLabels: Record<string, string> = { info: '一般通知', warning: '需要关注', critical: '严重影响' }
const severityColors: Record<string, string> = {
  info: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  warning: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  critical: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params
  return { title: `公告 ${id}` }
}

export default async function IncidentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const result = await fetchApi<any>(`/api/v1/incidents/${encodeURIComponent(id)}`)
  const incident = result.data
  const updates = Array.isArray(incident?.updates) ? incident.updates : []

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
      <nav className="mb-6 flex min-w-0 items-center gap-2 text-sm text-slate-500 dark:text-slate-400" aria-label="面包屑导航">
        <a href="/" className="shrink-0 hover:text-slate-900 dark:hover:text-white">总览</a>
        <span aria-hidden="true">/</span>
        <a href="/incidents" className="shrink-0 hover:text-slate-900 dark:hover:text-white">运行公告</a>
        {incident?.title && <><span aria-hidden="true">/</span><span className="truncate text-slate-900 dark:text-white">{incident.title}</span></>}
      </nav>

      {!result.ok || !incident ? (
        <div className="card py-12 text-center">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500">
            <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 9v4" /><path d="M12 17h.01" /><circle cx="12" cy="12" r="9" /></svg>
          </span>
          <h1 className="mt-4 text-lg font-semibold text-slate-900 dark:text-white">这条公告不存在或暂时无法访问</h1>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">它可能已被删除，也可能只是暂时加载失败。</p>
          <a href="/incidents" className="mt-5 inline-flex rounded-xl bg-brand-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-700">返回公告列表</a>
        </div>
      ) : (
        <>
          <header className="mb-6 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm dark:border-slate-700/80 dark:bg-slate-900 sm:p-7">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-600 dark:text-brand-400">Service update</p>
                <h1 className="mt-3 text-2xl font-bold tracking-tight text-slate-950 dark:text-white sm:text-3xl">{incident.title}</h1>
                <p className="mt-3 text-xs leading-5 text-slate-500 dark:text-slate-400">
                  发布于 {formatDate(incident.created_at)}
                  {incident.updated_at && incident.updated_at !== incident.created_at && <span> · 更新于 {formatDate(incident.updated_at)}</span>}
                </p>
              </div>
              <div className="flex flex-wrap gap-2 sm:justify-end">
                <Badge className={statusColors[incident.status] || statusColors.monitoring}>{statusLabels[incident.status] || incident.status}</Badge>
                <Badge className={severityColors[incident.severity] || severityColors.info}>{severityLabels[incident.severity] || incident.severity}</Badge>
              </div>
            </div>
          </header>

          {incident.description && (
            <section className="card mb-6">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">事件说明</h2>
              <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-slate-700 dark:text-slate-300">{incident.description}</p>
            </section>
          )}

          <section className="card">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">进展时间线</h2>
            {updates.length ? (
              <div className="mt-5 space-y-0">
                {updates.map((update: any, index: number) => (
                  <div key={update.id || update.created_at} className="relative grid grid-cols-[20px_minmax(0,1fr)] gap-3 pb-6 last:pb-0">
                    {index < updates.length - 1 && <span className="absolute bottom-0 left-[9px] top-4 w-px bg-slate-200 dark:bg-slate-700" aria-hidden="true" />}
                    <span className="relative mt-1 h-5 w-5 rounded-full border-4 border-white bg-brand-500 shadow-sm ring-1 ring-brand-200 dark:border-slate-900 dark:ring-brand-800" aria-hidden="true" />
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        {update.status && <Badge className={statusColors[update.status] || statusColors.monitoring}>{statusLabels[update.status] || update.status}</Badge>}
                        <time className="text-xs text-slate-500 dark:text-slate-400">{formatDate(update.created_at)}</time>
                      </div>
                      <p className="mt-2 text-sm leading-6 text-slate-700 dark:text-slate-300">{update.message}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">暂时没有新的进展，后续变化会更新在这里。</p>
            )}
            {incident.resolved_at && (
              <div className="mt-6 flex items-start gap-3 rounded-xl bg-emerald-50 p-4 dark:bg-emerald-900/20">
                <span className="mt-0.5 text-emerald-600 dark:text-emerald-400">✓</span>
                <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">事件已于 {formatDate(incident.resolved_at)} 恢复。</p>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  )
}

function Badge({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${className}`}>{children}</span>
}

function formatDate(value: string) {
  return value ? new Date(value).toLocaleString('zh-CN') : '--'
}
