export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-md rounded-3xl border border-slate-200/80 bg-white p-8 text-center shadow-sm dark:border-slate-700/80 dark:bg-slate-900 sm:p-10">
        <p className="font-mono text-sm font-semibold tracking-[0.24em] text-brand-600 dark:text-brand-400">404</p>
        <h1 className="mt-4 text-2xl font-bold tracking-tight text-slate-950 dark:text-white">这里没有你要找的页面</h1>
        <p className="mt-3 text-sm leading-6 text-slate-500 dark:text-slate-400">页面可能已经移动、删除，或者链接地址有误。</p>
        <a href="/" className="mt-6 inline-flex rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-brand-700">返回状态总览</a>
      </div>
    </main>
  )
}
