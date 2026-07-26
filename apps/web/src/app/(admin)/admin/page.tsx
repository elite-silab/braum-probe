import AdminDashboard from '../../../components/admin/AdminDashboard'

export default function AdminPage() {
  return <><PageHeader title="控制台" description="VPS Agent、探测任务与事件状态" /><AdminDashboard /></>
}

function PageHeader({ title, description }: { title: string; description: string }) {
  return <div className="mb-6"><h1 className="text-2xl font-bold text-slate-900 dark:text-white">{title}</h1><p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{description}</p></div>
}
