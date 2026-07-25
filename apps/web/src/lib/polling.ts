// Braum 布隆 CF 探针 — 客户端轮询工具

interface PollerOptions {
  interval?: number // 轮询间隔（毫秒）
  enabled?: boolean
  onSuccess?: (data: unknown) => void
  onError?: (error: Error) => void
}

/**
 * 通用轮询函数
 * 在客户端自动定期调用 API 并更新数据
 */
export function createPoller<T>(
  fetchFn: () => Promise<T>,
  options: PollerOptions = {}
): {
  start: () => void
  stop: () => void
  isActive: () => boolean
} {
  const { interval = 30000, enabled = true } = options
  let timer: ReturnType<typeof setInterval> | null = null

  async function poll() {
    try {
      const data = await fetchFn()
      options.onSuccess?.(data)
    } catch (error) {
      options.onError?.(error instanceof Error ? error : new Error(String(error)))
    }
  }

  function start() {
    if (timer) return
    poll() // 立即执行一次
    timer = setInterval(poll, interval)
  }

  function stop() {
    if (timer) {
      clearInterval(timer)
      timer = null
    }
  }

  function isActive() {
    return timer !== null
  }

  if (enabled) {
    start()
  }

  // 页面隐藏时暂停轮询
  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        stop()
      } else if (enabled) {
        start()
      }
    })
  }

  return { start, stop, isActive }
}
