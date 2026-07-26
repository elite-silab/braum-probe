import AlertManager from '../../../../components/admin/AlertManager'

export default function AlertsPage() {
  return <><Header /><AlertManager /></>
}

function Header() {
  return <div className="mb-6"><h1 className="text-2xl font-bold text-slate-900 dark:text-white">告警规则</h1><p className="mt-1 text-sm text-slate-500 dark:text-slate-400">配置资源阈值、探测告警与通知渠道</p></div>
}
