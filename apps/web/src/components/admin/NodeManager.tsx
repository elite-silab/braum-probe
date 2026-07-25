// Braum 布隆 CF 探针 — 节点管理组件
import { useState, useEffect } from 'react'
import { adminApi } from '../../lib/api'
import DataTable from './DataTable'
import Modal from './Modal'
import FormField from './FormField'
import ToastContainer, { showToast } from './Toast'

interface Node {
  id: string
  name: string
  status: string
  region: string
  country: string
  city: string
  latitude: number
  longitude: number
  isp?: string
  probe_type: 'http' | 'dns'
  probe_interval: number
  last_heartbeat_at: string
  uptime: number
  created_at: string
  registration_status?: 'pending' | 'registered'
  agent_version?: string | null
  latest_metrics?: {
    cpu_usage: number
    memory_used_bytes: number
    memory_total_bytes: number
    collected_at: string
  } | null
}

interface InstallData {
  node_id: string
  enrollment_token: string
  expires_at: string
  install_command: string
}

interface TargetOption {
  id: string
  name: string
  target_type: string
  status: string
}

const REGIONS = [
  { value: 'asia', label: '亚洲' },
  { value: 'europe', label: '欧洲' },
  { value: 'north_america', label: '北美洲' },
  { value: 'south_america', label: '南美洲' },
  { value: 'oceania', label: '大洋洲' },
  { value: 'africa', label: '非洲' },
]

interface NodeForm {
  id: string
  name: string
  region: string
  country: string
  city: string
  latitude: number
  longitude: number
  isp: string
  probe_type: 'http' | 'dns'
  probe_interval: number
  status: string
  target_ids: string[]
}

const EMPTY_FORM: NodeForm = {
  id: '', name: '', region: 'asia', country: '待识别', city: '待识别', latitude: 0,
  longitude: 0, isp: '', probe_type: 'http', probe_interval: 60, status: 'offline', target_ids: [],
}

function TargetPicker({
  targets,
  selected,
  onChange,
}: {
  targets: TargetOption[]
  selected: string[]
  onChange: (ids: string[]) => void
}) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-3">
        <label className="text-sm font-medium text-slate-700 dark:text-slate-200">探测目标</label>
        <span className="text-[11px] text-slate-400">可选 · 已选 {selected.length} 个</span>
      </div>
      {targets.length > 0 ? (
        <div className="max-h-40 space-y-1 overflow-auto rounded-xl border border-slate-200 bg-white p-2 dark:border-slate-600 dark:bg-slate-800">
          {targets.map((target) => (
            <label key={target.id} className="flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 hover:bg-slate-50 dark:hover:bg-slate-700/60">
              <input
                type="checkbox"
                checked={selected.includes(target.id)}
                onChange={(event) => onChange(
                  event.target.checked
                    ? [...selected, target.id]
                    : selected.filter(id => id !== target.id),
                )}
                className="rounded border-slate-300 text-brand-600 focus:ring-brand-500"
              />
              <span className="flex-1 text-sm text-slate-700 dark:text-slate-200">{target.name}</span>
              <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] uppercase text-slate-500 dark:bg-slate-700 dark:text-slate-300">{target.target_type}</span>
            </label>
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-slate-300 p-3 text-xs leading-5 text-slate-500 dark:border-slate-600">
          暂无监控目标，可以先创建节点，稍后再关联。
        </div>
      )}
    </div>
  )
}

