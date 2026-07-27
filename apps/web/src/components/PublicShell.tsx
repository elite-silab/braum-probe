'use client'

import type { ReactNode } from 'react'
import { usePathname } from 'next/navigation'
import ThemeSwitcher from './ThemeSwitcher'

const navItems = [
  { href: '/', label: '总览', icon: '📊', match: (path: string) => path === '/' },
  { href: '/history', label: '历史', icon: '📈', match: (path: string) => path.startsWith('/history') },
  { href: '/incidents', label: '公告', icon: '📢', match: (path: string) => path.startsWith('/incidents') },
]

export default function PublicShell({ children }: { children: ReactNode }) {
  const pathname = usePathname() || '/'

  return (
    <div className="flex min-h-screen flex-col pb-16 sm:pb-0">
      <header className="theme-header sticky top-0 z-50 border-b">
        <nav className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-8">
            <a href="/" className="theme-text flex items-center gap-2 text-lg font-bold">
              <img src="/logo-icon.svg" alt="Braum" className="h-8 w-8" />
              Braum
            </a>
            <div className="hidden items-center gap-1 sm:flex">
              {navItems.map((item) => (
                <a
                  key={item.href}
                  href={item.href}
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
          <p>© {new Date().getFullYear()} Braum 布隆探针 · Powered by Cloudflare Workers</p>
        </div>
      </footer>

      <nav className="theme-header safe-area-bottom fixed inset-x-0 bottom-0 z-50 border-t sm:hidden">
        <div className="flex h-16 items-center justify-around">
          {navItems.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className={`flex min-w-14 flex-col items-center justify-center gap-0.5 px-3 py-1 text-xs transition-colors ${
                item.match(pathname) ? 'font-semibold text-brand-600 dark:text-brand-400' : 'theme-text-secondary'
              }`}
            >
              <span className="text-lg leading-none">{item.icon}</span>
              <span>{item.label}</span>
            </a>
          ))}
        </div>
      </nav>
    </div>
  )
}
