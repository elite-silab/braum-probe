'use client'

// Braum 布隆 CF 探针 — 告警管理组件
import { useState, useEffect } from 'react'
import { adminApi } from '../../lib/api'
import DataTable from './DataTable'
import Modal from './Modal'
import FormField from './FormField'
import ToastContainer, { showToast } from './Toast'

interface AlertRule {
  id: string
  name: string
  metric: string
  operator: string
  threshold: number
  duration_seconds: number
  enabled: boolean
  created_at: string
}

interface AlertChannel {
  id: string
  name: string
  channel_type: string
  enabled: boolean
  created_at: string
}

const RULE_TEMPLATES = [
  { id: 'offline', label: 'Agent 离线', note: '超过 3 分钟无心跳', name: 'Agent 离线', metric: 'heartbeat_age_seconds', operator: '>', threshold: 180, duration_seconds: 60 },
  { id: 'cpu', label: 'CPU 过高', note: '5 分钟平均超过 90%', name: 'CPU 使用率过高', metric: 'cpu_usage', operator: '>', threshold: 90, duration_seconds: 300 },
  { id: 'memory', label: '内存过高', note: '5 分钟平均超过 90%', name: '内存使用率过高', metric: 'memory_usage', operator: '>', threshold: 90, duration_seconds: 300 },
  { id: 'disk', label: '磁盘不足', note: '使用率超过 85%', name: '磁盘使用率过高', metric: 'disk_usage', operator: '>', threshold: 85, duration_seconds: 300 },
  { id: 'availability', label: '可用率下降', note: '2 小时低于 99%', name: '网络可用率下降', metric: 'availability', operator: '<', threshold: 0.99, duration_seconds: 7200 },
] as const

