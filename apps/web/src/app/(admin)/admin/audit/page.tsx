import AuditLogViewer from '../../../../components/admin/AuditLogViewer'

export default function AuditPage() {
  return <><Header /><AuditLogViewer /></>
}

function Header() {
  return <div className="mb-6"><h1 className="text-2xl font-bold text-slate-900 dark:text-white">审计日志</h1><p className="mt-1 text-sm text-slate-500 dark:text-slate-400">查看所有管理操作记录</p></div>
}
