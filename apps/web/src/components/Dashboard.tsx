'use client'

// Braum 布隆 CF 探针 — Dashboard 仪表盘（核心 React Island）

import { useState, useEffect, useCallback, useRef } from 'react'
import GlobalStats from './GlobalStats'
import NodeCard from './NodeCard'
import { createRealtimeConnection, type RealtimeConnectionState } from '../lib/realtime'

const API_BASE = ''
const REFRESH_INTERVAL = 30_000

interface NodeData {
  id: string
  name: string
  region: string
  country: string
  city: string
  status: string
  avg_latency: number | null
  uptime: number | null
  total_probes: number
  sparkline: number[]
  registration_status: 'pending' | 'registered'
  agent_os: string | null
  agent_platform: string | null
  agent_arch: string | null
  agent_version: string | null
  latest_metrics: {
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
  } | null
}

interface GlobalStatsData {
  total_nodes: number
  online_nodes: number
  total_targets: number
  avg_latency: number
  uptime: number
  total_probes: number
}

interface Incident {
  id: string
  title: string
  severity: string
  status: string
  description: string
  created_at: string
}

type SortKey = 'name' | 'latency' | 'uptime'
type StatusFilter = 'all' | 'online' | 'offline' | 'paused' | 'pending'
type RegionFilter = 'all' | 'asia' | 'europe' | 'north_america' | 'other'
type NodeViewMode = 'detailed' | 'compact'

const NODE_VIEW_STORAGE_KEY = 'braum-node-view-mode'

const regionOptions = [
  { value: 'all', label: '全部地区' },
  { value: 'asia', label: '亚洲' },
  { value: 'europe', label: '欧洲' },
  { value: 'north_america', label: '北美' },
  { value: 'other', label: '其他' },
]

const statusOptions = [
  { value: 'all', label: '全部状态', dot: '' },
  { value: 'online', label: '在线', dot: 'bg-emerald-500' },
  { value: 'offline', label: '离线', dot: 'bg-red-500' },
  { value: 'paused', label: '已暂停', dot: 'bg-amber-500' },
  { value: 'pending', label: '等待安装', dot: 'bg-slate-400' },
]

function getNodeStatus(n: NodeData): StatusFilter {
  if (n.registration_status === 'pending') return 'pending'
  if (n.status === 'paused') return 'paused'
  if (n.status === 'offline') return 'offline'
  return 'online'
}

function timeAgo(date: Date): string {
  const sec = Math.floor((Date.now() - date.getTime()) / 1000)
  if (sec < 5) return '刚刚'
  if (sec < 60) return `${sec} 秒前`
  if (sec < 3600) return `${Math.floor(sec / 60)} 分钟前`
  return `${Math.floor(sec / 3600)} 小时前`
}

// ── 骨架屏 ──
function SkeletonGrid() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="card animate-pulse">
          <div className="flex justify-between">
            <div>
              <div className="h-4 w-24 rounded bg-slate-200 dark:bg-slate-700" />
              <div className="mt-2 h-3 w-32 rounded bg-slate-200 dark:bg-slate-700" />
            </div>
            <div className="h-3 w-3 rounded-full bg-slate-200 dark:bg-slate-700" />
          </div>
          <div className="mt-4 h-14 rounded-xl bg-slate-200 dark:bg-slate-700" />
          <div className="mt-5 space-y-4">
            {Array.from({ length: 3 }).map((_, row) => <div key={row} className="h-7 rounded bg-slate-200 dark:bg-slate-700" />)}
          </div>
          <div className="mt-4 h-28 rounded-xl bg-slate-200 dark:bg-slate-700" />
        </div>
      ))}
    </div>
  )
}

function SkeletonStats() {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="card animate-pulse text-center">
          <div className="mx-auto h-3 w-16 rounded bg-slate-200 dark:bg-slate-700" />
          <div className="mx-auto mt-3 h-7 w-20 rounded bg-slate-200 dark:bg-slate-700" />
          <div className="mx-auto mt-2 h-2 w-12 rounded bg-slate-200 dark:bg-slate-700" />
        </div>
      ))}
    </div>
  )
}

