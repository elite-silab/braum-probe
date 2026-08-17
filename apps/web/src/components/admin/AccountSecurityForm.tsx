'use client'

import { useEffect, useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { adminApi } from '../../lib/api'
import FormField from './FormField'

interface AccountInfo {
  name: string
  email: string
  role: string
}

const ROLE_LABELS: Record<string, string> = {
  owner: '所有者',
  admin: '管理员',
  viewer: '只读用户',
}

export default function AccountSecurityForm() {
  const router = useRouter()
  const [account, setAccount] = useState<AccountInfo | null>(null)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    adminApi.me().then((result) => {
      if (result.success && result.data) {
        const nextAccount = {
          name: result.data.name,
          email: result.data.email,
          role: result.data.role,
        }
        setAccount(nextAccount)
        localStorage.setItem('user', JSON.stringify(result.data))
      }
    })
  }, [])

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')

    if (newPassword.length < 12 || newPassword.length > 128) {
      setError('新密码长度必须为 12–128 个字符')
      return
    }
    if (newPassword !== confirmPassword) {
      setError('两次输入的新密码不一致')
      return
    }
    if (currentPassword === newPassword) {
      setError('新密码不能与当前密码相同')
      return
    }

    setSubmitting(true)
    const result = await adminApi.changePassword(currentPassword, newPassword)
    if (!result.success) {
      setError(result.error || '密码修改失败，请稍后重试')
      setSubmitting(false)
      return
    }

    sessionStorage.setItem('braum-login-message', '密码已修改，请使用新密码重新登录')
    localStorage.removeItem('token')
    localStorage.removeItem('refresh_token')
    localStorage.removeItem('user')
    router.replace('/admin/login')
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
      <form onSubmit={submit} className="theme-card theme-border rounded-xl border p-4 sm:p-6">
        <div className="theme-border mb-6 border-b pb-5">
          <h2 className="theme-text text-lg font-semibold">账号安全</h2>
          <p className="theme-text-secondary mt-1 text-sm">修改当前账号的登录密码；提交前需要验证当前密码。</p>
        </div>

        {account && (
          <div className="theme-border mb-6 rounded-lg border bg-slate-50 p-4 dark:bg-slate-900/30">
            <p className="theme-text text-sm font-medium">{account.name || '管理员'}</p>
            <p className="theme-text-secondary mt-1 break-all text-xs">{account.email} · {ROLE_LABELS[account.role] || account.role}</p>
          </div>
        )}

        <div className="space-y-4">
          <FormField
            label="当前密码"
            type="password"
            autoComplete="current-password"
            required
            maxLength={128}
            value={currentPassword}
            onChange={(event) => setCurrentPassword(event.target.value)}
            placeholder="请输入当前登录密码"
          />
          <FormField
            label="新密码"
            type="password"
            autoComplete="new-password"
            required
            minLength={12}
            maxLength={128}
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
            placeholder="请输入 12–128 位新密码"
          />
          <FormField
            label="确认新密码"
            type="password"
            autoComplete="new-password"
            required
            minLength={12}
            maxLength={128}
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            placeholder="请再次输入新密码"
          />
        </div>

        {error && (
          <div role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
            {error}
          </div>
        )}

        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <a href="/admin" className="theme-border theme-text-secondary rounded-lg border px-4 py-2 text-center text-sm font-medium theme-hover">取消</a>
          <button type="submit" disabled={submitting} className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50">
            {submitting ? '正在修改…' : '修改密码'}
          </button>
        </div>
      </form>

      <aside className="theme-card theme-border h-fit rounded-xl border p-4 sm:p-5">
        <h2 className="theme-text text-sm font-semibold">安全建议</h2>
        <ul className="theme-text-secondary mt-3 space-y-3 text-sm">
          <li className="flex gap-2"><span className="text-emerald-500">✓</span><span>使用至少 12 位且不易猜测的密码</span></li>
          <li className="flex gap-2"><span className="text-emerald-500">✓</span><span>不要与其他网站共用同一密码</span></li>
          <li className="flex gap-2"><span className="text-emerald-500">✓</span><span>修改成功后需要重新登录</span></li>
        </ul>
      </aside>
    </div>
  )
}
