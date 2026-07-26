'use client'

import type { ReactNode } from 'react'
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import ThemeSwitcher from '../ThemeSwitcher'
import AdminSidebar from './AdminSidebar'

interface StoredUser {
  name?: string
  email?: string
}

export default function AdminShell({ children }: { children: ReactNode }) {
  const router = useRouter()
  const menuRef = useRef<HTMLDivElement>(null)
  const [ready, setReady] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [user, setUser] = useState<StoredUser>({})

  useEffect(() => {
    if (!localStorage.getItem('token')) {
      router.replace('/admin/login')
      return
    }
    try {
      setUser(JSON.parse(localStorage.getItem('user') || '{}'))
    } catch {
      setUser({})
    }
    setReady(true)
  }, [router])

  useEffect(() => {
    const close = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [])

  const logout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('refresh_token')
    localStorage.removeItem('user')
    router.replace('/admin/login')
  }

  if (!ready) {
    return <div className="flex h-screen items-center justify-center theme-text-secondary">正在进入管理后台…</div>
  }

  const name = user.name || 'Admin'
  const email = user.email || 'admin@braum.local'

  return (
    <div className="flex h-screen" style={{ backgroundColor: 'var(--surface-body)' }}>
      <AdminSidebar />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="theme-header flex h-14 shrink-0 items-center justify-between border-b px-4 sm:px-6">
          <a href="/admin" className="theme-text-secondary flex items-center gap-2 text-sm font-medium hover:opacity-80">
            <img src="/logo-icon.svg" alt="Braum" className="h-6 w-6" />
            管理后台
          </a>
          <div className="flex items-center gap-3">
            <ThemeSwitcher />
            <div className="relative" ref={menuRef}>
              <button
                type="button"
                onClick={() => setMenuOpen((value) => !value)}
                className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full text-sm font-medium text-white transition-transform hover:scale-105"
                style={{ backgroundColor: 'var(--theme-primary)' }}
                aria-label="用户菜单"
                aria-expanded={menuOpen}
              >
                {name.charAt(0).toUpperCase()}
              </button>
              {menuOpen && (
                <div className="absolute right-0 top-10 z-50 w-56 overflow-hidden rounded-xl border shadow-lg theme-card theme-border">
                  <div className="theme-border border-b px-4 py-3">
                    <p className="theme-text text-sm font-medium">{name}</p>
                    <p className="theme-text-secondary mt-0.5 text-xs">{email}</p>
                  </div>
                  <div className="p-1">
                    <a href="/" className="theme-text theme-hover flex items-center gap-2 rounded-lg px-3 py-2 text-sm">← 返回前台</a>
                    <button type="button" onClick={logout} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20">退出登录</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto p-4 sm:p-6">{children}</main>
      </div>
    </div>
  )
}
