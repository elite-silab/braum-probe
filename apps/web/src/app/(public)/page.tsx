import type { Metadata } from 'next'
import Dashboard from '../../components/Dashboard'

export const metadata: Metadata = { title: 'Braum 布隆探针 — VPS 与网络监测' }

export default function HomePage() {
  return <Dashboard />
}
