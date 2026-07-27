import type { Metadata } from 'next'
import Dashboard from '../../components/Dashboard'

export const metadata: Metadata = { title: 'Braum 布隆探针 — 服务器状态与网络监控' }

export default function HomePage() {
  return <Dashboard />
}
