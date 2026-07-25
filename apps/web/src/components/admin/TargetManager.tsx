// Braum 布隆 CF 探针 — 目标管理组件
import { useState, useEffect } from 'react'
import { adminApi } from '../../lib/api'
import DataTable from './DataTable'
import Modal from './Modal'
import FormField from './FormField'
import ToastContainer, { showToast } from './Toast'

interface Target {
  id: string
  name: string
  target_type: string
  address: string
  expected_status: number
  timeout_ms: number
  status: 'active' | 'paused'
  created_at: string
}

export default function TargetManager() {
  const [targets, setTargets] = useState<Target[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [editingTarget, setEditingTarget] = useState<Target | null>(null)
  const [deletingTarget, setDeletingTarget] = useState<Target | null>(null)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    name: '',
    target_type: 'http',
    address: '',
    expected_status: 200,
    timeout_ms: 5000,
    status: 'active',
  })

  useEffect(() => {
    loadTargets()
  }, [])

  async function loadTargets() {
    setLoading(true)
    try {
      const res = await adminApi.getTargets()
      if (res.success && res.data) {
        const results = (res.data as any).results || res.data
        setTargets(Array.isArray(results) ? results : [])
      }
    } catch (e) {
      showToast('加载目标失败', 'error')
    }
    setLoading(false)
  }

  function handleCreate() {
    setEditingTarget(null)
    setForm({ name: '', target_type: 'http', address: '', expected_status: 200, timeout_ms: 5000, status: 'active' })
    setModalOpen(true)
  }

  function handleEdit(target: Target) {
    setEditingTarget(target)
    setForm({
      name: target.name,
      target_type: target.target_type,
      address: target.address,
      expected_status: target.expected_status,
      timeout_ms: target.timeout_ms,
      status: target.status,
    })
    setModalOpen(true)
  }

  function handleDelete(target: Target) {
    setDeletingTarget(target)
    setDeleteModalOpen(true)
  }

  async function handleSubmit() {
    if (!form.address.trim()) {
      showToast('请填写要探测的地址', 'error')
      return
    }
    setSaving(true)
    try {
      if (editingTarget) {
        const res = await adminApi.updateTarget(editingTarget.id, form)
        if (res.success) {
          showToast('目标更新成功', 'success')
          await loadTargets()
          setModalOpen(false)
        } else {
          showToast(res.error || '更新失败', 'error')
        }
      } else {
        const res = await adminApi.createTarget({
          address: form.address.trim(),
          target_type: form.target_type,
          ...(form.name.trim() ? { name: form.name.trim() } : {}),
          expected_status: form.expected_status,
          timeout_ms: form.timeout_ms,
        })
        if (res.success) {
          showToast('目标创建成功', 'success')
          await loadTargets()
          setModalOpen(false)
        } else {
          showToast(res.error || '创建失败', 'error')
        }
      }
    } catch (e) {
      showToast('操作失败', 'error')
    } finally {
      setSaving(false)
    }
  }

  async function handleConfirmDelete() {
    if (!deletingTarget) return
    try {
      const res = await adminApi.deleteTarget(deletingTarget.id)
      if (res.success) {
        showToast('目标删除成功', 'success')
        loadTargets()
      } else {
        showToast(res.error || '删除失败', 'error')
      }
      setDeleteModalOpen(false)
    } catch (e) {
      showToast('删除失败', 'error')
    }
  }

  const filteredTargets = targets.filter((target) => {
    if (search && !target.name.toLowerCase().includes(search.toLowerCase())) return false
    if (typeFilter && target.target_type !== typeFilter) return false
    return true
  })

  const columns = [
    { key: 'name', label: '名称' },
    {
      key: 'target_type',
      label: '类型',
      render: (value: unknown) => {
        const type = String(value)
        const color =
          type === 'http'
            ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
            : 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400'
        return <span className={`rounded-full px-2 py-1 text-xs uppercase ${color}`}>{type}</span>
      },
    },
    {
      key: 'address',
      label: 'URL',
      render: (value: unknown) => (
        <span className="max-w-xs truncate font-mono text-xs" title={String(value)}>
          {String(value)}
        </span>
      ),
    },
    {
      key: 'status',
      label: '状态',
      render: (value: unknown) => {
        const enabled = value === 'active'
        return (
          <span
            className={`rounded-full px-2 py-1 text-xs ${
              enabled
                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                : 'bg-slate-100 text-slate-700 dark:bg-slate-900/30 dark:text-slate-400'
            }`}
          >
            {enabled ? '启用' : '禁用'}
          </span>
        )
      },
    },
    {
      key: 'actions',
      label: '操作',
      render: (_: unknown, row: Record<string, unknown>) => (
        <div className="flex gap-2">
          <button
            onClick={(e: any) => {
              e.stopPropagation()
              handleEdit(row as unknown as Target)
            }}
            className="text-brand-600 hover:text-brand-700 dark:text-brand-400"
          >
            编辑
          </button>
          <button
            onClick={(e: any) => {
              e.stopPropagation()
              handleDelete(row as unknown as Target)
            }}
            className="text-red-600 hover:text-red-700 dark:text-red-400"
          >
            删除
          </button>
        </div>
      ),
    },
  ]

  return (
    <>
      <ToastContainer />

      <div className="mb-5 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900 dark:border-blue-900/60 dark:bg-blue-950/30 dark:text-blue-100">
        <p className="font-semibold">网络探测是可选功能</p>
        <p className="mt-1 text-xs leading-5 text-blue-700 dark:text-blue-300">服务器资源监控不依赖探测目标。需要监控网站或 DNS 时，只填地址即可，其余参数已有适合多数场景的默认值。</p>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <button onClick={handleCreate} className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">
          + 添加探测
        </button>
        <input
          type="text"
          placeholder="搜索目标名称..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-700 dark:text-white"
        />
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-700 dark:text-white"
        >
          <option value="">全部类型</option>
          <option value="http">HTTP</option>
          <option value="dns">DNS</option>
        </select>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800">
        <DataTable columns={columns} data={filteredTargets as unknown as Record<string, unknown>[]} loading={loading} />
      </div>

      <Modal
        open={modalOpen}
        title={editingTarget ? '编辑探测' : '添加网络探测'}
        onClose={() => setModalOpen(false)}
        onConfirm={handleSubmit}
        confirmText={saving ? '保存中…' : editingTarget ? '保存修改' : '添加探测'}
        confirmDisabled={saving || !form.address.trim()}
        closeOnConfirm={false}
      >
        <div className="space-y-4">
          <FormField
            as="select"
            label="探测类型"
            value={form.target_type}
            onChange={(e: any) => setForm({ ...form, target_type: e.target.value })}
            options={[
              { value: 'http', label: 'HTTP' },
              { value: 'dns', label: 'DNS' },
            ]}
          />
          <FormField
            label={form.target_type === 'http' ? '网站地址' : '域名'}
            required
            autoFocus
            value={form.address}
            onChange={(e: any) => setForm({ ...form, address: e.target.value })}
            placeholder={form.target_type === 'http' ? 'https://example.com' : 'example.com'}
          />
          <p className="-mt-2 text-xs leading-5 text-slate-500 dark:text-slate-400">名称会自动使用域名，例如 <code>example.com</code>。</p>

          <details className="group rounded-xl border border-slate-200 bg-slate-50/70 dark:border-slate-700 dark:bg-slate-900/30">
            <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 font-medium text-slate-700 dark:text-slate-200">
              <span>可选设置</span>
              <span className="text-xs font-normal text-slate-400">名称、超时与状态码</span>
            </summary>
            <div className="space-y-4 border-t border-slate-200 px-4 py-4 dark:border-slate-700">
              <FormField label="显示名称" value={form.name} onChange={(e: any) => setForm({ ...form, name: e.target.value })} placeholder="留空则自动生成" />
              {form.target_type === 'http' && (
                <FormField label="期望状态码" type="number" min="100" max="599" value={form.expected_status} onChange={(e: any) => setForm({ ...form, expected_status: parseInt(e.target.value) || 200 })} />
              )}
              <FormField
                as="select"
                label="超时时间"
                value={String(form.timeout_ms)}
                onChange={(e: any) => setForm({ ...form, timeout_ms: Number(e.target.value) })}
                options={[
                  { value: '3000', label: '3 秒' },
                  { value: '5000', label: '5 秒（推荐）' },
                  { value: '10000', label: '10 秒' },
                  { value: '30000', label: '30 秒' },
                ]}
              />
              {editingTarget && (
                <FormField as="select" label="状态" value={form.status} onChange={(e: any) => setForm({ ...form, status: e.target.value })} options={[{ value: 'active', label: '启用' }, { value: 'paused', label: '暂停' }]} />
              )}
            </div>
          </details>
        </div>
      </Modal>

      <Modal
        open={deleteModalOpen}
        title="确认删除"
        onClose={() => setDeleteModalOpen(false)}
        onConfirm={handleConfirmDelete}
        confirmText="删除"
        confirmDanger
      >
        <p>
          确定要删除目标 <strong>{deletingTarget?.name}</strong> 吗？此操作不可恢复。
        </p>
      </Modal>
    </>
  )
}
