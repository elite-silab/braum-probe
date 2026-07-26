import type { Metadata } from 'next'
import HistoryViewer from '../../../components/HistoryViewer'

export const metadata: Metadata = { title: '历史数据' }

export default function HistoryPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <h1 className="mb-4 text-3xl font-bold text-slate-900 dark:text-white">历史数据</h1>
      <p className="mb-8 text-slate-500 dark:text-slate-400">查看各 VPS Agent 在节点本地执行的 HTTP/DNS 探测记录</p>
      <HistoryViewer />
    </div>
  )
}
