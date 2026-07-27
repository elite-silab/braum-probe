'use client'

// Braum 布隆 CF 探针 — 通用数据表格组件
import { useState } from 'react'

interface Column {
  key: string
  label: string
  render?: (value: unknown, row: Record<string, unknown>) => React.ReactNode
}

interface DataTableProps {
  columns: Column[]
  data: Record<string, unknown>[]
  loading?: boolean
  emptyText?: string
  onRowClick?: (row: Record<string, unknown>) => void
}

export default function DataTable({ columns, data, loading, emptyText = '暂无数据', onRowClick }: DataTableProps) {
  const [page, setPage] = useState(1)
  const pageSize = 10
  const totalPages = Math.ceil(data.length / pageSize)
  const pagedData = data.slice((page - 1) * pageSize, page * pageSize)

  if (loading) {
    return (
      <div className="flex h-48 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-500 border-t-transparent" />
      </div>
    )
  }

  if (data.length === 0) {
    return (
      <div className="flex h-48 items-center justify-center text-slate-400 dark:text-slate-500">
        {emptyText}
      </div>
    )
  }

  return (
    <div>
      <div className="divide-y divide-slate-100 dark:divide-slate-700 md:hidden">
        {pagedData.map((row, index) => (
          <div key={index} className="space-y-3 p-4">
            {columns.map((col) => (
              <div key={col.key} className={`flex min-w-0 items-start justify-between gap-4 ${col.key === 'actions' ? 'border-t border-slate-100 pt-3 dark:border-slate-700' : ''}`}>
                <span className="shrink-0 text-xs text-slate-400 dark:text-slate-500">{col.label}</span>
                <div className="min-w-0 max-w-[68%] break-words text-right text-sm text-slate-700 dark:text-slate-300 [&>*]:max-w-full">
                  {col.render ? col.render(row[col.key], row) : String(row[col.key] ?? '--')}
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>

      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-max text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800">
            <tr>
              {columns.map((col) => (
                <th key={col.key} className="px-4 py-3 font-medium text-slate-500 dark:text-slate-400">
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
            {pagedData.map((row, i) => (
              <tr
                key={i}
                className={`hover:bg-slate-50 dark:hover:bg-slate-800/50 ${onRowClick ? 'cursor-pointer' : ''}`}
                onClick={() => onRowClick?.(row)}
              >
                {columns.map((col) => (
                  <td key={col.key} className="px-4 py-3 text-slate-700 dark:text-slate-300">
                    {col.render ? col.render(row[col.key], row) : String(row[col.key] ?? '--')}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 px-2 sm:px-4">
          <span className="text-sm text-slate-500 dark:text-slate-400">
            第 {page}/{totalPages} 页，共 {data.length} 条
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setPage(Math.max(1, page - 1))}
              disabled={page <= 1}
              className="rounded-lg border border-slate-200 px-3 py-1 text-sm hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:hover:bg-slate-800"
            >
              上一页
            </button>
            <button
              onClick={() => setPage(Math.min(totalPages, page + 1))}
              disabled={page >= totalPages}
              className="rounded-lg border border-slate-200 px-3 py-1 text-sm hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:hover:bg-slate-800"
            >
              下一页
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
