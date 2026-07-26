'use client'

// Braum 布隆 CF 探针 — 系统设置表单
import { useState, useEffect } from 'react'
import { adminApi } from '../../lib/api'
import FormField from './FormField'
import ToastContainer, { showToast } from './Toast'

interface ThemeOption {
  id: string
  name: string
  nameJa: string
  icon: string
  color: string
  gradient: string
  forceDark?: boolean
  description: string
}

const THEMES: ThemeOption[] = [
  { id: 'default', name: '默认', nameJa: 'デフォルト', icon: '◉', color: '#3b82f6', gradient: 'from-blue-400 to-blue-600', description: 'Braum 经典蓝' },
  { id: 'sakura', name: '樱の物語', nameJa: '桜の物語', icon: '🌸', color: '#ec4899', gradient: 'from-pink-300 to-rose-500', description: '春日樱花，温暖柔和' },
  { id: 'hoshizora', name: '星海夜航', nameJa: '星海夜航', icon: '✨', color: '#8b5cf6', gradient: 'from-violet-600 to-indigo-900', forceDark: true, description: '星空幻想，始终深色' },
  { id: 'suirei', name: '翠灵庭院', nameJa: '翠霊庭園', icon: '🍃', color: '#10b981', gradient: 'from-emerald-300 to-teal-600', description: '森林精灵，清新自然' },
]

