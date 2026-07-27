import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import '../styles/global.css'

export const metadata: Metadata = {
  title: {
    default: 'Braum 布隆探针',
    template: '%s — Braum 探针',
  },
  description: 'Braum 布隆探针 — 轻量服务器资源与网络状态监控',
  icons: { icon: '/favicon.svg' },
}

const themeInit = `
  try {
    const savedTheme = localStorage.getItem('braum-theme') || 'default';
    const isDark = localStorage.getItem('braum-dark') === 'true';
    if (savedTheme !== 'default') document.documentElement.setAttribute('data-theme', savedTheme);
    if (isDark || savedTheme === 'hoshizora') document.documentElement.classList.add('dark');
  } catch {}
`

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="zh-CN" className="h-full scroll-smooth" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInit }} />
      </head>
      <body className="min-h-full">{children}</body>
    </html>
  )
}
