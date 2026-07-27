'use client'

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
  assigned_node_count?: number
  created_at: string
}

interface NodeOption {
  id: string
  name: string
  status: string
  registration_status?: 'pending' | 'registered'
}

interface CreatedTarget {
  id: string
  name: string
  address: string
}

export default function TargetManager() {
  const [targets, setTargets] = useState<Target[]>([])
  const [nodes, setNodes] = useState<NodeOption[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [editingTarget, setEditingTarget] = useState<Target | null>(null)
  const [deletingTarget, setDeletingTarget] = useState<Target | null>(null)
  const [saving, setSaving] = useState(false)
  const [assignmentTarget, setAssignmentTarget] = useState<CreatedTarget | null>(null)
  const [assignmentNodeIds, setAssignmentNodeIds] = useState<string[]>([])
  const [assignmentSaving, setAssignmentSaving] = useState(false)
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
    loadNodes()
  }, [])

  async function loadNodes() {
    const res = await adminApi.getNodes()
    if (res.success && res.data) {
      const results = (res.data as any).results || res.data
      setNodes(Array.isArray(results) ? results : [])
    }
  }

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
    setAssignmentTarget(null)
    setAssignmentNodeIds([])
    setEditingTarget(null)
    setForm({ name: '', target_type: 'http', address: '', expected_status: 200, timeout_ms: 5000, status: 'active' })
    setModalOpen(true)
  }

  function handleEdit(target: Target) {
    setAssignmentTarget(null)
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
          const created = res.data as CreatedTarget | undefined
          if (created?.id && nodes.length > 0) {
            setAssignmentTarget(created)
            setAssignmentNodeIds([])
          } else {
            setModalOpen(false)
          }
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

  async function handleAssignmentSubmit() {
    if (!assignmentTarget) return
    setAssignmentSaving(true)
    try {
      const res = await adminApi.updateTargetAssignments(assignmentTarget.id, assignmentNodeIds)
      if (!res.success) {
        showToast(res.error || '节点分配失败', 'error')
        return
      }
      showToast(
        assignmentNodeIds.length > 0 ? `已分配到 ${assignmentNodeIds.length} 个节点` : '目标已保存，暂未分配节点',
        'success',
      )
      setAssignmentTarget(null)
      setModalOpen(false)
      await loadTargets()
    } catch {
      showToast('节点分配失败，请稍后重试', 'error')
    } finally {
      setAssignmentSaving(false)
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
      key: 'assigned_node_count',
      label: '分配状态',
      render: (value: unknown) => {
        const count = Number(value || 0)
        return count > 0
          ? <span className="text-emerald-600 dark:text-emerald-400">已分配 {count} 个节点</span>
          : <span className="font-medium text-amber-600 dark:text-amber-400">未分配节点</span>
      },
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

      <div className="mb-5 rounded-2xl border border-blue-200 bg-blue-50/80 p-4 text-sm text-blue-950 dark:border-blue-900/60 dark:bg-blue-950/30 dark:text-blue-100">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">?</span>
          <div>
            <p className="font-semibold">网络探测是可选的“从 VPS 出发的访问检查”</p>
            <p className="mt-1 text-xs leading-5 text-blue-800 dark:text-blue-200">它不影响 CPU、内存、磁盘和流量监控。创建目标后，还要分配给至少一个节点，Agent 才会执行检查并产生延迟、状态码和可用率。</p>
          </div>
        </div>
        <div className="mt-4 grid gap-2 text-xs sm:grid-cols-3">
          {['创建网站或 DNS 目标', '分配给需要检查的节点', '等待第一次检查结果'].map((step, index) => (
            <div key={step} className="flex items-center gap-2 rounded-lg bg-white/70 px-3 py-2 dark:bg-slate-900/30">
              <span className="font-mono font-semibold text-blue-600 dark:text-blue-300">0{index + 1}</span>
              <span>{step}</span>
            </div>
          ))}
        </div>
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
        title={assignmentTarget ? '下一步：分配探测节点' : editingTarget ? '编辑网络探测' : '添加网络探测'}
        onClose={() => { setModalOpen(false); setAssignmentTarget(null) }}
        onConfirm={assignmentTarget ? handleAssignmentSubmit : handleSubmit}
        confirmText={assignmentTarget ? (assignmentSaving ? '保存分配…' : '保存节点分配') : (saving ? '保存中…' : editingTarget ? '保存修改' : '创建目标')}
        confirmDisabled={assignmentTarget ? assignmentSaving : (saving || !form.address.trim())}
        closeOnConfirm={false}
      >
        {assignmentTarget ? (
          <div className="space-y-4">
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900/60 dark:bg-emerald-950/25">
              <p className="font-semibold text-emerald-900 dark:text-emerald-100">“{assignmentTarget.name}”已创建</p>
              <p className="mt-1 break-all text-xs text-emerald-700 dark:text-emerald-300">{assignmentTarget.address}</p>
            </div>
            <div>
              <div className="mb-2 flex items-baseline justify-between gap-3">
                <p className="font-medium text-slate-800 dark:text-slate-100">选择从哪些节点发起检查</p>
                <span className="text-xs text-slate-400">已选 {assignmentNodeIds.length} 个</span>
              </div>
              <p className="mb-3 text-xs leading-5 text-slate-500 dark:text-slate-400">只会影响选中的 VPS，不会自动分配给所有节点。你也可以先跳过，之后在节点管理中再分配。</p>
              <div className="max-h-52 space-y-1 overflow-y-auto rounded-xl border border-slate-200 p-2 dark:border-slate-600">
                {nodes.map(node => (
                  <label key={node.id} className="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-700/60">
                    <input
                      type="checkbox"
                      checked={assignmentNodeIds.includes(node.id)}
                      onChange={event => setAssignmentNodeIds(current => event.target.checked ? [...current, node.id] : current.filter(id => id !== node.id))}
                      className="rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                    />
                    <span className="min-w-0 flex-1 truncate text-sm text-slate-700 dark:text-slate-200">{node.name}</span>
                    <span className="shrink-0 text-[10px] text-slate-400">{node.registration_status === 'registered' ? '已安装' : '待安装'}</span>
                  </label>
                ))}
              </div>
            </div>
            <button type="button" onClick={() => { setAssignmentTarget(null); setModalOpen(false) }} className="text-xs font-medium text-slate-500 underline underline-offset-4 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200">
              暂时跳过，稍后再分配
            </button>
          </div>
        ) : (
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

          {!editingTarget && <p className="-mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800 dark:bg-amber-950/30 dark:text-amber-200">创建后会进入“分配节点”步骤。未分配节点的目标不会产生探测结果。</p>}

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
          {editingTarget && <p className="text-xs leading-5 text-slate-500 dark:text-slate-400">需要调整分配节点？请前往“节点管理”编辑对应 VPS。目标本身的参数修改会立即同步。</p>}
        </div>
        )}
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
