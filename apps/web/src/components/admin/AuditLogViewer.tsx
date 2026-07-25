// Braum 布隆 CF 探针 — 审计日志查看器
import { useState, useEffect } from 'react'
import { adminApi } from '../../lib/api'
import DataTable from './DataTable'
import ToastContainer, { showToast } from './Toast'

interface AuditLog {
  id: string
  user_id: string
  action: string
  object_type: string
  object_id: string
  changes: string
  ip_address: string
  created_at: string
}

export default function AuditLogViewer() {
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [loading, setLoading] = useState(true)
  const [actionFilter, setActionFilter] = useState('')
  const [objectTypeFilter, setObjectTypeFilter] = useState('')

  useEffect(() => {
    loadLogs()
  }, [])

  async function loadLogs() {
    setLoading(true)
    try {
      const params: Record<string, string> = { page: '1' }
      if (actionFilter) params.action = actionFilter
      if (objectTypeFilter) params.object_type = objectTypeFilter

      const res = await adminApi.getAuditLogs(params)
      if (res.success && res.data) {
        const results = (res.data as any).results || res.data
        setLogs(Array.isArray(results) ? results : [])
      }
    } catch (e) {
      showToast('加载审计日志失败', 'error')
    }
    setLoading(false)
  }

  useEffect(() => {
    loadLogs()
  }, [actionFilter, objectTypeFilter])

  const columns = [
    {
      key: 'created_at',
      label: '时间',
      render: (v: unknown) => new Date(String(v)).toLocaleString('zh-CN'),
    },
    {
      key: 'user_id',
      label: '操作人',
      render: (v: unknown) => String(v).slice(0, 8) + '...',
    },
    {
      key: 'action',
      label: '操作类型',
      render: (v: unknown) => {
        const action = String(v)
        const colorMap: Record<string, string> = {
          create: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
          update: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
          delete: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
          login: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
        }
        return <span className={`rounded-full px-2 py-1 text-xs ${colorMap[action] || 'bg-slate-100 text-slate-700'}`}>{action}</span>
      },
    },
    { key: 'object_type', label: '对象类型' },
    { key: 'object_id', label: '对象 ID' },
    {
      key: 'changes',
      label: '变更摘要',
      render: (v: unknown) => {
        if (!v) return '--'
        try {
          const obj = typeof v === 'string' ? JSON.parse(v) : v
          return (
            <span className="max-w-xs truncate font-mono text-xs" title={JSON.stringify(obj)}>
              {JSON.stringify(obj).slice(0, 50)}...
            </span>
          )
        } catch {
          return String(v).slice(0, 50)
        }
      },
    },
    {
      key: 'ip_address',
      label: 'IP',
      render: (v: unknown) => <span className="font-mono text-xs">{String(v) || '--'}</span>,
    },
  ]

  return (
    <>
      <ToastContainer />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <select
          value={actionFilter}
          onChange={(e) => setActionFilter(e.target.value)}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-700 dark:text-white"
        >
          <option value="">全部操作类型</option>
          <option value="create">创建</option>
          <option value="update">更新</option>
          <option value="delete">删除</option>
          <option value="login">登录</option>
        </select>
        <select
          value={objectTypeFilter}
          onChange={(e) => setObjectTypeFilter(e.target.value)}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-700 dark:text-white"
        >
          <option value="">全部对象类型</option>
          <option value="node">节点</option>
          <option value="target">目标</option>
          <option value="alert_rule">告警规则</option>
          <option value="incident">公告</option>
          <option value="setting">设置</option>
          <option value="user">用户</option>
        </select>
        <button
          onClick={loadLogs}
          className="rounded-lg border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50 dark:border-slate-600 dark:hover:bg-slate-700"
        >
          刷新
        </button>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800">
        <DataTable columns={columns} data={logs as unknown as Record<string, unknown>[]} loading={loading} emptyText="暂无审计日志" />
      </div>
    </>
  )
}
