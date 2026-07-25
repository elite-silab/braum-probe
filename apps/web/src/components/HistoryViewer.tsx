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
        setError(res.error || '历史数据加载失败')
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
      {/* 筛选栏 */}
      <div className="card mb-6">
        <div className="flex flex-wrap items-center gap-4">
          <div>
            <label className="block text-xs text-slate-500 dark:text-slate-400">时间范围</label>
            <select
              value={timeRange}
              onChange={(e) => handleTimeRangeChange(e.target.value)}
              className="mt-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-700 dark:text-white"
            >
              <option value="24h">最近 24 小时</option>
              <option value="7d">最近 7 天</option>
              <option value="30d">最近 30 天</option>
              <option value="90d">最近 90 天</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-slate-500 dark:text-slate-400">节点</label>
            <select
              value={nodeFilter}
              onChange={(e) => handleNodeFilterChange(e.target.value)}
              className="mt-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-700 dark:text-white"
            >
              <option value="">全部节点</option>
              {nodes.map((n) => (
                <option key={n.id} value={n.id}>
                  {n.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-end">
            <button
              onClick={loadResults}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm hover:bg-slate-50 dark:border-slate-600 dark:hover:bg-slate-700 dark:text-white"
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
        <div className="card">
          <div className="flex h-32 items-center justify-center">
            <div className="h-6 w-6 animate-spin rounded-full border-4 border-brand-500 border-t-transparent" />
          </div>
        </div>
      ) : results.length > 0 ? (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800">
                <tr>
                  <th className="px-4 py-3 font-medium text-slate-500 dark:text-slate-400">节点</th>
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
                        {r.probe_at ? new Date(r.probe_at).toLocaleString('zh-CN') : '--'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
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
        <div className="card">
          <div className="flex h-64 items-center justify-center rounded-lg bg-slate-50 dark:bg-slate-700/50">
            <p className="text-slate-400 dark:text-slate-500">暂无历史数据</p>
          </div>
        </div>
      )}
    </>
  )
}
