import type { Metadata } from 'next'
import type { ReactNode } from 'react'

export const metadata: Metadata = {
  title: '管理后台登录',
  description: '登录 Braum 布隆探针管理后台',
}

export default function LoginLayout({ children }: Readonly<{ children: ReactNode }>) {
  return children
}
