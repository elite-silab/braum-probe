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

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const realtimeRefreshRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── 数据获取 ──
  const fetchData = useCallback(async () => {
    try {
      const [nodesRes, incRes] = await Promise.all([
        fetch(`${API_BASE}/api/v1/nodes?page_size=100`),
        fetch(`${API_BASE}/api/v1/incidents?page_size=5`),
      ])
      const nodesData: any = await nodesRes.json()
      const incData: any = await incRes.json()

      if (!nodesRes.ok || nodesData?.code !== 0) throw new Error(nodesData?.message || '节点数据加载失败')
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
      {/* 标题 */}
      <div className="mb-8">
        <div className="inline-flex items-center gap-2 rounded-full border border-brand-200 bg-brand-50 px-3 py-1 text-xs font-medium text-brand-700 dark:border-brand-800 dark:bg-brand-950/40 dark:text-brand-300">
          <span className={`h-1.5 w-1.5 rounded-full ${realtimeState === 'connected' ? 'bg-emerald-500' : 'bg-brand-500'}`} />
          Workers 控制面 · {realtimeState === 'connected' ? '实时推送已连接' : '30 秒轮询保护'}
        </div>
        <h1 className="mt-4 text-3xl font-bold tracking-tight text-slate-950 dark:text-white sm:text-4xl">基础设施状态总览</h1>
        <p className="mt-2 max-w-2xl text-slate-500 dark:text-slate-400">
          来自每台 VPS 常驻 Agent 的真实资源指标与节点本地网络探测结果。
        </p>
      </div>

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
                {globalStats.total_nodes === 0 ? '还没有添加 VPS 节点' : globalStats.online_nodes === globalStats.total_nodes ? '所有已注册节点运行正常' : '部分节点需要关注'}
              </p>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">状态以 Agent 最后心跳为准，默认每 60 秒更新。</p>
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

      {/* 节点区域 */}
      <section className="mt-10">
        {/* 工具栏：刷新 + 筛选 + 排序 */}
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
            VPS 节点
            <span className="ml-2 text-sm font-normal text-slate-400">
              ({filtered.length}/{nodes.length})
            </span>
          </h2>

          <div className="grid w-full grid-cols-4 gap-2 sm:flex sm:w-auto sm:items-center">
            {/* 最后更新 */}
            <span className="col-span-4 text-right text-xs text-slate-400 dark:text-slate-500 sm:mr-2">
              {ago && `更新于 ${ago}`}
            </span>

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
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
              />
            ))}
          </div>
        ) : (
          <div className="card text-center py-12">
            <p className="text-4xl mb-4">📡</p>
            <p className="text-slate-500 dark:text-slate-400">
              {nodes.length === 0
                ? '暂无 VPS 节点，请先在管理后台添加节点并安装 Agent'
                : '没有匹配的节点，试试调整筛选条件'}
            </p>
          </div>
        )}
      </section>

      {/* 最近公告 */}
      <section className="mt-10">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white">最近公告</h2>
          <a href="/incidents" className="text-sm text-brand-600 hover:text-brand-700 dark:text-brand-400">
            查看全部 →
          </a>
        </div>

        {incidents.length > 0 ? (
          <div className="space-y-3">
            {incidents.slice(0, 5).map(inc => {
              const st = incidentStatusMap[inc.status] || incidentStatusMap.monitoring
              return (
                <a key={inc.id} href={`/incidents#${inc.id}`} className="card flex items-center justify-between gap-4 hover:shadow-sm transition-shadow">
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
          <div className="card text-center py-6">
            <p className="text-slate-500 dark:text-slate-400">暂无公告</p>
          </div>
        )}
      </section>
    </div>
  )
}
