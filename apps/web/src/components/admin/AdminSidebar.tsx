'use client'

// Braum 布隆 CF 探针 — 管理后台侧边栏
import { useEffect, useState, type ReactNode } from 'react'

type IconName = 'dashboard' | 'server' | 'target' | 'bell' | 'incident' | 'audit' | 'settings'

interface NavItem {
  label: string
  href: string
  icon: IconName
}

interface NavGroup {
  label: string
  items: NavItem[]
}

interface AdminSidebarProps {
  mobileOpen: boolean
  onMobileClose: () => void
}

const navGroups: NavGroup[] = [
  {
    label: '工作台',
    items: [{ label: '仪表盘', href: '/admin', icon: 'dashboard' }],
  },
  {
    label: '监控中心',
    items: [
      { label: 'VPS 节点', href: '/admin/nodes', icon: 'server' },
      { label: '监控目标', href: '/admin/targets', icon: 'target' },
      { label: '告警规则', href: '/admin/alerts', icon: 'bell' },
    ],
  },
  {
    label: '运营与系统',
    items: [
      { label: '公告管理', href: '/admin/incidents', icon: 'incident' },
      { label: '审计日志', href: '/admin/audit', icon: 'audit' },
      { label: '系统设置', href: '/admin/settings', icon: 'settings' },
    ],
  },
]

function NavIcon({ name }: { name: IconName }) {
  let paths: ReactNode

  switch (name) {
    case 'dashboard':
      paths = <><rect x="3" y="3" width="7" height="7" rx="2" /><rect x="14" y="3" width="7" height="4" rx="2" /><rect x="14" y="11" width="7" height="10" rx="2" /><rect x="3" y="14" width="7" height="7" rx="2" /></>
      break
    case 'server':
      paths = <><rect x="3" y="4" width="18" height="6" rx="2" /><rect x="3" y="14" width="18" height="6" rx="2" /><path d="M7 7h.01M7 17h.01M11 7h6M11 17h6" /></>
      break
    case 'target':
      paths = <><circle cx="12" cy="12" r="7" /><circle cx="12" cy="12" r="2.5" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3" /></>
      break
    case 'bell':
      paths = <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" /><path d="M10 21h4" /></>
      break
    case 'incident':
      paths = <><path d="m4 13 2-6 13-3-3 13-6 2-2-4-4-2Z" /><path d="m13 8 3 3M6 15l-2 5" /></>
      break
    case 'audit':
      paths = <><path d="M9 5h10M9 12h10M9 19h10" /><path d="m3 5 1 1 2-2M3 12l1 1 2-2M3 19l1 1 2-2" /></>
      break
    case 'settings':
      paths = <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.83 2.83-.06-.06a1.7 1.7 0 0 0-1.88-.34 1.7 1.7 0 0 0-1 1.55V21h-4v-.08a1.7 1.7 0 0 0-1-1.55 1.7 1.7 0 0 0-1.88.34l-.06.06-2.83-2.83.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-1.55-1H3v-4h.05A1.7 1.7 0 0 0 4.6 9a1.7 1.7 0 0 0-.34-1.88l-.06-.06 2.83-2.83.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-1.55V3h4v.05a1.7 1.7 0 0 0 1 1.55 1.7 1.7 0 0 0 1.88-.34l.06-.06 2.83 2.83-.06.06A1.7 1.7 0 0 0 19.4 9a1.7 1.7 0 0 0 1.55 1H21v4h-.05a1.7 1.7 0 0 0-1.55 1Z" /></>
      break
  }

  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths}</svg>
}

function Brand() {
  return (
    <a href="/admin" className="group flex min-w-0 items-center gap-3" aria-label="Braum Probe 管理后台">
      <span className="admin-brand-mark flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-transform duration-200 group-hover:-translate-y-0.5">
        <img src="/logo-icon.svg" alt="" className="h-7 w-7" />
      </span>
      <span className="min-w-0 leading-none">
        <span className="theme-text block truncate text-[15px] font-bold tracking-tight">Braum Probe</span>
        <span className="theme-text-secondary mt-1.5 block truncate text-[10px] font-semibold tracking-[0.16em]">轻量监控中心</span>
      </span>
    </a>
  )
}

