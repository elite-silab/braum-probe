// Braum 布隆 CF 探针 — 分页器组件

interface PaginationProps {
  page: number
  totalPages: number
  total: number
  onPageChange: (page: number) => void
}

export default function Pagination({ page, totalPages, total, onPageChange }: PaginationProps) {
  if (totalPages <= 1) return null

  return (
    <div className="mt-4 flex items-center justify-between px-4">
      <span className="text-sm text-slate-500 dark:text-slate-400">
        第 {page}/{totalPages} 页，共 {total} 条
      </span>
      <div className="flex gap-2">
        <button
          onClick={() => onPageChange(Math.max(1, page - 1))}
          disabled={page <= 1}
          className="rounded-lg border border-slate-200 px-3 py-1 text-sm hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:hover:bg-slate-800"
        >
          上一页
        </button>
        <button
          onClick={() => onPageChange(Math.min(totalPages, page + 1))}
          disabled={page >= totalPages}
          className="rounded-lg border border-slate-200 px-3 py-1 text-sm hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:hover:bg-slate-800"
        >
          下一页
        </button>
      </div>
    </div>
  )
}
