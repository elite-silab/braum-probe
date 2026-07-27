import type { Metadata } from 'next'
import HistoryViewer from '../../../components/HistoryViewer'

export const metadata: Metadata = { title: '网络记录' }

export default function HistoryPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <header className="mb-8 max-w-2xl">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-600 dark:text-brand-400">Network history</p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight text-slate-950 dark:text-white sm:text-4xl">网络记录</h1>
        <p className="mt-3 text-sm leading-6 text-slate-500 dark:text-slate-400 sm:text-base">
          查看每台服务器对网站与 DNS 的检查结果，快速定位失败时间和网络延迟。
        </p>
      </header>
      <HistoryViewer />
    </div>
  )
}
