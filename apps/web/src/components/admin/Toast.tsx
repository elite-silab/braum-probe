'use client'

// Braum 布隆 CF 探针 — Toast 通知组件
import { useState, useEffect, useCallback } from 'react'

interface Toast {
  id: string
  message: string
  type: 'success' | 'error' | 'info'
}

let toastListeners: ((toast: Toast) => void)[] = []

export function showToast(message: string, type: 'success' | 'error' | 'info' = 'info') {
  const toast: Toast = { id: crypto.randomUUID(), message, type }
  toastListeners.forEach((fn) => fn(toast))
}

export default function ToastContainer() {
  const [toasts, setToasts] = useState<Toast[]>([])

  const addToast = useCallback((toast: Toast) => {
    setToasts((prev) => [...prev, toast])
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== toast.id))
    }, 4000)
  }, [])

  useEffect(() => {
    toastListeners.push(addToast)
    return () => {
      toastListeners = toastListeners.filter((fn) => fn !== addToast)
    }
  }, [addToast])

  if (toasts.length === 0) return null

  return (
    <div className="fixed inset-x-4 top-4 z-[100] space-y-2 sm:left-auto sm:w-80">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`break-words rounded-lg px-4 py-3 text-sm text-white shadow-lg transition-all ${
            toast.type === 'success'
              ? 'bg-emerald-600'
              : toast.type === 'error'
                ? 'bg-red-600'
                : 'bg-brand-600'
          }`}
        >
          {toast.message}
        </div>
      ))}
    </div>
  )
}