export default function SettingsForm() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [currentTheme, setCurrentTheme] = useState('default')
  const [isDark, setIsDark] = useState(false)
  const [settings, setSettings] = useState({
    site_name: 'Braum Status',
    default_probe_interval: '300',
    data_retention_days: '90',
    timezone: 'Asia/Shanghai',
    public_page_enabled: true,
  })

  useEffect(() => {
    loadSettings()
    setCurrentTheme(localStorage.getItem('braum-theme') || 'default')
    setIsDark(localStorage.getItem('braum-dark') === 'true')
  }, [])

  async function loadSettings() {
    setLoading(true)
    try {
      const res = await adminApi.getSettings()
      if (res.success && res.data) {
        setSettings({
          site_name: (res.data as any).site_name || 'Braum Status',
          default_probe_interval: (res.data as any).default_probe_interval || '300',
          data_retention_days: (res.data as any).data_retention_days || '90',
          timezone: (res.data as any).timezone || 'Asia/Shanghai',
          public_page_enabled: (res.data as any).public_page_enabled !== 'false',
        })
      }
    } catch (e) {
      showToast('加载设置失败', 'error')
    }
    setLoading(false)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      const res = await adminApi.updateSettings({
        site_name: settings.site_name,
        default_probe_interval: settings.default_probe_interval,
        data_retention_days: settings.data_retention_days,
        timezone: settings.timezone,
        public_page_enabled: String(settings.public_page_enabled),
      })
      if (res.success) {
        showToast('设置保存成功', 'success')
      } else {
        showToast(res.error || '保存失败', 'error')
      }
    } catch (e) {
      showToast('保存失败', 'error')
    }
    setSaving(false)
  }

  function applyThemeVisuals(themeId: string, dark: boolean) {
    const root = document.documentElement
    root.removeAttribute('data-theme')
    root.classList.remove('dark')
    if (themeId !== 'default') root.setAttribute('data-theme', themeId)
    const theme = THEMES.find((t) => t.id === themeId)
    if (dark || theme?.forceDark) root.classList.add('dark')
  }

  function selectTheme(themeId: string) {
    setCurrentTheme(themeId)
    localStorage.setItem('braum-theme', themeId)
    applyThemeVisuals(themeId, isDark)
    const theme = THEMES.find((t) => t.id === themeId)
    if (theme) showToast(`已切换到「${theme.name}」主题`, 'success')
  }

  function toggleDark() {
    const next = !isDark
    setIsDark(next)
    localStorage.setItem('braum-dark', String(next))
    applyThemeVisuals(currentTheme, next)
    showToast(next ? '已切换到暗色模式' : '已切换到亮色模式', 'success')
  }

  if (loading) {
    return (
      <div className="flex h-48 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-500 border-t-transparent" />
      </div>
    )
  }

  return (
    <>
      <ToastContainer />

      {/* 主题外观 */}
      <div className="mb-8 rounded-xl border p-6" style={{ backgroundColor: 'var(--surface-card)', borderColor: 'var(--surface-border)' }}>
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="mb-1 text-lg font-semibold theme-text">🎨 主题外观</h2>
            <p className="text-sm theme-text-secondary">选择你喜欢的二次元风格主题</p>
          </div>
          {/* Dark 模式开关 */}
          <button
            onClick={toggleDark}
            className="flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition-colors"
            style={{
              backgroundColor: isDark ? 'var(--surface-active)' : 'var(--surface-bg)',
              borderColor: 'var(--surface-border)',
              color: isDark ? 'var(--surface-active-text)' : 'var(--surface-text)',
            }}
          >
            {isDark ? (
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" />
              </svg>
            ) : (
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z" />
              </svg>
            )}
            {isDark ? '暗色模式' : '亮色模式'}
          </button>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {THEMES.map((theme) => {
            const isActive = currentTheme === theme.id
            return (
              <button
                key={theme.id}
                onClick={() => selectTheme(theme.id)}
                className={`group relative overflow-hidden rounded-xl border-2 p-4 text-left transition-all ${
                  isActive
                    ? 'ring-2 ring-offset-2'
                    : 'hover:scale-[1.02]'
                }`}
                style={{
                  borderColor: isActive ? theme.color : 'var(--surface-border)',
                  backgroundColor: 'var(--surface-bg)',
                }}
              >
                {/* 主题预览色块 */}
                <div
                  className={`mb-3 h-16 rounded-lg bg-gradient-to-br ${theme.gradient} flex items-center justify-center`}
                >
                  <span className="text-2xl">{theme.icon}</span>
                </div>

                <div className="font-medium theme-text">{theme.name}</div>
                <div className="text-xs theme-text-secondary">{theme.nameJa}</div>
                <div className="mt-1 text-xs opacity-60 theme-text-secondary">{theme.description}</div>

                {isActive && (
                  <div
                    className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full"
                    style={{ backgroundColor: theme.color }}
                  >
                    <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                )}
              </button>
            )
          })}
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="mb-8 rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-800">
          <h2 className="mb-4 text-lg font-semibold text-slate-900 dark:text-white">全局配置</h2>
          <div className="space-y-4">
            <FormField
              label="站点名称"
              value={settings.site_name}
              onChange={(e: any) => setSettings({ ...settings, site_name: e.target.value })}
            />
            <FormField
              label="默认探测间隔（秒）"
              type="number"
              value={settings.default_probe_interval}
              onChange={(e: any) => setSettings({ ...settings, default_probe_interval: e.target.value })}
            />
            <FormField
              label="数据保留天数"
              type="number"
              value={settings.data_retention_days}
              onChange={(e: any) => setSettings({ ...settings, data_retention_days: e.target.value })}
            />
            <FormField
              as="select"
              label="时区"
              value={settings.timezone}
              onChange={(e: any) => setSettings({ ...settings, timezone: e.target.value })}
              options={[
                { value: 'Asia/Shanghai', label: '亚洲/上海' },
                { value: 'UTC', label: 'UTC' },
                { value: 'America/New_York', label: '美东时间' },
                { value: 'America/Los_Angeles', label: '美西时间' },
                { value: 'Europe/London', label: '伦敦时间' },
                { value: 'Europe/Berlin', label: '柏林时间' },
              ]}
            />
            <FormField
              as="checkbox"
              label="公开前端展示页面"
              checked={settings.public_page_enabled}
              onChange={(e: any) => setSettings({ ...settings, public_page_enabled: e.target.checked })}
            />
          </div>
          <div className="mt-6">
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
            >
              {saving ? '保存中...' : '保存设置'}
            </button>
          </div>
        </div>
      </form>
    </>
  )
}
