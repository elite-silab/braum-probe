import SettingsForm from '../../../../components/admin/SettingsForm'
import AccountSecurityForm from '../../../../components/admin/AccountSecurityForm'

export default function SettingsPage() {
  return <><Header /><SettingsForm /><AccountSecurityForm /></>
}

function Header() {
  return <div className="mb-6"><h1 className="text-2xl font-bold text-slate-900 dark:text-white">系统设置</h1><p className="mt-1 text-sm text-slate-500 dark:text-slate-400">配置站点外观、全局参数与账号安全</p></div>
}