export default function AlertManager() {
  const [activeTab, setActiveTab] = useState<'rules' | 'channels'>('rules')
  const [rules, setRules] = useState<AlertRule[]>([])
  const [channels, setChannels] = useState<AlertChannel[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [editingRule, setEditingRule] = useState<AlertRule | null>(null)
  const [editingChannel, setEditingChannel] = useState<AlertChannel | null>(null)
  const [deletingItem, setDeletingItem] = useState<{ type: 'rule' | 'channel'; id: string; name: string } | null>(null)

  const [ruleForm, setRuleForm] = useState({
    name: '',
    metric: 'availability',
    operator: '<',
    threshold: 0.99,
    duration_seconds: 300,
    enabled: true,
  })

  const [channelForm, setChannelForm] = useState({
    name: 'Telegram 通知',
    channel_type: 'telegram',
    bot_token: '',
    chat_id: '',
    webhook_url: '',
    enabled: true,
  })

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    setLoading(true)
    try {
      const [rulesRes, channelsRes] = await Promise.all([
        adminApi.getAlertRules(),
        adminApi.getAlertChannels(),
      ])
      if (rulesRes.success && rulesRes.data) {
        setRules(Array.isArray(rulesRes.data) ? rulesRes.data as AlertRule[] : [])
      }
      if (channelsRes.success && channelsRes.data) {
        setChannels(Array.isArray(channelsRes.data) ? channelsRes.data as AlertChannel[] : [])
      }
    } catch (e) {
      showToast('加载告警数据失败', 'error')
    }
    setLoading(false)
  }

  function handleCreateRule() {
    setEditingRule(null)
    setRuleForm({ name: 'Agent 离线', metric: 'heartbeat_age_seconds', operator: '>', threshold: 180, duration_seconds: 60, enabled: true })
    setEditingChannel(null)
    setModalOpen(true)
  }

  function handleEditRule(rule: AlertRule) {
    setEditingRule(rule)
    setRuleForm({
      name: rule.name,
      metric: rule.metric,
      operator: rule.operator,
      threshold: rule.threshold,
      duration_seconds: rule.duration_seconds,
      enabled: rule.enabled,
    })
    setEditingChannel(null)
    setModalOpen(true)
  }

  function handleCreateChannel() {
    setEditingChannel(null)
    setChannelForm({ name: 'Telegram 通知', channel_type: 'telegram', bot_token: '', chat_id: '', webhook_url: '', enabled: true })
    setEditingRule(null)
    setModalOpen(true)
  }

  function handleEditChannel(channel: AlertChannel) {
    setEditingChannel(channel)
    setChannelForm({
      name: channel.name,
      channel_type: channel.channel_type,
      bot_token: '',
      chat_id: '',
      webhook_url: '',
      enabled: channel.enabled,
    })
    setEditingRule(null)
    setModalOpen(true)
  }

  function applyTemplate(template: typeof RULE_TEMPLATES[number]) {
    setRuleForm({
      name: template.name,
      metric: template.metric,
      operator: template.operator,
      threshold: template.threshold,
      duration_seconds: template.duration_seconds,
      enabled: true,
    })
  }

  function handleDelete(type: 'rule' | 'channel', id: string, name: string) {
    setDeletingItem({ type, id, name })
    setDeleteModalOpen(true)
  }

  async function handleSubmit() {
    try {
      if (editingRule) {
        const res = await adminApi.updateAlertRule(editingRule.id, ruleForm)
        if (res.success) {
          showToast('规则更新成功', 'success')
          loadData()
          setModalOpen(false)
        } else {
          showToast(res.error || '更新失败', 'error')
        }
      } else if (editingChannel) {
        const config = channelForm.channel_type === 'telegram'
          ? (channelForm.chat_id.trim() ? {
              chat_id: channelForm.chat_id.trim(),
              ...(channelForm.bot_token.trim() ? { bot_token: channelForm.bot_token.trim() } : {}),
            } : undefined)
          : (channelForm.webhook_url.trim() ? { url: channelForm.webhook_url.trim() } : undefined)
        const res = await adminApi.updateAlertChannel(editingChannel.id, {
          name: channelForm.name,
          channel_type: channelForm.channel_type,
          enabled: channelForm.enabled,
          ...(config === undefined ? {} : { config }),
        })
        if (res.success) {
          showToast('渠道更新成功', 'success')
          loadData()
          setModalOpen(false)
        } else {
          showToast(res.error || '更新失败', 'error')
        }
      } else if (activeTab === 'rules') {
        const res = await adminApi.createAlertRule(ruleForm)
        if (res.success) {
          showToast('规则创建成功', 'success')
          loadData()
          setModalOpen(false)
        } else {
          showToast(res.error || '创建失败', 'error')
        }
      } else {
        const config = channelForm.channel_type === 'telegram'
          ? {
              chat_id: channelForm.chat_id.trim(),
              ...(channelForm.bot_token.trim() ? { bot_token: channelForm.bot_token.trim() } : {}),
            }
          : { url: channelForm.webhook_url.trim() }
        const res = await adminApi.createAlertChannel({
          name: channelForm.name,
          channel_type: channelForm.channel_type,
          config,
          enabled: channelForm.enabled,
        })
        if (res.success) {
          showToast('渠道创建成功', 'success')
          loadData()
          setModalOpen(false)
        } else {
          showToast(res.error || '创建失败', 'error')
        }
      }
    } catch (e) {
      showToast('操作失败', 'error')
    }
  }

  async function handleConfirmDelete() {
    if (!deletingItem) return
    try {
      const res =
        deletingItem.type === 'rule'
          ? await adminApi.deleteAlertRule(deletingItem.id)
          : await adminApi.deleteAlertChannel(deletingItem.id)
      if (res.success) {
        showToast(`${deletingItem.type === 'rule' ? '规则' : '渠道'}删除成功`, 'success')
        loadData()
      } else {
        showToast(res.error || '删除失败', 'error')
      }
      setDeleteModalOpen(false)
    } catch (e) {
      showToast('删除失败', 'error')
    }
  }

  const ruleColumns = [
    { key: 'name', label: '名称' },
    {
      key: 'metric',
      label: '指标',
      render: (v: unknown) => {
        const map: Record<string, string> = {
          availability: '可用率', latency_ms: '延迟', consecutive_failures: '连续失败',
          cpu_usage: 'CPU 使用率', memory_usage: '内存使用率', disk_usage: '磁盘使用率',
          load_1: '系统负载', heartbeat_age_seconds: '心跳中断',
        }
        return map[String(v)] || String(v)
      },
    },
    {
      key: 'operator',
      label: '条件',
      render: (v: unknown) => String(v),
    },
    { key: 'threshold', label: '阈值' },
    { key: 'duration_seconds', label: '持续时间(s)' },
    {
      key: 'enabled',
      label: '状态',
      render: (v: unknown) => (
        <span
          className={`rounded-full px-2 py-1 text-xs ${
            v
              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
              : 'bg-slate-100 text-slate-700 dark:bg-slate-900/30 dark:text-slate-400'
          }`}
        >
          {v ? '启用' : '禁用'}
        </span>
      ),
    },
    {
      key: 'actions',
      label: '操作',
      render: (_: unknown, row: Record<string, unknown>) => (
        <div className="flex gap-2">
          <button onClick={(e: any) => { e.stopPropagation(); handleEditRule(row as unknown as AlertRule) }} className="text-brand-600 hover:text-brand-700 dark:text-brand-400">编辑</button>
          <button onClick={(e: any) => { e.stopPropagation(); handleDelete('rule', String(row.id), String(row.name)) }} className="text-red-600 hover:text-red-700 dark:text-red-400">删除</button>
        </div>
      ),
    },
  ]

  const channelColumns = [
    { key: 'name', label: '名称' },
    {
      key: 'channel_type',
      label: '类型',
      render: (v: unknown) => <span className="rounded-full bg-blue-100 px-2 py-1 text-xs text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">{String(v)}</span>,
    },
    {
      key: 'enabled',
      label: '状态',
      render: (v: unknown) => (
        <span
          className={`rounded-full px-2 py-1 text-xs ${
            v
              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
              : 'bg-slate-100 text-slate-700 dark:bg-slate-900/30 dark:text-slate-400'
          }`}
        >
          {v ? '启用' : '禁用'}
        </span>
      ),
    },
    {
      key: 'actions',
      label: '操作',
      render: (_: unknown, row: Record<string, unknown>) => (
        <div className="flex gap-2">
          <button onClick={(e: any) => { e.stopPropagation(); handleEditChannel(row as unknown as AlertChannel) }} className="text-brand-600 hover:text-brand-700 dark:text-brand-400">编辑</button>
          <button onClick={(e: any) => { e.stopPropagation(); handleDelete('channel', String(row.id), String(row.name)) }} className="text-red-600 hover:text-red-700 dark:text-red-400">删除</button>
        </div>
      ),
    },
  ]

  const editingRuleMode = activeTab === 'rules' || Boolean(editingRule)
  const channelConfigReady = editingChannel
    ? true
    : channelForm.channel_type === 'telegram'
      ? Boolean(channelForm.chat_id.trim())
      : Boolean(channelForm.webhook_url.trim())
  const modalReady = editingRuleMode
    ? Boolean(ruleForm.name.trim())
    : Boolean(channelForm.name.trim()) && channelConfigReady

  return (
    <>
      <ToastContainer />

      <div className="mb-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-100">
        <p className="font-semibold">推荐模板已经覆盖轻量监控的常见场景</p>
        <p className="mt-1 text-xs leading-5 text-emerald-700 dark:text-emerald-300">选择 Agent 离线、CPU、内存、磁盘或可用率模板即可。通知渠道默认作用于全部规则，不需要逐条关联。</p>
      </div>

      <div className="mb-4 flex gap-2">
        <button
          onClick={() => setActiveTab('rules')}
          className={`rounded-lg px-4 py-2 text-sm font-medium ${
            activeTab === 'rules'
              ? 'bg-brand-600 text-white'
              : 'bg-white text-slate-700 hover:bg-slate-50 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
          }`}
        >
          告警规则
        </button>
        <button
          onClick={() => setActiveTab('channels')}
          className={`rounded-lg px-4 py-2 text-sm font-medium ${
            activeTab === 'channels'
              ? 'bg-brand-600 text-white'
              : 'bg-white text-slate-700 hover:bg-slate-50 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
          }`}
        >
          通知渠道
        </button>
      </div>

      <div className="mb-4">
        {activeTab === 'rules' ? (
          <button onClick={handleCreateRule} className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">
            + 使用模板添加规则
          </button>
        ) : (
          <button onClick={handleCreateChannel} className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">
            + 添加通知渠道
          </button>
        )}
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800">
        {activeTab === 'rules' ? (
          <DataTable columns={ruleColumns} data={rules as unknown as Record<string, unknown>[]} loading={loading} />
        ) : (
          <DataTable columns={channelColumns} data={channels as unknown as Record<string, unknown>[]} loading={loading} />
        )}
      </div>

      <Modal
        open={modalOpen}
        title={
          editingRule ? '编辑规则' : editingChannel ? '编辑渠道' : activeTab === 'rules' ? '新增规则' : '新增渠道'
        }
        onClose={() => setModalOpen(false)}
        onConfirm={handleSubmit}
        confirmText={editingRule || editingChannel ? '保存修改' : '创建'}
        confirmDisabled={!modalReady}
        closeOnConfirm={false}
      >
        <div className="space-y-4">
          {editingRuleMode ? (
            <>
              {!editingRule && (
                <div>
                  <p className="mb-2 text-sm font-medium text-slate-700 dark:text-slate-200">选择一个推荐模板</p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {RULE_TEMPLATES.map(template => {
                      const selected = ruleForm.metric === template.metric
                        && ruleForm.operator === template.operator
                        && ruleForm.threshold === template.threshold
                      return (
                        <button
                          key={template.id}
                          type="button"
                          onClick={() => applyTemplate(template)}
                          className={`rounded-xl border p-3 text-left transition ${selected ? 'border-brand-500 bg-brand-50 ring-1 ring-brand-500 dark:bg-brand-950/30' : 'border-slate-200 hover:border-brand-300 dark:border-slate-700 dark:hover:border-brand-700'}`}
                        >
                          <span className="block text-sm font-semibold text-slate-900 dark:text-white">{template.label}</span>
                          <span className="mt-1 block text-[11px] text-slate-500 dark:text-slate-400">{template.note}</span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}

              <div className="rounded-xl bg-slate-50 p-3 text-xs leading-5 text-slate-600 dark:bg-slate-900/50 dark:text-slate-300">
                规则：<strong>{ruleForm.name}</strong>，阈值 <strong>{ruleForm.operator} {ruleForm.threshold}</strong>，观察窗口 <strong>{Math.round(ruleForm.duration_seconds / 60)} 分钟</strong>。
              </div>

              <details open={Boolean(editingRule)} className="group rounded-xl border border-slate-200 dark:border-slate-700">
                <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 font-medium text-slate-700 dark:text-slate-200">
                  <span>自定义规则</span>
                  <span className="text-xs font-normal text-slate-400">高级</span>
                </summary>
                <div className="space-y-4 border-t border-slate-200 px-4 py-4 dark:border-slate-700">
                  <FormField label="规则名称" required value={ruleForm.name} onChange={(e: any) => setRuleForm({ ...ruleForm, name: e.target.value })} />
                  <FormField
                    as="select"
                    label="指标"
                    value={ruleForm.metric}
                    onChange={(e: any) => setRuleForm({ ...ruleForm, metric: e.target.value })}
                    options={[
                      { value: 'heartbeat_age_seconds', label: 'Agent 心跳中断（秒）' },
                      { value: 'cpu_usage', label: 'CPU 使用率（%）' },
                      { value: 'memory_usage', label: '内存使用率（%）' },
                      { value: 'disk_usage', label: '磁盘使用率（%）' },
                      { value: 'load_1', label: '1 分钟系统负载' },
                      { value: 'availability', label: '网络可用率（0-1）' },
                      { value: 'latency_ms', label: '网络延迟（ms）' },
                      { value: 'consecutive_failures', label: '连续失败次数' },
                    ]}
                  />
                  <div className="grid gap-4 sm:grid-cols-2">
                    <FormField as="select" label="条件" value={ruleForm.operator} onChange={(e: any) => setRuleForm({ ...ruleForm, operator: e.target.value })} options={[{ value: '<', label: '小于' }, { value: '>', label: '大于' }, { value: '<=', label: '小于等于' }, { value: '>=', label: '大于等于' }]} />
                    <FormField label="阈值" type="number" step="any" value={ruleForm.threshold} onChange={(e: any) => setRuleForm({ ...ruleForm, threshold: Number(e.target.value) })} />
                  </div>
                  <FormField as="select" label="观察窗口" value={String(ruleForm.duration_seconds)} onChange={(e: any) => setRuleForm({ ...ruleForm, duration_seconds: Number(e.target.value) })} options={[{ value: '60', label: '1 分钟' }, { value: '300', label: '5 分钟' }, { value: '900', label: '15 分钟' }, { value: '3600', label: '1 小时' }, { value: '7200', label: '2 小时' }]} />
                  <FormField as="checkbox" label="立即启用" checked={ruleForm.enabled} onChange={(e: any) => setRuleForm({ ...ruleForm, enabled: e.target.checked })} />
                </div>
              </details>
            </>
          ) : (
            <>
              <FormField
                as="select"
                label="通知方式"
                value={channelForm.channel_type}
                disabled={Boolean(editingChannel)}
                onChange={(e: any) => {
                  const type = e.target.value
                  setChannelForm({ ...channelForm, channel_type: type, name: editingChannel ? channelForm.name : type === 'telegram' ? 'Telegram 通知' : 'Webhook 通知' })
                }}
                options={[
                  { value: 'telegram', label: 'Telegram' },
                  { value: 'webhook', label: 'Webhook' },
                ]}
              />
              {channelForm.channel_type === 'telegram' ? (
                <>
                  <FormField label="Chat ID" name="telegram-chat-id" autoComplete="off" required={!editingChannel} value={channelForm.chat_id} onChange={(e: any) => setChannelForm({ ...channelForm, chat_id: e.target.value })} placeholder="例如：-1001234567890" />
                  <FormField label="Bot Token" name="telegram-bot-token" autoComplete="new-password" type="password" value={channelForm.bot_token} onChange={(e: any) => setChannelForm({ ...channelForm, bot_token: e.target.value })} placeholder={editingChannel ? '留空表示保持不变' : '若已配置 TELEGRAM_BOT_TOKEN 可留空'} />
                </>
              ) : (
                <FormField label="Webhook URL" name="notification-webhook-url" autoComplete="off" type="url" required={!editingChannel} value={channelForm.webhook_url} onChange={(e: any) => setChannelForm({ ...channelForm, webhook_url: e.target.value })} placeholder={editingChannel ? '留空表示保持不变' : 'https://example.com/webhook'} />
              )}
              <details className="group rounded-xl border border-slate-200 dark:border-slate-700">
                <summary className="cursor-pointer list-none px-4 py-3 font-medium text-slate-700 dark:text-slate-200">可选设置</summary>
                <div className="space-y-4 border-t border-slate-200 px-4 py-4 dark:border-slate-700">
                  <FormField label="渠道名称" required value={channelForm.name} onChange={(e: any) => setChannelForm({ ...channelForm, name: e.target.value })} />
                  <FormField as="checkbox" label="启用" checked={channelForm.enabled} onChange={(e: any) => setChannelForm({ ...channelForm, enabled: e.target.checked })} />
                </div>
              </details>
              <p className="text-xs leading-5 text-slate-500 dark:text-slate-400">启用后自动接收全部告警规则，无需手动关联。</p>
            </>
          )}
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
          确定要删除{deletingItem?.type === 'rule' ? '规则' : '渠道'} <strong>{deletingItem?.name}</strong> 吗？此操作不可恢复。
        </p>
      </Modal>
    </>
  )
}
