// Braum 布隆 CF 探针 — HTTP 探测器

import { parsePublicHttpUrl } from '../utils/outbound'

export interface HttpProbeResult {
  success: boolean
  latency_ms: number | null
  status_code: number | null
  dns_time_ms: number | null
  error_message: string | null
}

/**
 * 执行 HTTP/HTTPS 探测
 * 利用 Workers fetch() 从边缘节点发起请求
 */
export async function httpProbe(url: string, timeoutMs: number, expectedStatus: number): Promise<HttpProbeResult> {
  let dnsTimeMs: number | null = null

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), timeoutMs)

    // 记录探测开始时间
    const fetchStart = performance.now()

    let currentUrl = parsePublicHttpUrl(url)
    if (!currentUrl) throw new Error('Unsafe or invalid probe URL')

    let response: Response | undefined
    try {
      for (let redirects = 0; redirects <= 5; redirects++) {
        response = await fetch(currentUrl.toString(), {
          method: 'GET',
          signal: controller.signal,
          redirect: 'manual',
          headers: {
            'User-Agent': 'Braum-Probe/1.0',
          },
        })

        const location = response.headers?.get('Location')
        if (response.status < 300 || response.status >= 400 || !location) break
        if (redirects === 5) throw new Error('Too many redirects')

        const nextUrl = parsePublicHttpUrl(new URL(location, currentUrl).toString())
        if (!nextUrl) throw new Error('Unsafe redirect target')
        currentUrl = nextUrl
      }
    } finally {
      clearTimeout(timeout)
    }

    if (!response) throw new Error('Probe returned no response')

    const fetchEnd = performance.now()
    const totalMs = Math.round((fetchEnd - fetchStart) * 100) / 100

    // Workers 不提供精确的 DNS 计时，估算为总耗时的 10-20%
    dnsTimeMs = Math.round(totalMs * 0.15 * 100) / 100

    const success = response.status === expectedStatus

    return {
      success,
      latency_ms: totalMs,
      status_code: response.status,
      dns_time_ms: dnsTimeMs,
      error_message: success ? null : `Expected status ${expectedStatus}, got ${response.status}`,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'

    return {
      success: false,
      latency_ms: null,
      status_code: null,
      dns_time_ms: null,
      error_message: message.includes('aborted') ? `Timeout after ${timeoutMs}ms` : message,
    }
  }
}
