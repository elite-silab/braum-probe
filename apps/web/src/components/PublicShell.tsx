'use client'

import type { ReactNode } from 'react'
import { usePathname } from 'next/navigation'
import ThemeSwitcher from './ThemeSwitcher'

const navItems = [
  { href: '/', label: '总览', icon: 'overview', match: (path: string) => path === '/' || path.startsWith('/node/') },
  { href: '/history', label: '记录', icon: 'history', match: (path: string) => path.startsWith('/history') },
  { href: '/incidents', label: '公告', icon: 'incidents', match: (path: string) => path.startsWith('/incidents') },
]

export default function PublicShell({ children }: { children: ReactNode }) {
  const pathname = usePathname() || '/'

  return (
    <div className="flex min-h-screen flex-col pb-16 sm:pb-0">
      <header className="theme-header sticky top-0 z-50 border-b">
        <nav className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-8">
            <a href="/" className="theme-text flex items-center gap-2.5 text-lg font-bold" aria-label="Braum 服务器状态首页">
              <span className="rounded-xl bg-brand-50 p-1 ring-1 ring-brand-100 dark:bg-brand-950/50 dark:ring-brand-900">
                <img src="/logo-icon.svg" alt="" className="h-7 w-7" />
              </span>
              <span>Braum</span>
            </a>
            <div className="hidden items-center gap-1 sm:flex">
              {navItems.map((item) => (
                <a
                  key={item.href}
                  href={item.href}
                  aria-current={item.match(pathname) ? 'page' : undefined}
                  className={`rounded-lg px-3 py-2 text-sm transition-colors ${
                    item.match(pathname)
                      ? 'bg-brand-50 font-semibold text-brand-700 dark:bg-brand-900/20 dark:text-brand-400'
                      : 'theme-text-secondary hover:bg-slate-100 hover:opacity-80 dark:hover:bg-slate-800'
                  }`}
                >
                  {item.label}
                </a>
              ))}
            </div>
          </div>
          <ThemeSwitcher />
        </nav>
      </header>

      <main className="flex-1">{children}</main>

      <footer className="theme-border hidden border-t py-8 sm:block">
        <div className="theme-text-secondary mx-auto max-w-7xl px-4 text-center text-sm sm:px-6 lg:px-8">
          <p>© {new Date().getFullYear()} Braum 布隆探针 · 轻量服务器监控</p>
        </div>
      </footer>

      <nav className="theme-header safe-area-bottom fixed inset-x-0 bottom-0 z-50 border-t sm:hidden">
        <div className="flex h-16 items-center justify-around">
          {navItems.map((item) => (
            <a
              key={item.href}
              href={item.href}
              aria-current={item.match(pathname) ? 'page' : undefined}
              className={`flex min-w-14 flex-col items-center justify-center gap-0.5 px-3 py-1 text-xs transition-colors ${
                item.match(pathname) ? 'font-semibold text-brand-600 dark:text-brand-400' : 'theme-text-secondary'
              }`}
            >
              <NavIcon name={item.icon} />
              <span>{item.label}</span>
            </a>
          ))}
        </div>
      </nav>
    </div>
  )
}

function NavIcon({ name }: { name: string }) {
  const path = name === 'overview'
    ? <><rect x="3" y="3" width="7" height="7" rx="2" /><rect x="14" y="3" width="7" height="7" rx="2" /><rect x="3" y="14" width="7" height="7" rx="2" /><rect x="14" y="14" width="7" height="7" rx="2" /></>
    : name === 'history'
      ? <><path d="M4 19V9" /><path d="M10 19V5" /><path d="M16 19v-7" /><path d="M22 19H2" /></>
      : <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" /><path d="M10 21h4" /></>

  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {path}
    </svg>
  )
}