// ── 公告状态标签颜色 ──
const incidentStatusMap: Record<string, { label: string; cls: string }> = {
  investigating: { label: '调查中', cls: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
  identified: { label: '已定位', cls: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
  monitoring: { label: '监控中', cls: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
  resolved: { label: '已解决', cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' },
  scheduled: { label: '计划中', cls: 'bg-slate-100 text-slate-700 dark:bg-slate-700/50 dark:text-slate-300' },
}

export default function Dashboard() {
  const [nodes, setNodes] = useState<NodeData[]>([])
  const [globalStats, setGlobalStats] = useState<GlobalStatsData | null>(null)
  const [incidents, setIncidents] = useState<Incident[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [ago, setAgo] = useState('')
  const [realtimeState, setRealtimeState] = useState<RealtimeConnectionState>('connecting')
  const [connectedNodeIds, setConnectedNodeIds] = useState<Set<string>>(() => new Set())

  // 筛选 & 排序
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [regionFilter, setRegionFilter] = useState<RegionFilter>('all')
  const [sortKey, setSortKey] = useState<SortKey>('name')
  const [nodeViewMode, setNodeViewMode] = useState<NodeViewMode>('detailed')

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const realtimeRefreshRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const saved = localStorage.getItem(NODE_VIEW_STORAGE_KEY)
    if (saved === 'detailed' || saved === 'compact') setNodeViewMode(saved)
  }, [])

  const changeNodeViewMode = (mode: NodeViewMode) => {
    setNodeViewMode(mode)
    localStorage.setItem(NODE_VIEW_STORAGE_KEY, mode)
  }

  // ── 数据获取 ──
  const fetchData = useCallback(async () => {
    try {
      const [nodesRes, incRes] = await Promise.all([
        fetch(`${API_BASE}/api/v1/nodes?page_size=100`),
        fetch(`${API_BASE}/api/v1/incidents?page_size=5`),
      ])
      const nodesData: any = await nodesRes.json()
      const incData: any = await incRes.json()

      if (!nodesRes.ok || nodesData?.code !== 0) throw new Error(nodesData?.message || '服务器状态加载失败')
      if (!incRes.ok || incData?.code !== 0) throw new Error(incData?.message || '公告数据加载失败')

      const list: NodeData[] = nodesData?.data || []
      setNodes(list)
      setGlobalStats(nodesData?.global_stats || null)
      setIncidents(incData?.data || [])
      setLastUpdated(new Date())
      setError('')
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : '暂时无法连接监控 API')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  // ── 自动刷新 30s + visibilitychange ──
  useEffect(() => {
    fetchData()

    const startTimer = () => {
      if (timerRef.current) clearInterval(timerRef.current)
      timerRef.current = setInterval(fetchData, REFRESH_INTERVAL)
    }

    const onVisibility = () => {
      if (document.hidden) {
        if (timerRef.current) clearInterval(timerRef.current)
      } else {
        fetchData()
        startTimer()
      }
    }

    startTimer()
    document.addEventListener('visibilitychange', onVisibility)

    // "X 秒前" 更新
    const agoTimer = setInterval(() => {
      if (lastUpdated) setAgo(timeAgo(lastUpdated))
    }, 1000)

    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
      document.removeEventListener('visibilitychange', onVisibility)
      clearInterval(agoTimer)
    }
  }, [fetchData])

  // WebSocket 只通知数据发生变化；完整数据继续从公开 API 获取。
  useEffect(() => {
    const scheduleRefresh = () => {
      if (realtimeRefreshRef.current) clearTimeout(realtimeRefreshRef.current)
      realtimeRefreshRef.current = setTimeout(fetchData, 250)
    }
    const disconnect = createRealtimeConnection({
      onStateChange: setRealtimeState,
      onEvent: event => {
        if (event.type === 'snapshot') {
          setConnectedNodeIds(new Set(event.connected_node_ids))
          return
        }
        if (event.type === 'node_connected') {
          setConnectedNodeIds(current => new Set(current).add(event.node_id))
          scheduleRefresh()
          return
        }
        if (event.type === 'node_disconnected' || event.type === 'node_deleted') {
          setConnectedNodeIds(current => {
            const next = new Set(current)
            next.delete(event.node_id)
            return next
          })
        }
        scheduleRefresh()
      },
    })
    return () => {
      disconnect()
      if (realtimeRefreshRef.current) clearTimeout(realtimeRefreshRef.current)
    }
  }, [fetchData])

  // 首次加载后开始 ago 计时
  useEffect(() => {
    if (lastUpdated) setAgo(timeAgo(lastUpdated))
    const id = setInterval(() => {
      if (lastUpdated) setAgo(timeAgo(lastUpdated))
    }, 1000)
    return () => clearInterval(id)
  }, [lastUpdated])

  // ── 筛选 ──
  const filtered = nodes.filter(n => {
    if (statusFilter !== 'all' && getNodeStatus(n) !== statusFilter) return false
    if (regionFilter === 'other') {
      if (['asia', 'europe', 'north_america'].includes(n.region)) return false
    } else if (regionFilter !== 'all' && n.region !== regionFilter) {
      return false
    }
    return true
  })

  // ── 排序 ──
  const sorted = [...filtered].sort((a, b) => {
    if (sortKey === 'latency') return (a.avg_latency ?? 9999) - (b.avg_latency ?? 9999)
    if (sortKey === 'uptime') return (b.uptime ?? 0) - (a.uptime ?? 0)
    return a.name.localeCompare(b.name, 'zh')
  })

  // ── 渲染 ──
  if (loading) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8">
          <div className="h-8 w-32 rounded bg-slate-200 dark:bg-slate-700 animate-pulse" />
          <div className="mt-2 h-4 w-48 rounded bg-slate-200 dark:bg-slate-700 animate-pulse" />
        </div>
        <SkeletonStats />
        <div className="mt-10"><SkeletonGrid /></div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* 状态首屏 */}
      <section className="public-status-hero relative mb-8 overflow-hidden rounded-3xl border border-slate-200/80 bg-white px-6 py-7 shadow-sm dark:border-slate-700/80 dark:bg-slate-900 sm:px-8 sm:py-9">
        <div className="pointer-events-none absolute -right-16 -top-24 h-64 w-64 rounded-full bg-brand-400/10 blur-3xl" aria-hidden="true" />
        <div className="relative flex flex-col justify-between gap-7 sm:flex-row sm:items-end">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-brand-200/80 bg-brand-50/90 px-3 py-1 text-xs font-semibold text-brand-700 dark:border-brand-800 dark:bg-brand-950/50 dark:text-brand-300">
              <span className={`h-1.5 w-1.5 rounded-full ${realtimeState === 'connected' ? 'bg-emerald-500' : 'bg-brand-500'}`} />
              实时状态
            </div>
            <h1 className="mt-4 max-w-3xl text-3xl font-bold tracking-tight text-slate-950 dark:text-white sm:text-4xl">
              服务器状态，一眼看清
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-500 dark:text-slate-400 sm:text-base">
              持续汇总服务器运行、资源使用与网络质量。异常节点会优先标记，无需逐台检查。
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-3 rounded-2xl border border-slate-200/80 bg-white/80 px-4 py-3 shadow-sm dark:border-slate-700 dark:bg-slate-800/70">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-950/50 dark:text-brand-300">
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 12a8 8 0 1 1-2.34-5.66" /><path d="M20 4v6h-6" /></svg>
            </span>
            <div>
              <p className="text-xs text-slate-400">数据更新</p>
              <p className="mt-0.5 text-sm font-semibold text-slate-800 dark:text-slate-100">
                {realtimeState === 'connected' ? '实时同步中' : '自动刷新中'}
              </p>
            </div>
          </div>
        </div>
      </section>

      {error && (
        <div role="alert" className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-800 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-200">
          <span>{error}。当前显示上一次成功获取的数据。</span>
          <button onClick={() => { setRefreshing(true); fetchData() }} className="font-semibold underline underline-offset-4">重新连接</button>
        </div>
      )}

      {globalStats && (
        <div className={`mb-6 rounded-2xl border px-5 py-4 ${
          globalStats.online_nodes === globalStats.total_nodes && globalStats.total_nodes > 0
            ? 'border-emerald-200 bg-emerald-50/80 dark:border-emerald-900/60 dark:bg-emerald-950/25'
            : 'border-amber-200 bg-amber-50/80 dark:border-amber-900/60 dark:bg-amber-950/25'
        }`}>
          <div className="flex items-center gap-3">
            <span className={`flex h-9 w-9 items-center justify-center rounded-full ${globalStats.online_nodes === globalStats.total_nodes && globalStats.total_nodes > 0 ? 'bg-emerald-500' : 'bg-amber-500'} text-white`} aria-hidden="true">
              {globalStats.online_nodes === globalStats.total_nodes && globalStats.total_nodes > 0 ? '✓' : '!'}
            </span>
            <div>
              <p className="font-semibold text-slate-900 dark:text-white">
                {globalStats.total_nodes === 0 ? '还没有可展示的服务器' : globalStats.online_nodes === globalStats.total_nodes ? '全部服务器运行正常' : '部分服务器需要关注'}
              </p>
              <p className="mt-0.5 text-xs leading-5 text-slate-500 dark:text-slate-400">
                {globalStats.total_nodes === 0
                  ? '管理员添加节点并安装探针后，运行状态会显示在这里。'
                  : globalStats.online_nodes === globalStats.total_nodes
                    ? '最近一次状态已同步，页面会自动保持更新。'
                    : '发现离线、暂停或尚未完成安装的服务器，请查看下方节点。'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* 全局指标 */}
      {globalStats && (
        <GlobalStats
          totalNodes={globalStats.total_nodes}
          onlineNodes={globalStats.online_nodes}
          totalTargets={globalStats.total_targets}
          avgLatency={globalStats.avg_latency}
          uptime={globalStats.uptime}
          totalProbes={globalStats.total_probes}
        />
      )}

      {/* 节点目录 */}
      <section id="nodes" className="scroll-mt-24 mt-10" aria-labelledby="node-directory-title">
        {/* 工具栏：刷新 + 筛选 + 排序 */}
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 id="node-directory-title" className="text-xl font-semibold text-slate-900 dark:text-white">
              节点目录
              <span className="ml-2 text-sm font-normal text-slate-400">
                ({filtered.length}/{nodes.length})
              </span>
            </h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              每台服务器的资源、流量与网络状态都在卡片中，无需逐台进入详情。
            </p>
          </div>

          <div className="grid w-full grid-cols-4 gap-2 sm:flex sm:w-auto sm:items-center">
            {/* 最后更新 */}
            <span className="col-span-4 text-right text-xs text-slate-400 dark:text-slate-500 sm:mr-2">
              {ago && `更新于 ${ago}`}
            </span>

            {/* 卡片密度 */}
            <div className="col-span-4 grid grid-cols-2 rounded-lg border border-slate-200 bg-slate-50 p-0.5 dark:border-slate-600 dark:bg-slate-800" role="group" aria-label="节点卡片显示方式">
              <button
                type="button"
                aria-pressed={nodeViewMode === 'detailed'}
                onClick={() => changeNodeViewMode('detailed')}
                className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${nodeViewMode === 'detailed' ? 'bg-white text-brand-700 shadow-sm dark:bg-slate-700 dark:text-brand-300' : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'}`}
                title="显示完整资源信息"
              >
                ▦ 详细
              </button>
              <button
                type="button"
                aria-pressed={nodeViewMode === 'compact'}
                onClick={() => changeNodeViewMode('compact')}
                className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${nodeViewMode === 'compact' ? 'bg-white text-brand-700 shadow-sm dark:bg-slate-700 dark:text-brand-300' : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'}`}
                title="在一屏内浏览更多节点"
              >
                ▤ 紧凑
              </button>
            </div>

            {/* 手动刷新 */}
            <button
              onClick={() => { setRefreshing(true); fetchData() }}
              disabled={refreshing}
              className="min-w-0 rounded-lg border px-2 py-1.5 text-xs text-slate-600 transition-colors hover:bg-slate-100 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700 sm:px-3"
              title="刷新"
            >
              <span className={refreshing ? 'inline-block animate-spin' : 'inline-block'}>↻</span> {refreshing ? '刷新中' : '刷新'}
            </button>

            {/* 状态筛选 */}
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.currentTarget.value as StatusFilter)}
              className="min-w-0 rounded-lg border px-2 py-1.5 text-xs text-slate-600 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300"
            >
              {statusOptions.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>

            {/* 地区筛选 */}
            <select
              value={regionFilter}
              onChange={e => setRegionFilter(e.currentTarget.value as RegionFilter)}
              className="min-w-0 rounded-lg border px-2 py-1.5 text-xs text-slate-600 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300"
            >
              {regionOptions.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>

            {/* 排序 */}
            <select
              value={sortKey}
              onChange={e => setSortKey(e.currentTarget.value as SortKey)}
              className="min-w-0 rounded-lg border px-2 py-1.5 text-xs text-slate-600 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300"
            >
              <option value="name">按名称</option>
              <option value="latency">按延迟</option>
              <option value="uptime">按可用率</option>
            </select>
          </div>
        </div>

        {/* 节点卡片网格 */}
        {sorted.length > 0 ? (
          <div className={`grid ${nodeViewMode === 'compact' ? 'gap-3 sm:grid-cols-2 xl:grid-cols-3' : 'gap-4 sm:grid-cols-2 lg:grid-cols-3'}`}>
            {sorted.map(n => (
              <NodeCard
                key={n.id}
                id={n.id}
                name={n.name}
                country={n.country || ''}
                city={n.city || ''}
                status={n.status}
                registrationStatus={n.registration_status}
                agentOS={n.agent_os}
                agentPlatform={n.agent_platform}
                agentArch={n.agent_arch}
                agentVersion={n.agent_version}
                avgLatency={n.avg_latency}
                uptime={n.uptime}
                sparkline={n.sparkline}
                metrics={n.latest_metrics}
                realtimeConnected={connectedNodeIds.has(n.id)}
                variant={nodeViewMode}
              />
            ))}
          </div>
        ) : (
          <div className="card py-12 text-center">
            <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500">
              <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="6" rx="2" /><rect x="3" y="14" width="18" height="6" rx="2" /><path d="M7 7h.01M7 17h.01" /></svg>
            </span>
            <p className="mt-4 font-medium text-slate-700 dark:text-slate-200">
              {nodes.length === 0
                ? '还没有可展示的服务器'
                : '没有符合当前条件的节点'}
            </p>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              {nodes.length === 0
                ? '管理员添加节点并安装探针后，运行数据会显示在这里。'
                : '可以调整状态、地区或排序方式后再查看。'}
            </p>
          </div>
        )}
      </section>

      {/* 运行公告 */}
      <section className="mt-10">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white">运行公告</h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">维护、故障与恢复进展会在这里持续更新。</p>
          </div>
          <a href="/incidents" className="text-sm text-brand-600 hover:text-brand-700 dark:text-brand-400">
            查看全部 →
          </a>
        </div>

        {incidents.length > 0 ? (
          <div className="space-y-3">
            {incidents.slice(0, 5).map(inc => {
              const st = incidentStatusMap[inc.status] || incidentStatusMap.monitoring
              return (
                <a key={inc.id} href={`/incidents/${inc.id}`} className="card flex items-center justify-between gap-4 transition-shadow hover:shadow-sm">
                  <div className="min-w-0">
                    <h3 className="font-medium text-slate-900 dark:text-white truncate">{inc.title}</h3>
                    <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
                      {new Date(inc.created_at).toLocaleString('zh-CN')}
                    </p>
                  </div>
                  <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium ${st.cls}`}>
                    {st.label}
                  </span>
                </a>
              )
            })}
          </div>
        ) : (
          <div className="card flex items-center gap-3 py-5">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-400">
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m5 12 4 4L19 6" /></svg>
            </span>
            <div>
              <p className="font-medium text-slate-800 dark:text-slate-100">当前没有维护或故障公告</p>
              <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">所有服务保持正常运行。</p>
            </div>
          </div>
        )}
      </section>
    </div>
  )
}
