// Braum 布隆 CF 探针 — 弹窗组件

interface ModalProps {
  open: boolean
  title: string
  onClose: () => void
  children: React.ReactNode
  onConfirm?: () => void
  confirmText?: string
  confirmDanger?: boolean
  confirmDisabled?: boolean
  closeOnConfirm?: boolean
}

export default function Modal({
  open,
  title,
  onClose,
  children,
  onConfirm,
  confirmText,
  confirmDanger,
  confirmDisabled = false,
  closeOnConfirm = true,
}: ModalProps) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="fixed inset-0 bg-black/50" />
      <div
        className="relative z-10 max-h-[calc(100dvh-2rem)] w-full max-w-lg overflow-y-auto rounded-xl bg-white p-4 shadow-2xl dark:bg-slate-800 sm:p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <h3 className="min-w-0 break-words text-lg font-semibold text-slate-900 dark:text-white">{title}</h3>
          <button onClick={onClose} className="shrink-0 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300" aria-label="关闭弹窗">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="text-sm text-slate-600 dark:text-slate-300">{children}</div>

        {onConfirm && (
          <div className="mt-6 flex flex-wrap justify-end gap-3">
            <button
              onClick={onClose}
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm hover:bg-slate-50 dark:border-slate-600 dark:hover:bg-slate-700"
            >
              取消
            </button>
            <button
              onClick={() => {
                onConfirm()
                if (closeOnConfirm) onClose()
              }}
              disabled={confirmDisabled}
              className={`rounded-lg px-4 py-2 text-sm text-white disabled:cursor-not-allowed disabled:opacity-50 ${
                confirmDanger
                  ? 'bg-red-600 hover:bg-red-700'
                  : 'bg-brand-600 hover:bg-brand-700'
              }`}
            >
              {confirmText || '确认'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
