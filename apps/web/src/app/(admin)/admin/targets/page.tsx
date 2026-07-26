import TargetManager from '../../../../components/admin/TargetManager'

export default function TargetsPage() {
  return <><Header /><TargetManager /></>
}

function Header() {
  return <div className="mb-6"><h1 className="text-2xl font-bold text-slate-900 dark:text-white">监控目标</h1><p className="mt-1 text-sm text-slate-500 dark:text-slate-400">管理被探测的目标地址和分组</p></div>
}
