'use client'

// Braum 布隆 CF 探针 — 历史数据查看器（客户端 Island）
import { useState, useEffect, useCallback } from 'react'
import { api } from '../lib/api'

interface Node {
  id: string
  name: string
}

interface ProbeResult {
  id: string
  node_id: string
  target_id: string
  success: boolean
  latency_ms: number | null
  status_code: number | null
  probe_at: string
  node_name?: string
  target_name?: string
}

export default function HistoryViewer() {
  const [nodes, setNodes] = useState<Node[]>([])
  const [results, setResults] = useState<ProbeResult[]>([])
  const [loading, setLoading] = useState(true)
  const [timeRange, setTimeRange] = useState('24h')
  const [nodeFilter, setNodeFilter] = useState('')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [error, setError] = useState('')

  useEffect(() => {
    api.getNodes().then((res) => {
      if (res.success && res.data) {
        const list = (res.data as any).results || res.data
        setNodes(Array.isArray(list) ? list : [])
      }
    })
  }, [])

  const loadResults = useCallback(async () => {
    setLoading(true)
    try {
      const params: Record<string, string> = {
        page: String(page),
        page_size: '50',
      }
      if (nodeFilter) params.node_id = nodeFilter
      const rangeHours: Record<string, number> = { '24h': 24, '7d': 168, '30d': 720, '90d': 2160 }
      if (timeRange) params.start_time = new Date(Date.now() - (rangeHours[timeRange] || 24) * 3600000).toISOString()

      const res = await api.getProbeResults(params)
      if (res.success && res.data) {
        const list = (res.data as any).results || res.data
        setResults(Array.isArray(list) ? list : [])
        if (res.meta) {
          setTotalPages(res.meta.total_pages || 1)
        }
        setError('')
      } else {
        setError(res.error || '网络记录加载失败')
      }
    } catch {
      setError('暂时无法连接监控 API')
    }
    setLoading(false)
  }, [page, nodeFilter, timeRange])

  useEffect(() => {
    loadResults()
  }, [loadResults])

  // 切换筛选时重置到第一页
  function handleTimeRangeChange(val: string) {
    setTimeRange(val)
    setPage(1)
  }

  function handleNodeFilterChange(val: string) {
    setNodeFilter(val)
    setPage(1)
  }

  return (
    <>
      <div className="mb-6 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm dark:border-slate-700/80 dark:bg-slate-900 sm:p-5">
        <div className="mb-4">
          <h2 className="font-semibold text-slate-900 dark:text-white">筛选记录</h2>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">选择时间和服务器，缩小查看范围。</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-[minmax(0,180px)_minmax(0,220px)_auto] sm:items-end">
          <div className="min-w-0">
            <label className="block text-xs font-medium text-slate-500 dark:text-slate-400">时间范围</label>
            <select
              value={timeRange}
              onChange={(e) => handleTimeRangeChange(e.target.value)}
              className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-brand-400 focus:ring-2 focus:ring-brand-100 dark:border-slate-600 dark:bg-slate-800 dark:text-white dark:focus:ring-brand-900/40"
            >
              <option value="24h">最近 24 小时</option>
              <option value="7d">最近 7 天</option>
              <option value="30d">最近 30 天</option>
              <option value="90d">最近 90 天</option>
            </select>
          </div>
          <div className="min-w-0">
            <label className="block text-xs font-medium text-slate-500 dark:text-slate-400">服务器</label>
            <select
              value={nodeFilter}
              onChange={(e) => handleNodeFilterChange(e.target.value)}
              className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-brand-400 focus:ring-2 focus:ring-brand-100 dark:border-slate-600 dark:bg-slate-800 dark:text-white dark:focus:ring-brand-900/40"
            >
              <option value="">全部服务器</option>
              {nodes.map((n) => (
                <option key={n.id} value={n.id}>
                  {n.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <button
              onClick={loadResults}
              className="w-full rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700 dark:border-slate-600 dark:text-slate-200 dark:hover:border-brand-700 dark:hover:bg-brand-950/30 sm:w-auto"
            >
              刷新
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div role="alert" className="mb-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/30 dark:text-red-200">
          {error} <button onClick={loadResults} className="ml-2 font-semibold underline">重试</button>
        </div>
      )}

      {/* 结果表格 */}
      {loading ? (
        <div className="card" aria-busy="true" aria-label="正在加载网络记录">
          <div className="flex h-40 items-center justify-center">
            <div className="h-6 w-6 animate-spin rounded-full border-4 border-brand-500 border-t-transparent" />
          </div>
        </div>
      ) : results.length > 0 ? (
        <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm dark:border-slate-700/80 dark:bg-slate-900">
          <div className="hidden overflow-x-auto sm:block">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800">
                <tr>
                  <th className="px-4 py-3 font-medium text-slate-500 dark:text-slate-400">服务器</th>
                  <th className="px-4 py-3 font-medium text-slate-500 dark:text-slate-400">目标</th>
                  <th className="px-4 py-3 font-medium text-slate-500 dark:text-slate-400">状态</th>
                  <th className="px-4 py-3 font-medium text-slate-500 dark:text-slate-400">延迟</th>
                  <th className="px-4 py-3 font-medium text-slate-500 dark:text-slate-400">HTTP</th>
                  <th className="px-4 py-3 font-medium text-slate-500 dark:text-slate-400">时间</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                {results.map((r) => {
                  const node = nodes.find((n) => n.id === r.node_id)
                  return (
                    <tr key={r.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                      <td className="px-4 py-3 text-slate-700 dark:text-slate-300">
                        {r.node_name || node?.name || r.node_id?.slice(0, 8) || '--'}
                      </td>
                      <td className="px-4 py-3 text-slate-700 dark:text-slate-300">
                        {r.target_name || r.target_id?.slice(0, 8) || '--'}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                            r.success
                              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                              : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                          }`}
                        >
                          {r.success ? '成功' : '失败'}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono text-slate-700 dark:text-slate-300">
                        {r.latency_ms != null ? `${Number(r.latency_ms).toFixed(1)}ms` : '--'}
                      </td>
                      <td className="px-4 py-3 text-slate-500 dark:text-slate-400">
                        {r.status_code || '--'}
                      </td>
                      <td className="px-4 py-3 text-slate-500 dark:text-slate-400">
                        {formatProbeDate(r.probe_at)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <div className="divide-y divide-slate-100 dark:divide-slate-800 sm:hidden">
            {results.map((result) => {
              const node = nodes.find((item) => item.id === result.node_id)
              return (
                <article key={result.id} className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="truncate text-sm font-semibold text-slate-900 dark:text-white">
                        {result.target_name || result.target_id?.slice(0, 8) || '未知目标'}
                      </h3>
                      <p className="mt-1 truncate text-xs text-slate-500 dark:text-slate-400">
                        {result.node_name || node?.name || result.node_id?.slice(0, 8) || '未知服务器'}
                      </p>
                    </div>
                    <span className={`inline-flex shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${result.success ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'}`}>
                      {result.success ? '正常' : '失败'}
                    </span>
                  </div>
                  <dl className="mt-4 grid grid-cols-3 gap-2 rounded-xl bg-slate-50 p-3 text-center dark:bg-slate-800/60">
                    <div><dt className="text-[10px] text-slate-400">延迟</dt><dd className="mt-1 font-mono text-xs font-semibold text-slate-700 dark:text-slate-200">{result.latency_ms != null ? `${Number(result.latency_ms).toFixed(1)}ms` : '--'}</dd></div>
                    <div><dt className="text-[10px] text-slate-400">HTTP</dt><dd className="mt-1 font-mono text-xs font-semibold text-slate-700 dark:text-slate-200">{result.status_code || '--'}</dd></div>
                    <div><dt className="text-[10px] text-slate-400">时间</dt><dd className="mt-1 text-xs font-semibold text-slate-700 dark:text-slate-200">{formatProbeTime(result.probe_at)}</dd></div>
                  </dl>
                  <p className="mt-2 text-right text-[11px] text-slate-400">{formatProbeDate(result.probe_at)}</p>
                </article>
              )
            })}
          </div>

          {/* 分页 */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3 dark:border-slate-700">
              <span className="text-sm text-slate-500 dark:text-slate-400">
                第 {page} / {totalPages} 页
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="rounded border border-slate-200 px-3 py-1 text-sm disabled:opacity-50 dark:border-slate-600 dark:text-white"
                >
                  上一页
                </button>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="rounded border border-slate-200 px-3 py-1 text-sm disabled:opacity-50 dark:border-slate-600 dark:text-white"
                >
                  下一页
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="card py-14 text-center">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500">
            <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 19V9" /><path d="M10 19V5" /><path d="M16 19v-7" /><path d="M22 19H2" /></svg>
          </span>
          <p className="mt-4 font-medium text-slate-700 dark:text-slate-200">这个范围内还没有网络记录</p>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">可以扩大时间范围，或切换到其他服务器查看。</p>
        </div>
      )}
    </>
  )
}

function formatProbeDate(value: string) {
  return value ? new Date(value).toLocaleString('zh-CN') : '--'
}

function formatProbeTime(value: string) {
  return value ? new Date(value).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }) : '--'
}
