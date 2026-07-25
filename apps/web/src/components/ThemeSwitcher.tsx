// Braum 布隆 CF 探针 — 主题切换器（4 套主题 + 独立 Dark 模式开关）
import { useState, useEffect, useRef } from 'react'

interface ThemeOption {
  id: string
  name: string
  nameJa: string
  icon: string
  color: string
  forceDark?: boolean
}

const THEMES: ThemeOption[] = [
  { id: 'default', name: '默认', nameJa: 'デフォルト', icon: '◉', color: '#3b82f6' },
  { id: 'sakura', name: '樱の物語', nameJa: '桜の物語', icon: '🌸', color: '#ec4899' },
  { id: 'hoshizora', name: '星海夜航', nameJa: '星海夜航', icon: '✨', color: '#8b5cf6', forceDark: true },
  { id: 'suirei', name: '翠灵庭院', nameJa: '翠霊庭園', icon: '🍃', color: '#10b981' },
]

function applyTheme(themeId: string, isDark: boolean) {
  const root = document.documentElement
  root.removeAttribute('data-theme')
  root.classList.remove('dark')

  // 应用 data-theme
  if (themeId !== 'default') {
    root.setAttribute('data-theme', themeId)
  }

  // 应用 dark 模式（星海强制深色）
  const theme = THEMES.find((t) => t.id === themeId)
  if (isDark || theme?.forceDark) {
    root.classList.add('dark')
  }
}

export default function ThemeSwitcher() {
  const [open, setOpen] = useState(false)
  const [current, setCurrent] = useState('default')
  const [isDark, setIsDark] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const savedTheme = localStorage.getItem('braum-theme') || 'default'
    const savedDark = localStorage.getItem('braum-dark') === 'true'
    setCurrent(savedTheme)
    setIsDark(savedDark)
    applyTheme(savedTheme, savedDark)

    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  function selectTheme(themeId: string) {
    setCurrent(themeId)
    localStorage.setItem('braum-theme', themeId)
    applyTheme(themeId, isDark)
  }

  function toggleDark() {
    const next = !isDark
    setIsDark(next)
    localStorage.setItem('braum-dark', String(next))
    applyTheme(current, next)
  }

  const currentTheme = THEMES.find((t) => t.id === current) || THEMES[0]

  return (
    <div className="flex items-center gap-1" ref={ref}>
      {/* Dark 模式开关 */}
      <button
        onClick={toggleDark}
        className="rounded-lg p-2 text-sm transition-colors theme-hover"
        style={{ color: 'var(--surface-text-secondary)' }}
        title={isDark ? '切换亮色模式' : '切换暗色模式'}
        aria-label={isDark ? '切换亮色模式' : '切换暗色模式'}
      >
        {isDark ? (
          <svg className="h-4.5 w-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" />
          </svg>
        ) : (
          <svg className="h-4.5 w-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z" />
          </svg>
        )}
      </button>

      {/* 主题选择器 */}
      <div className="relative">
        <button
          onClick={() => setOpen(!open)}
          className="flex items-center gap-1.5 rounded-lg px-2 py-2 text-sm transition-colors theme-hover"
          style={{ color: 'var(--surface-text-secondary)' }}
          aria-label="切换主题"
        >
          <span className="text-base">{currentTheme.icon}</span>
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {open && (
          <div
            className="absolute right-0 top-full z-50 mt-2 w-52 rounded-xl border p-2 shadow-xl"
            style={{
              backgroundColor: 'var(--surface-card)',
              borderColor: 'var(--surface-border)',
            }}
          >
            <div
              className="mb-2 px-3 py-1.5 text-xs font-medium uppercase tracking-wider"
              style={{ color: 'var(--surface-text-secondary)' }}
            >
              选择主题
            </div>

            <div className="space-y-0.5">
              {THEMES.map((theme) => {
                const isActive = current === theme.id
                return (
                  <button
                    key={theme.id}
                    onClick={() => selectTheme(theme.id)}
                    className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-colors ${
                      isActive ? 'theme-active' : ''
                    }`}
                    style={{
                      color: isActive ? 'var(--surface-active-text)' : 'var(--surface-text)',
                    }}
                    onMouseEnter={(e) => {
                      if (!isActive) (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--surface-hover)'
                    }}
                    onMouseLeave={(e) => {
                      if (!isActive) (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'
                    }}
                  >
                    <span
                      className="flex h-8 w-8 items-center justify-center rounded-lg text-base"
                      style={{ backgroundColor: theme.color + '20' }}
                    >
                      {theme.icon}
                    </span>
                    <div className="flex-1">
                      <div className="font-medium">{theme.name}</div>
                      <div className="text-xs opacity-60">{theme.nameJa}</div>
                    </div>
                    {isActive && (
                      <svg className="h-4 w-4" style={{ color: 'var(--theme-primary)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </button>
                )
              })}
            </div>

            {/* 提示：星海强制深色 */}
            {current === 'hoshizora' && (
              <div className="mt-2 px-3 py-1.5 text-xs opacity-50" style={{ color: 'var(--surface-text-secondary)' }}>
                ✦ 星海主题始终为深色模式
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
