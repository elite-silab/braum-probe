import { useEffect, useState } from 'react'
import { adminApi } from '../../lib/api'

interface NodeRow {
  id: string
  name: string
  status: string
  registration_status?: 'pending' | 'registered'
  last_heartbeat_at?: string | null
  agent_version?: string | null
}

interface DashboardData {
  nodes: NodeRow[]
  targets: unknown[]
  alerts: Array<{ enabled?: number | boolean }>
  incidents: Array<{ status?: string }>
}

function list<T>(value: unknown): T[] {
  if (Array.isArray(value)) return value as T[]
  if (value && typeof value === 'object' && Array.isArray((value as { results?: unknown[] }).results)) {
    return (value as { results: T[] }).results
  }
  return []
}

export default function AdminDashboard() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    Promise.all([
      adminApi.getNodes(),
      adminApi.getTargets(),
      adminApi.getAlertRules(),
      adminApi.getIncidents(),
    ]).then(([nodes, targets, alerts, incidents]) => {
      if (!active) return
      const failed = [nodes, targets, alerts, incidents].find(result => !result.success)
      if (failed) {
        setError(failed.error || '管理数据加载失败')
        return
      }
      setData({
        nodes: list<NodeRow>(nodes.data),
        targets: list(targets.data),
        alerts: list(alerts.data),
        incidents: list(incidents.data),
      })
    }).catch(() => active && setError('暂时无法连接 Workers API'))
    return () => { active = false }
  }, [])

  if (error) {
    return (
      <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-800 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-200">
        <p className="font-semibold">管理仪表盘加载失败</p>
        <p className="mt-1">{error}</p>
        <button onClick={() => window.location.reload()} className="mt-3 font-medium underline underline-offset-4">重新加载</button>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="grid animate-pulse gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => <div key={index} className="h-28 rounded-xl bg-slate-200 dark:bg-slate-800" />)}
      </div>
    )
  }

  const registered = data.nodes.filter(node => node.registration_status === 'registered').length
  const online = data.nodes.filter(node => node.status === 'active' && node.registration_status === 'registered').length
  const pending = data.nodes.filter(node => node.registration_status !== 'registered').length
  const activeIncidents = data.incidents.filter(incident => !['resolved'].includes(incident.status || '')).length
  const enabledAlerts = data.alerts.filter(alert => Boolean(alert.enabled)).length
  const coreSteps = [
    { done: data.nodes.length > 0, title: '添加 VPS 节点', text: '只填一个名称，系统会生成安装命令', href: '/admin/nodes' },
    { done: registered > 0 && pending === 0, title: '安装 Agent', text: pending > 0 ? `还有 ${pending} 个节点等待安装` : '所有节点均已完成安全注册', href: '/admin/nodes' },
  ]
  const optionalSteps = [
    { done: data.targets.length > 0, title: '添加网络探测', text: '可选：让 VPS 探测网站或 DNS', href: '/admin/targets' },
    { done: enabledAlerts > 0, title: '开启告警', text: '可选：使用推荐模板监控离线与资源异常', href: '/admin/alerts' },
  ]
  const nextAction = data.nodes.length === 0
    ? { eyebrow: '从这里开始', title: '添加第一台 VPS', text: '只需要一个名称，通常 1 分钟即可看到资源数据。', href: '/admin/nodes', action: '添加节点' }
    : pending > 0
      ? { eyebrow: '还差一步', title: `安装 ${pending} 个 Agent`, text: '打开节点列表复制安装命令，在对应 VPS 执行。', href: '/admin/nodes', action: '继续安装' }
      : { eyebrow: '基础监控已就绪', title: `${online} 台 VPS 正在上报`, text: '可以直接查看前台，也可以按需添加网络探测和告警。', href: '/', action: '查看监控页' }

  return (
    <div className="space-y-8">
      <section className="relative overflow-hidden rounded-2xl border border-brand-200 bg-[linear-gradient(120deg,rgba(59,130,246,.11),rgba(16,185,129,.06))] p-6 dark:border-brand-900/60 dark:bg-[linear-gradient(120deg,rgba(37,99,235,.16),rgba(15,23,42,.4))]">
        <div className="absolute -right-8 -top-12 h-36 w-36 rounded-full border-[24px] border-brand-200/30 dark:border-brand-800/20" />
        <div className="relative flex flex-wrap items-center justify-between gap-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-600 dark:text-brand-400">{nextAction.eyebrow}</p>
            <h2 className="mt-2 text-xl font-bold text-slate-950 dark:text-white">{nextAction.title}</h2>
            <p className="mt-1.5 text-sm text-slate-600 dark:text-slate-300">{nextAction.text}</p>
          </div>
          <a href={nextAction.href} className="inline-flex shrink-0 items-center rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-brand-700 hover:shadow-md">
            {nextAction.action} →
          </a>
        </div>
      </section>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: '在线 VPS', value: `${online}/${data.nodes.length}`, note: registered ? `${registered} 个已注册 Agent` : '等待添加节点', color: 'text-emerald-600 dark:text-emerald-400' },
          { label: '待安装 Agent', value: String(pending), note: pending ? '生成命令并在 VPS 执行' : '无需处理', color: pending ? 'text-amber-600 dark:text-amber-400' : 'text-slate-900 dark:text-white' },
          { label: '监控目标', value: String(data.targets.length), note: '由关联节点本地探测', color: 'text-brand-600 dark:text-brand-400' },
          { label: '活跃事件', value: String(activeIncidents), note: `${enabledAlerts} 条告警规则已启用`, color: activeIncidents ? 'text-red-600 dark:text-red-400' : 'text-slate-900 dark:text-white' },
        ].map(card => (
          <div key={card.label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
            <p className="text-sm text-slate-500 dark:text-slate-400">{card.label}</p>
            <p className={`mt-2 font-mono text-3xl font-bold ${card.color}`}>{card.value}</p>
            <p className="mt-2 text-xs text-slate-400">{card.note}</p>
          </div>
        ))}
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">两步完成基础监控</h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">网络探测和告警都是可选增强，不影响服务器资源监控。</p>
          </div>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
            {coreSteps.filter(step => step.done).length} / {coreSteps.length} 已完成
          </span>
        </div>
        <div className="mt-5 grid gap-3 md:grid-cols-2">
          {coreSteps.map((step, index) => (
            <a key={step.title} href={step.href} className="group flex items-start gap-3 rounded-xl border border-slate-200 p-4 transition hover:border-brand-300 hover:bg-brand-50/40 dark:border-slate-700 dark:hover:border-brand-700 dark:hover:bg-brand-950/20">
              <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${step.done ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-300'}`}>
                {step.done ? '✓' : index + 1}
              </span>
              <span>
                <strong className="text-sm text-slate-900 dark:text-white">{step.title}</strong>
                <span className="mt-1 block text-xs leading-5 text-slate-500 dark:text-slate-400">{step.text}</span>
              </span>
            </a>
          ))}
        </div>
        <div className="mt-5 border-t border-slate-100 pt-5 dark:border-slate-800">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">按需增强</p>
          <div className="grid gap-3 md:grid-cols-2">
            {optionalSteps.map(step => (
              <a key={step.title} href={step.href} className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-4 py-3 transition hover:bg-slate-100 dark:bg-slate-800/60 dark:hover:bg-slate-800">
                <span>
                  <strong className="text-sm text-slate-800 dark:text-slate-100">{step.title}</strong>
                  <span className="mt-0.5 block text-xs text-slate-500 dark:text-slate-400">{step.text}</span>
                </span>
                <span className={step.done ? 'text-emerald-500' : 'text-slate-400'}>{step.done ? '✓' : '→'}</span>
              </a>
            ))}
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">最近节点</h2>
          <a href="/admin/nodes" className="text-sm font-medium text-brand-600 hover:text-brand-700 dark:text-brand-400">管理全部 →</a>
        </div>
        {data.nodes.length ? (
          <div className="mt-4 divide-y divide-slate-100 dark:divide-slate-800">
            {data.nodes.slice(0, 6).map(node => (
              <div key={node.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div>
                  <p className="text-sm font-medium text-slate-900 dark:text-white">{node.name}</p>
                  <p className="mt-0.5 text-xs text-slate-400">{node.agent_version ? `Agent ${node.agent_version}` : '尚未安装 Agent'}</p>
                </div>
                <div className="text-right">
                  <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${node.registration_status !== 'registered' ? 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300' : node.status === 'active' ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300' : 'bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300'}`}>
                    {node.registration_status !== 'registered' ? '待安装' : node.status === 'active' ? '在线' : node.status === 'paused' ? '暂停' : '离线'}
                  </span>
                  <p className="mt-1 text-[11px] text-slate-400">{node.last_heartbeat_at ? new Date(node.last_heartbeat_at).toLocaleString('zh-CN') : '无心跳'}</p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-5 rounded-xl border border-dashed border-slate-300 p-8 text-center dark:border-slate-700">
            <p className="text-sm text-slate-500">还没有 VPS 节点</p>
            <a href="/admin/nodes" className="mt-3 inline-flex rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white">添加第一个节点</a>
          </div>
        )}
      </section>
    </div>
  )
}
