import IncidentManager from '../../../../components/admin/IncidentManager'

export default function IncidentsAdminPage() {
  return <><Header /><IncidentManager /></>
}

function Header() {
  return <div className="mb-6"><h1 className="text-2xl font-bold text-slate-900 dark:text-white">公告管理</h1><p className="mt-1 text-sm text-slate-500 dark:text-slate-400">发布和管理系统故障公告与维护通知</p></div>
}
