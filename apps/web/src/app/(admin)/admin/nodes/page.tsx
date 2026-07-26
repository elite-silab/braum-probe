import NodeManager from '../../../../components/admin/NodeManager'

export default function NodesPage() {
  return <><Header /><NodeManager /></>
}

function Header() {
  return <div className="mb-6"><h1 className="text-2xl font-bold text-slate-900 dark:text-white">VPS 节点</h1><p className="mt-1 text-sm text-slate-500 dark:text-slate-400">注册 Agent、关联探测任务并查看心跳状态</p></div>
}
