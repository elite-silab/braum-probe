// Braum 布隆 CF 探针 — 管理后台侧边栏
import { useState, useEffect } from 'react'

interface NavItem {
  label: string
  href: string
  icon: string
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

export default function AdminSidebar() {
  const [collapsed, setCollapsed] = useState(false)
  const [currentPath, setCurrentPath] = useState('')

  useEffect(() => {
    setCurrentPath(window.location.pathname)
  }, [])

  return (
    <aside
      className={`theme-sidebar flex flex-col border-r transition-all duration-200 ${
        collapsed ? 'w-16' : 'w-60'
      }`}
    >
      {/* Logo */}
      <div className="theme-border flex h-14 items-center justify-between px-4 border-b">
        {!collapsed ? (
          <span className="flex items-center gap-2">
            <img src="/logo-icon.svg" alt="Braum" className="h-7 w-7" />
            <span className="text-lg font-bold theme-text">Braum</span>
          </span>
        ) : (
          <img src="/logo-icon.svg" alt="B" className="h-6 w-6 mx-auto" />
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="rounded p-1 theme-text-secondary hover:opacity-80"
        >
          {collapsed ? '▶' : '◀'}
        </button>
      </div>

      {/* 导航 */}
      <nav className="flex-1 space-y-1 p-3">
        {navItems.map((item) => {
          const isActive = currentPath === item.href
          return (
            <a
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
                isActive
                  ? 'theme-active'
                  : 'theme-text-secondary theme-hover'
              }`}
              title={collapsed ? item.label : undefined}
            >
              <span className="text-base">{item.icon}</span>
              {!collapsed && <span>{item.label}</span>}
            </a>
          )
        })}
      </nav>

      {/* 返回前台 */}
      <div className="theme-border border-t p-3">
        <a
          href="/"
          className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm theme-text-secondary theme-hover"
        >
          <span>←</span>
          {!collapsed && <span>返回前台</span>}
        </a>
      </div>
    </aside>
  )
}
