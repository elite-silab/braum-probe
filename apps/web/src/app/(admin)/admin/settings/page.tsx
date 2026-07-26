import SettingsForm from '../../../../components/admin/SettingsForm'

export default function SettingsPage() {
  return <><Header /><SettingsForm /></>
}

function Header() {
  return <div className="mb-6"><h1 className="text-2xl font-bold text-slate-900 dark:text-white">系统设置</h1><p className="mt-1 text-sm text-slate-500 dark:text-slate-400">配置系统全局参数</p></div>
}