function Navigation({ currentPath, onNavigate }: { currentPath: string; onNavigate?: () => void }) {
  return (
    <nav className="flex-1 overflow-y-auto px-3 py-4" aria-label="后台功能">
      <div className="space-y-5">
        {navGroups.map((group) => (
          <section key={group.label} aria-label={group.label}>
            <p className="theme-text-secondary mb-2 px-3 text-[10px] font-bold tracking-[0.18em] opacity-70">{group.label}</p>
            <div className="space-y-1">
              {group.items.map((item) => {
                const isActive = currentPath === item.href || (item.href !== '/admin' && currentPath.startsWith(`${item.href}/`))
                return (
                  <a
                    key={item.href}
                    href={item.href}
                    onClick={onNavigate}
                    className={`admin-nav-link group relative flex h-11 items-center gap-3 rounded-xl px-2.5 text-sm font-medium transition-all duration-200 ${isActive ? 'admin-nav-active' : 'theme-text-secondary theme-hover'}`}
                    aria-current={isActive ? 'page' : undefined}
                  >
                    {isActive ? <span className="admin-active-rail absolute -left-3 top-2 h-7 w-1 rounded-r-full" aria-hidden="true" /> : null}
                    <span className={`admin-nav-icon flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-all duration-200 ${isActive ? 'is-active' : ''}`}>
                      <span className="h-[18px] w-[18px]"><NavIcon name={item.icon} /></span>
                    </span>
                    <span className="truncate">{item.label}</span>
                  </a>
                )
              })}
            </div>
          </section>
        ))}
      </div>
    </nav>
  )
}

function SidebarFooter({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <div className="theme-border border-t p-3">
      <div className="admin-runtime-card mb-2 flex items-center gap-3 rounded-xl border px-3 py-2.5">
        <span className="relative flex h-2.5 w-2.5 shrink-0">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-40" />
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
        </span>
        <span className="min-w-0">
          <span className="theme-text block truncate text-[11px] font-semibold">Cloudflare Workers</span>
          <span className="theme-text-secondary mt-0.5 block text-[10px]">边缘控制中心</span>
        </span>
      </div>
      <a href="/" onClick={onNavigate} className="theme-text-secondary theme-hover flex h-10 items-center gap-3 rounded-xl px-2.5 text-sm font-medium transition-colors">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg">
          <svg className="h-[18px] w-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m15 18-6-6 6-6" /><path d="M9 12h11" /></svg>
        </span>
        <span>返回前台</span>
      </a>
    </div>
  )
}

export default function AdminSidebar({ mobileOpen, onMobileClose }: AdminSidebarProps) {
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
      {mobileOpen ? (
        <div className="fixed inset-0 z-[70] md:hidden">
          <button type="button" className="absolute inset-0 bg-slate-950/55 backdrop-blur-[2px]" onClick={onMobileClose} aria-label="关闭管理导航" />
          <aside className="admin-sidebar-surface theme-border relative flex h-full w-[min(19rem,88vw)] flex-col rounded-r-2xl border-r shadow-2xl" aria-label="管理导航">
            <div className="theme-border flex h-[76px] shrink-0 items-center justify-between border-b px-4">
              <Brand />
              <button type="button" onClick={onMobileClose} className="theme-text-secondary theme-hover flex h-9 w-9 items-center justify-center rounded-xl" aria-label="关闭管理导航">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <Navigation currentPath={currentPath} onNavigate={onMobileClose} />
            <SidebarFooter onNavigate={onMobileClose} />
          </aside>
        </div>
      ) : null}

      <aside className="admin-sidebar-surface theme-border relative z-30 hidden w-64 shrink-0 flex-col border-r shadow-[8px_0_30px_rgba(15,23,42,0.035)] md:flex" aria-label="管理导航">
        <div className="theme-border flex h-[76px] shrink-0 items-center border-b px-4">
          <Brand />
        </div>
        <Navigation currentPath={currentPath} />
        <SidebarFooter />
      </aside>
    </>
  )
}
