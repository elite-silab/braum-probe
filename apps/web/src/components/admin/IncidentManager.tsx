'use client'

// Braum 布隆 CF 探针 — 公告管理组件
import { useState, useEffect } from 'react'
import { adminApi } from '../../lib/api'
import DataTable from './DataTable'
import Modal from './Modal'
import FormField from './FormField'
import ToastContainer, { showToast } from './Toast'

interface Incident {
  id: string
  title: string
  severity: string
  status: string
  description: string
  resolved_at: string | null
  created_at: string
}

export default function IncidentManager() {
  const [incidents, setIncidents] = useState<Incident[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [editingIncident, setEditingIncident] = useState<Incident | null>(null)
  const [deletingIncident, setDeletingIncident] = useState<Incident | null>(null)
  const [form, setForm] = useState({
    title: '',
    severity: 'minor',
    status: 'investigating',
    description: '',
  })

  useEffect(() => {
    loadIncidents()
  }, [])

  async function loadIncidents() {
    setLoading(true)
    try {
      const res = await adminApi.getIncidents()
      if (res.success && res.data) {
        const results = (res.data as any).results || res.data
        setIncidents(Array.isArray(results) ? results : [])
      }
    } catch (e) {
      showToast('加载公告失败', 'error')
    }
    setLoading(false)
  }

  function handleCreate() {
    setEditingIncident(null)
    setForm({
      title: '',
      severity: 'minor',
      status: 'investigating',
      description: '',
    })
    setModalOpen(true)
  }

  function handleEdit(incident: Incident) {
    setEditingIncident(incident)
    setForm({
      title: incident.title,
      severity: incident.severity,
      status: incident.status,
      description: incident.description,
    })
    setModalOpen(true)
  }

  function handleDelete(incident: Incident) {
    setDeletingIncident(incident)
    setDeleteModalOpen(true)
  }

  async function handleSubmit() {
    try {
      const data = form
      if (editingIncident) {
        const res = await adminApi.updateIncident(editingIncident.id, data)
        if (res.success) {
          showToast('公告更新成功', 'success')
          loadIncidents()
        } else {
          showToast(res.error || '更新失败', 'error')
        }
      } else {
        const res = await adminApi.createIncident(data)
        if (res.success) {
          showToast('公告创建成功', 'success')
          loadIncidents()
        } else {
          showToast(res.error || '创建失败', 'error')
        }
      }
      setModalOpen(false)
    } catch (e) {
      showToast('操作失败', 'error')
    }
  }

  async function handleConfirmDelete() {
    if (!deletingIncident) return
    try {
      const res = await adminApi.deleteIncident(deletingIncident.id)
      if (res.success) {
        showToast('公告删除成功', 'success')
        loadIncidents()
      } else {
        showToast(res.error || '删除失败', 'error')
      }
      setDeleteModalOpen(false)
    } catch (e) {
      showToast('删除失败', 'error')
    }
  }

  const columns = [
    { key: 'title', label: '标题' },
    {
      key: 'severity',
      label: '严重性',
      render: (v: unknown) => {
        const severity = String(v)
        const colorMap: Record<string, string> = {
          minor: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
          major: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
          critical: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
        }
        return <span className={`rounded-full px-2 py-1 text-xs ${colorMap[severity] || ''}`}>{severity}</span>
      },
    },
    {
      key: 'status',
      label: '状态',
      render: (v: unknown) => {
        const status = String(v)
        const color =
          status === 'resolved'
            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
            : status === 'investigating'
              ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
              : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
        return <span className={`rounded-full px-2 py-1 text-xs ${color}`}>{status}</span>
      },
    },
    {
      key: 'created_at',
      label: '创建时间',
      render: (v: unknown) => (v ? new Date(String(v)).toLocaleString('zh-CN') : '--'),
    },
    {
      key: 'resolved_at',
      label: '解决时间',
      render: (v: unknown) => (v ? new Date(String(v)).toLocaleString('zh-CN') : '--'),
    },
    {
      key: 'actions',
      label: '操作',
      render: (_: unknown, row: Record<string, unknown>) => (
        <div className="flex gap-2">
          <button onClick={(e: any) => { e.stopPropagation(); handleEdit(row as unknown as Incident) }} className="text-brand-600 hover:text-brand-700 dark:text-brand-400">编辑</button>
          <button onClick={(e: any) => { e.stopPropagation(); handleDelete(row as unknown as Incident) }} className="text-red-600 hover:text-red-700 dark:text-red-400">删除</button>
        </div>
      ),
    },
  ]

  return (
    <>
      <ToastContainer />

      <div className="mb-4">
        <button onClick={handleCreate} className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">
          + 新增公告
        </button>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800">
        <DataTable columns={columns} data={incidents as unknown as Record<string, unknown>[]} loading={loading} />
      </div>

      <Modal
        open={modalOpen}
        title={editingIncident ? '编辑公告' : '新增公告'}
        onClose={() => setModalOpen(false)}
        onConfirm={handleSubmit}
        confirmText={editingIncident ? '更新' : '创建'}
      >
        <div className="space-y-4">
          <FormField label="标题" required value={form.title} onChange={(e: any) => setForm({ ...form, title: e.target.value })} />
          <FormField
            as="select"
            label="严重性"
            value={form.severity}
            onChange={(e: any) => setForm({ ...form, severity: e.target.value })}
            options={[
              { value: 'minor', label: '轻微' },
              { value: 'major', label: '重大' },
              { value: 'critical', label: '严重' },
            ]}
          />
          <FormField
            as="select"
            label="状态"
            value={form.status}
            onChange={(e: any) => setForm({ ...form, status: e.target.value })}
            options={[
              { value: 'investigating', label: '调查中' },
              { value: 'identified', label: '已定位' },
              { value: 'monitoring', label: '监控中' },
              { value: 'resolved', label: '已解决' },
              { value: 'scheduled', label: '计划中' },
            ]}
          />
          <FormField as="textarea" label="描述" value={form.description} onChange={(e: any) => setForm({ ...form, description: e.target.value })} rows={4} />
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
          确定要删除公告 <strong>{deletingIncident?.title}</strong> 吗？此操作不可恢复。
        </p>
      </Modal>
    </>
  )
}
