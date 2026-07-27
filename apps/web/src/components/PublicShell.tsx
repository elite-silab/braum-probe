'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { usePathname } from 'next/navigation'
import ThemeSwitcher from './ThemeSwitcher'

const navItems = [
  { href: '/', label: '总览', icon: 'overview', match: (path: string) => path === '/' || path.startsWith('/node/') },
  { href: '/history', label: '记录', icon: 'history', match: (path: string) => path.startsWith('/history') },
  { href: '/incidents', label: '公告', icon: 'incidents', match: (path: string) => path.startsWith('/incidents') },
]

export default function PublicShell({ children }: { children: ReactNode }) {
  const pathname = usePathname() || '/'
  const [menuOpen, setMenuOpen] = useState(false)
  const menuButtonRef = useRef<HTMLButtonElement>(null)
  const closeButtonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!menuOpen) return

    const previousOverflow = document.body.style.overflow
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false)
    }

    document.body.style.overflow = 'hidden'
    const focusFrame = window.requestAnimationFrame(() => closeButtonRef.current?.focus())
    window.addEventListener('keydown', closeOnEscape)
    return () => {
      window.cancelAnimationFrame(focusFrame)
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', closeOnEscape)
      menuButtonRef.current?.focus()
    }
  }, [menuOpen])

  return (
    <div className="flex min-h-screen w-full flex-col">
      <header className="theme-header sticky top-0 z-50 border-b">
        <nav className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-8">
            <a href="/" className="theme-text flex items-center gap-2.5 text-lg font-bold" aria-label="Braum 服务器状态首页">
              <span className="rounded-xl bg-brand-50 p-1 ring-1 ring-brand-100 dark:bg-brand-950/50 dark:ring-brand-900">
                <img src="/logo-icon.svg" alt="" className="h-7 w-7" />
              </span>
              <span>Braum</span>
            </a>
            <div className="hidden items-center gap-1 md:flex">
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
          <div className="flex items-center gap-1">
            <ThemeSwitcher />
            <button
              ref={menuButtonRef}
              type="button"
              aria-label="打开导航菜单"
              aria-expanded={menuOpen}
              aria-controls="public-mobile-menu"
              onClick={() => setMenuOpen(true)}
              className="theme-text-secondary flex h-10 w-10 items-center justify-center rounded-xl transition hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-white md:hidden"
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16" /></svg>
            </button>
          </div>
        </nav>
      </header>

      <main className="w-full flex-1">{children}</main>

      <footer className="theme-border mt-auto border-t py-6 sm:py-8">
        <div className="theme-text-secondary mx-auto w-full max-w-7xl px-4 text-center text-xs sm:px-6 sm:text-sm lg:px-8">
          <p>© {new Date().getFullYear()} 布隆探针 · 由 Next.js 与 Cloudflare Workers 驱动</p>
        </div>
      </footer>

      {menuOpen && (
        <div className="fixed inset-0 z-[60] md:hidden">
          <button type="button" aria-label="关闭导航菜单" onClick={() => setMenuOpen(false)} className="absolute inset-y-0 left-0 right-[min(86vw,20rem)] bg-slate-950/40 backdrop-blur-[2px]" />
          <aside id="public-mobile-menu" role="dialog" aria-modal="true" aria-labelledby="public-mobile-menu-title" className="public-mobile-drawer theme-card absolute inset-y-0 right-0 flex w-[min(86vw,20rem)] flex-col border-l shadow-2xl">
            <div className="flex h-16 items-center justify-between border-b border-slate-200/80 px-5 dark:border-slate-700/80">
              <div className="flex items-center gap-2.5">
                <img src="/logo-icon.svg" alt="" className="h-8 w-8" />
                <span id="public-mobile-menu-title" className="font-semibold text-slate-900 dark:text-white">浏览菜单</span>
              </div>
              <button ref={closeButtonRef} type="button" aria-label="关闭菜单" onClick={() => setMenuOpen(false)} className="theme-text-secondary flex h-9 w-9 items-center justify-center rounded-xl transition hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-white">
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" /></svg>
              </button>
            </div>

            <nav className="space-y-2 p-4" aria-label="移动端导航">
              {navItems.map((item) => {
                const active = item.match(pathname)
                const description = item.icon === 'overview' ? '服务器实时状态' : item.icon === 'history' ? '网络检查记录' : '维护与故障进展'
                return (
                  <a
                    key={item.href}
                    href={item.href}
                    aria-current={active ? 'page' : undefined}
                    onClick={() => setMenuOpen(false)}
                    className={`flex items-center gap-3 rounded-2xl border px-4 py-3.5 transition ${active ? 'border-brand-200 bg-brand-50 text-brand-700 dark:border-brand-800 dark:bg-brand-950/40 dark:text-brand-300' : 'border-transparent text-slate-700 hover:border-slate-200 hover:bg-slate-50 dark:text-slate-200 dark:hover:border-slate-700 dark:hover:bg-slate-800'}`}
                  >
                    <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${active ? 'bg-white shadow-sm dark:bg-slate-900' : 'bg-slate-100 dark:bg-slate-800'}`}><NavIcon name={item.icon} /></span>
                    <span className="min-w-0"><strong className="block text-sm font-semibold">{item.label}</strong><small className="mt-0.5 block text-xs font-normal opacity-70">{description}</small></span>
                    <svg viewBox="0 0 24 24" className="ml-auto h-4 w-4 shrink-0 opacity-50" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6" /></svg>
                  </a>
                )
              })}
            </nav>

            <div className="mt-auto border-t border-slate-200/80 px-5 py-5 text-xs leading-5 text-slate-500 dark:border-slate-700/80 dark:text-slate-400">
              轻量、实时的服务器状态与网络监控。
            </div>
          </aside>
        </div>
      )}
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