export default function NodeManager() {
  const [nodes, setNodes] = useState<Node[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [editingNode, setEditingNode] = useState<Node | null>(null)
  const [deletingNode, setDeletingNode] = useState<Node | null>(null)
  const [form, setForm] = useState<NodeForm>(EMPTY_FORM)
  const [installData, setInstallData] = useState<InstallData | null>(null)
  const [installModalOpen, setInstallModalOpen] = useState(false)
  const [generatingNodeId, setGeneratingNodeId] = useState<string | null>(null)
  const [targets, setTargets] = useState<TargetOption[]>([])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    loadNodes()
    loadTargets()
  }, [])

  async function loadTargets() {
    const res = await adminApi.getTargets()
    if (res.success && res.data) {
      const results = (res.data as any).results || res.data
      setTargets(Array.isArray(results) ? results : [])
    }
  }

  async function loadNodes() {
    setLoading(true)
    try {
      const res = await adminApi.getNodes()
      if (res.success && res.data) {
        const results = (res.data as any).results || res.data
        setNodes(Array.isArray(results) ? results : [])
      }
    } catch (e) {
      showToast('加载节点失败', 'error')
    }
    setLoading(false)
  }

  function handleCreate() {
    setEditingNode(null)
    setForm(EMPTY_FORM)
    setModalOpen(true)
  }

  async function handleEdit(node: Node) {
    setEditingNode(node)
    const nextForm: NodeForm = {
      name: node.name,
      id: node.id,
      region: node.region,
      country: node.country,
      city: node.city,
      latitude: node.latitude,
      longitude: node.longitude,
      isp: node.isp || '',
      probe_type: node.probe_type,
      probe_interval: node.probe_interval,
      status: node.status,
      target_ids: [],
    }
    const detail = await adminApi.getNode(node.id)
    if (detail.success && detail.data) {
      const associated = (detail.data as { targets?: TargetOption[] }).targets || []
      nextForm.target_ids = associated.map(target => target.id)
    }
    setForm(nextForm)
    setModalOpen(true)
  }

  function handleDelete(node: Node) {
    setDeletingNode(node)
    setDeleteModalOpen(true)
  }

  async function generateInstall(node: Node) {
    setGeneratingNodeId(node.id)
    try {
      const res = await adminApi.createAgentEnrollment(node.id)
      if (!res.success || !res.data) {
        showToast(res.error || '生成安装命令失败', 'error')
        return
      }
      setInstallData(res.data)
      setInstallModalOpen(true)
    } catch {
      showToast('生成安装命令失败', 'error')
    } finally {
      setGeneratingNodeId(null)
    }
  }

  async function copyInstallCommand() {
    if (!installData) return
    try {
      await navigator.clipboard.writeText(installData.install_command)
      showToast('安装命令已复制', 'success')
    } catch {
      showToast('复制失败，请手动选择命令', 'error')
    }
  }

  async function handleSubmit() {
    const name = form.name.trim()
    if (!name) {
      showToast('给这台 VPS 起个名字即可', 'error')
      return
    }
    setSaving(true)
    try {
      if (editingNode) {
        const res = await adminApi.updateNode(editingNode.id, { ...form, name })
        if (res.success) {
          showToast('节点更新成功', 'success')
          await loadNodes()
          setModalOpen(false)
        } else {
          showToast(res.error || '更新失败', 'error')
        }
      } else {
        const res = await adminApi.createNode({
          name,
          target_ids: form.target_ids,
          probe_interval: form.probe_interval,
        })
        if (res.success) {
          showToast('节点已创建，下一步安装 Agent', 'success')
          await loadNodes()
          const created = res.data as Node | undefined
          if (created?.id) await generateInstall(created)
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
    if (!deletingNode) return
    try {
      const res = await adminApi.deleteNode(deletingNode.id)
      if (res.success) {
        showToast('节点删除成功', 'success')
        loadNodes()
      } else {
        showToast(res.error || '删除失败', 'error')
      }
      setDeleteModalOpen(false)
    } catch (e) {
      showToast('删除失败', 'error')
    }
  }

  const filteredNodes = nodes.filter((node) => {
    if (search && !node.name.toLowerCase().includes(search.toLowerCase())) return false
    if (statusFilter && node.status !== statusFilter) return false
    return true
  })

  const columns = [
    { key: 'name', label: 'VPS 节点' },
    {
      key: 'registration_status',
      label: 'Agent',
      render: (value: unknown, row: Record<string, unknown>) => {
        const registered = value === 'registered'
        return (
          <div>
            <span className={`rounded-full px-2 py-1 text-xs ${registered ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' : 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300'}`}>
              {registered ? '已注册' : '待安装'}
            </span>
            {Boolean(row.agent_version) && <p className="mt-1 text-[11px] text-slate-400">v{String(row.agent_version)}</p>}
          </div>
        )
      },
    },
    {
      key: 'status',
      label: '状态',
      render: (value: unknown, row: Record<string, unknown>) => {
        if (row.registration_status !== 'registered') {
          return <span className="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-600 dark:bg-slate-700 dark:text-slate-300">未注册</span>
        }
        const status = String(value)
        const color =
          status === 'active' || status === 'online'
            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
            : status === 'offline'
              ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
              : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
        const label = status === 'active' ? '在线' : status === 'offline' ? '离线' : status === 'paused' ? '暂停' : status
        return <span className={`rounded-full px-2 py-1 text-xs ${color}`}>{label}</span>
      },
    },
    {
      key: 'city', label: '位置',
      render: (_: unknown, row: Record<string, unknown>) => {
        if (row.registration_status !== 'registered' || row.city === '待识别') {
          return <span className="text-slate-400">安装后识别</span>
        }
        return [row.city, row.country].filter(Boolean).join(', ')
      },
    },
    {
      key: 'last_heartbeat_at',
      label: '最后心跳',
      render: (value: unknown, row: Record<string, unknown>) => {
        if (!value || row.registration_status !== 'registered') return '--'
        return new Date(String(value)).toLocaleString('zh-CN')
      },
    },
    {
      key: 'uptime',
      label: '可用率',
      render: (value: unknown, row: Record<string, unknown>) => {
        if (row.registration_status !== 'registered' || value == null) return <span className="text-slate-400">--</span>
        const pct = Number(value)
        const color = pct >= 99 ? 'text-emerald-600' : pct >= 95 ? 'text-amber-600' : 'text-red-600'
        return <span className={color}>{pct.toFixed(2)}%</span>
      },
    },
    {
      key: 'actions',
      label: '操作',
      render: (_: unknown, row: Record<string, unknown>) => (
        <div className="flex gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation()
              void generateInstall(row as unknown as Node)
            }}
            disabled={generatingNodeId === String(row.id)}
            className="text-emerald-600 hover:text-emerald-700 disabled:opacity-50 dark:text-emerald-400"
          >
            {generatingNodeId === String(row.id) ? '生成中…' : row.registration_status === 'registered' ? '重装' : '安装'}
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation()
              void handleEdit(row as unknown as Node)
            }}
            className="text-brand-600 hover:text-brand-700 dark:text-brand-400"
          >
            编辑
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation()
              handleDelete(row as unknown as Node)
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
        <p className="font-semibold">添加节点只需要一个名字</p>
        <p className="mt-1 text-xs leading-5 text-blue-700 dark:text-blue-300">节点 ID、系统信息和地理位置由系统自动处理。创建后把一次性安装命令复制到 VPS 执行即可，无需开放额外入站端口。</p>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <button onClick={handleCreate} className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">
          + 添加节点
        </button>
        <input
          type="text"
          placeholder="搜索节点名称..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-700 dark:text-white"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-700 dark:text-white"
        >
          <option value="">全部状态</option>
          <option value="active">在线</option>
          <option value="offline">离线</option>
          <option value="paused">已暂停</option>
        </select>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800">
        <DataTable columns={columns} data={filteredNodes as unknown as Record<string, unknown>[]} loading={loading} />
      </div>

      {/* 编辑/新增弹窗 */}
      <Modal
        open={modalOpen}
        title={editingNode ? '编辑节点' : '添加一台 VPS'}
        onClose={() => setModalOpen(false)}
        onConfirm={handleSubmit}
        confirmText={saving ? '保存中…' : editingNode ? '保存修改' : '创建并获取安装命令'}
        confirmDisabled={saving || !form.name.trim()}
        closeOnConfirm={false}
      >
        {!editingNode ? (
          <div className="space-y-4">
            <div className="rounded-2xl border border-brand-200 bg-brand-50/70 p-4 dark:border-brand-900/70 dark:bg-brand-950/20">
              <FormField
                label="这台 VPS 叫什么？"
                required
                autoFocus
                value={form.name}
                onChange={(e: any) => setForm({ ...form, name: e.target.value })}
                placeholder="例如：东京轻量云"
              />
              <p className="mt-2 text-xs leading-5 text-slate-500 dark:text-slate-400">仅此一项必填。节点 ID、位置、系统和网络信息会在 Agent 上线后自动识别。</p>
            </div>

            <details className="group rounded-xl border border-slate-200 bg-slate-50/70 dark:border-slate-700 dark:bg-slate-900/30">
              <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 font-medium text-slate-700 dark:text-slate-200">
                <span>可选设置</span>
                <span className="text-xs font-normal text-slate-400 group-open:hidden">目标与采集频率</span>
                <span className="hidden text-slate-400 group-open:inline">收起</span>
              </summary>
              <div className="space-y-4 border-t border-slate-200 px-4 py-4 dark:border-slate-700">
                <TargetPicker
                  targets={targets}
                  selected={form.target_ids}
                  onChange={(target_ids) => setForm({ ...form, target_ids })}
                />
                <FormField
                  as="select"
                  label="资源采集频率"
                  value={String(form.probe_interval)}
                  onChange={(e: any) => setForm({ ...form, probe_interval: Number(e.target.value) })}
                  options={[
                    { value: '60', label: '每 1 分钟（推荐）' },
                    { value: '120', label: '每 2 分钟' },
                    { value: '300', label: '每 5 分钟（更省额度）' },
                    { value: '600', label: '每 10 分钟' },
                  ]}
                />
              </div>
            </details>

            <div className="grid grid-cols-3 gap-2 text-center text-[11px] text-slate-500 dark:text-slate-400">
              {['创建节点', '复制命令', '等待上线'].map((label, index) => (
                <div key={label} className="rounded-lg bg-slate-50 px-2 py-2 dark:bg-slate-700/40">
                  <span className="mr-1 font-mono text-brand-600 dark:text-brand-400">{index + 1}</span>{label}
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-5">
            <div>
              <FormField
                label="节点名称"
                required
                autoFocus
                value={form.name}
                onChange={(e: any) => setForm({ ...form, name: e.target.value })}
              />
              <p className="mt-1.5 text-[11px] text-slate-400">节点 ID：<code>{form.id}</code></p>
            </div>

            <TargetPicker
              targets={targets}
              selected={form.target_ids}
              onChange={(target_ids) => setForm({ ...form, target_ids })}
            />

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                as="select"
                label="资源采集频率"
                value={String(form.probe_interval)}
                onChange={(e: any) => setForm({ ...form, probe_interval: Number(e.target.value) })}
                options={[
                  { value: '60', label: '每 1 分钟' },
                  { value: '120', label: '每 2 分钟' },
                  { value: '300', label: '每 5 分钟' },
                  { value: '600', label: '每 10 分钟' },
                ]}
              />
              <FormField
                as="select"
                label="运行状态"
                value={form.status}
                onChange={(e: any) => setForm({ ...form, status: e.target.value })}
                options={[
                  ...(form.status === 'offline' ? [{ value: 'offline', label: '离线（由系统判断）' }] : []),
                  { value: 'active', label: '启用' },
                  { value: 'paused', label: '暂停' },
                ]}
              />
            </div>

            <details className="group rounded-xl border border-slate-200 dark:border-slate-700">
              <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 font-medium text-slate-700 dark:text-slate-200">
                <span>手动修正位置</span>
                <span className="text-xs font-normal text-slate-400">默认由 Agent 自动识别</span>
              </summary>
              <div className="grid gap-4 border-t border-slate-200 px-4 py-4 sm:grid-cols-2 dark:border-slate-700">
                <FormField as="select" label="地区" value={form.region} onChange={(e: any) => setForm({ ...form, region: e.target.value })} options={REGIONS} />
                <FormField label="国家/地区" value={form.country} onChange={(e: any) => setForm({ ...form, country: e.target.value })} />
                <FormField label="城市" value={form.city} onChange={(e: any) => setForm({ ...form, city: e.target.value })} />
                <FormField label="ISP" value={form.isp} onChange={(e: any) => setForm({ ...form, isp: e.target.value })} />
                <FormField label="纬度" type="number" step="any" value={form.latitude} onChange={(e: any) => setForm({ ...form, latitude: Number(e.target.value) })} />
                <FormField label="经度" type="number" step="any" value={form.longitude} onChange={(e: any) => setForm({ ...form, longitude: Number(e.target.value) })} />
              </div>
            </details>
          </div>
        )}
      </Modal>

      <Modal
        open={installModalOpen}
        title="最后一步：安装 Agent"
        onClose={() => { setInstallModalOpen(false); setInstallData(null) }}
      >
        {installData && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-200">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-sm font-bold text-white">✓</span>
              <div>
                <p className="font-medium">节点已经创建</p>
                <p className="mt-0.5 text-xs opacity-80">复制下面唯一一条命令，在目标 VPS 执行即可。</p>
              </div>
            </div>
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200">
              此命令包含一次性注册令牌，将于 {new Date(installData.expires_at).toLocaleString('zh-CN')} 过期。请勿发送到群聊或写入脚本仓库。
            </div>
            <div>
              <label className="mb-2 block text-xs font-medium text-slate-500 dark:text-slate-400">在目标 VPS 上以 root 或 sudo 执行</label>
              <pre className="max-h-44 overflow-auto whitespace-pre-wrap break-all rounded-lg bg-slate-950 p-4 font-mono text-xs leading-5 text-emerald-300 select-all">{installData.install_command}</pre>
            </div>
            <button
              type="button"
              onClick={copyInstallCommand}
              className="w-full rounded-lg bg-brand-600 px-4 py-2.5 font-medium text-white hover:bg-brand-700"
            >
              复制安装命令
            </button>
            <p className="text-xs text-slate-500 dark:text-slate-400">安装完成后通常会在 1 分钟内显示为在线。可在 VPS 执行 <code>systemctl status braum-agent</code> 查看服务状态。</p>
          </div>
        )}
      </Modal>

      {/* 删除确认弹窗 */}
      <Modal
        open={deleteModalOpen}
        title="确认删除"
        onClose={() => setDeleteModalOpen(false)}
        onConfirm={handleConfirmDelete}
        confirmText="删除"
        confirmDanger
      >
        <p>
          确定要删除节点 <strong>{deletingNode?.name}</strong> 吗？此操作不可恢复。
        </p>
      </Modal>
    </>
  )
}
