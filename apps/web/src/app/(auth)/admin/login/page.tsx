'use client'

import { useEffect, useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { adminApi } from '../../../../lib/api'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (localStorage.getItem('token')) router.replace('/admin')
  }, [router])

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSubmitting(true)
    setError('')

    const result = await adminApi.login(email, password)
    if (result.success && result.data?.access_token) {
      localStorage.setItem('token', result.data.access_token)
      if (result.data.refresh_token) localStorage.setItem('refresh_token', result.data.refresh_token)
      if (result.data.user) localStorage.setItem('user', JSON.stringify(result.data.user))
      router.replace('/admin')
    } else {
      setError(result.error === 'Failed to fetch' ? '无法连接服务，请稍后重试' : result.error || '登录失败')
    }
    setSubmitting(false)
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4" style={{ backgroundColor: 'var(--surface-body)' }}>
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <img src="/logo-icon.svg" alt="Braum" className="mx-auto mb-3 h-16 w-16" />
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Braum 管理后台</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">请登录以继续</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-800">
          <form className="space-y-4" onSubmit={submit}>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
              邮箱
              <input type="email" required value={email} onChange={(event) => setEmail(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-700 dark:text-white" placeholder="owner@example.com" />
            </label>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
              密码
              <input type="password" required value={password} onChange={(event) => setPassword(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-700 dark:text-white" placeholder="请输入密码" />
            </label>
            {error && <div role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">{error}</div>}
            <button type="submit" disabled={submitting} className="w-full rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50">
              {submitting ? '登录中…' : '登录'}
            </button>
          </form>
        </div>
        <p className="mt-4 text-center text-xs text-slate-400 dark:text-slate-500"><a href="/" className="hover:text-slate-600 dark:hover:text-slate-300">← 返回前台</a></p>
      </div>
    </main>
  )
}
