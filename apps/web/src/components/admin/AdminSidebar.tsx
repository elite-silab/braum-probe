'use client'

// Braum 布隆 CF 探针 — 管理后台侧边栏
import { useState, useEffect } from 'react'

interface NavItem {
  label: string
  href: string
  icon: string
}

interface AdminSidebarProps {
  mobileOpen: boolean
  onMobileClose: () => void
}

const navItems: NavItem[] = [
  { label: '仪表盘', href: '/admin', icon: '📊' },
  { label: 'VPS 节点', href: '/admin/nodes', icon: '🖥' },
  { label: '监控目标', href: '/admin/targets', icon: '🎯' },
  { label: '告警规则', href: '/admin/alerts', icon: '🔔' },
  { label: '公告管理', href: '/admin/incidents', icon: '📢' },
  { label: '审计日志', href: '/admin/audit', icon: '📋' },
  { label: '系统设置', href: '/admin/settings', icon: '⚙️' },
]

function Navigation({ currentPath, collapsed, onNavigate }: { currentPath: string; collapsed: boolean; onNavigate?: () => void }) {
  return (
    <nav className="flex-1 space-y-1 overflow-y-auto p-3">
      {navItems.map((item) => {
        const isActive = currentPath === item.href
        return (
          <a
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors ${isActive ? 'theme-active' : 'theme-text-secondary theme-hover'}`}
            title={collapsed ? item.label : undefined}
            aria-current={isActive ? 'page' : undefined}
          >
            <span className="w-5 shrink-0 text-center text-base" aria-hidden="true">{item.icon}</span>
            {!collapsed && <span>{item.label}</span>}
          </a>
        )
      })}
    </nav>
  )
}

function BackToSite({ collapsed, onNavigate }: { collapsed: boolean; onNavigate?: () => void }) {
  return (
    <div className="theme-border border-t p-3">
      <a href="/" onClick={onNavigate} className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm theme-text-secondary theme-hover">
        <span className="w-5 shrink-0 text-center" aria-hidden="true">←</span>
        {!collapsed && <span>返回前台</span>}
      </a>
    </div>
  )
}

export default function AdminSidebar({ mobileOpen, onMobileClose }: AdminSidebarProps) {
  const [collapsed, setCollapsed] = useState(false)
  const [currentPath, setCurrentPath] = useState('')

  useEffect(() => {
    setCurrentPath(window.location.pathname)
  }, [])

  useEffect(() => {
    if (!mobileOpen) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onMobileClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [mobileOpen, onMobileClose])

  return (
    <>
      {mobileOpen && (
        <div className="fixed inset-0 z-[70] md:hidden">
          <button type="button" className="absolute inset-0 bg-slate-950/50 backdrop-blur-[1px]" onClick={onMobileClose} aria-label="关闭管理导航" />
          <aside className="theme-sidebar relative flex h-full w-[min(17rem,86vw)] flex-col border-r shadow-2xl" aria-label="管理导航">
            <div className="theme-border flex h-14 shrink-0 items-center justify-between border-b px-4">
              <span className="flex items-center gap-2">
                <img src="/logo-icon.svg" alt="Braum" className="h-7 w-7" />
                <span className="text-lg font-bold theme-text">Braum</span>
              </span>
              <button type="button" onClick={onMobileClose} className="theme-text-secondary flex h-9 w-9 items-center justify-center rounded-lg theme-hover" aria-label="关闭管理导航">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <Navigation currentPath={currentPath} collapsed={false} onNavigate={onMobileClose} />
            <BackToSite collapsed={false} onNavigate={onMobileClose} />
          </aside>
        </div>
      )}

      <aside className={`theme-sidebar hidden shrink-0 flex-col border-r transition-[width] duration-200 md:flex ${collapsed ? 'w-16' : 'w-60'}`} aria-label="管理导航">
        <div className={`theme-border flex h-14 shrink-0 items-center justify-between border-b ${collapsed ? 'px-2' : 'px-4'}`}>
          {!collapsed ? (
            <span className="flex items-center gap-2">
              <img src="/logo-icon.svg" alt="Braum" className="h-7 w-7" />
              <span className="text-lg font-bold theme-text">Braum</span>
            </span>
          ) : (
            <img src="/logo-icon.svg" alt="B" className="mx-auto h-6 w-6" />
          )}
          <button type="button" onClick={() => setCollapsed(!collapsed)} className="rounded p-1 theme-text-secondary hover:opacity-80" aria-label={collapsed ? '展开侧栏' : '收起侧栏'}>
            {collapsed ? '▶' : '◀'}
          </button>
        </div>
        <Navigation currentPath={currentPath} collapsed={collapsed} />
        <BackToSite collapsed={collapsed} />
      </aside>
    </>
  )
}
