// Braum 布隆 CF 探针 — DNS 探测器

export interface DnsProbeResult {
  success: boolean
  latency_ms: number | null
  resolved_ips: string[]
  error_message: string | null
}

/**
 * 执行 DNS over HTTPS 探测
 * 使用 Cloudflare DNS (1.1.1.1) 或 Google DNS (8.8.8.8) 解析域名
 */
export async function dnsProbe(domain: string, timeoutMs: number): Promise<DnsProbeResult> {
  const startTime = performance.now()

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), timeoutMs)

    // 使用 Cloudflare DoH API
    const response = await fetch(`https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(domain)}&type=A`, {
      headers: {
        'Accept': 'application/dns-json',
        'User-Agent': 'Braum-Probe/1.0',
      },
      signal: controller.signal,
    })

    clearTimeout(timeout)

    const endTime = performance.now()
    const latencyMs = Math.round((endTime - startTime) * 100) / 100

    if (!response.ok) {
      return {
        success: false,
        latency_ms: null,
        resolved_ips: [],
        error_message: `DNS query failed with status ${response.status}`,
      }
    }

    const data = await response.json() as { Answer?: Array<{ data: string; type: number }> }
    const ips = (data.Answer || [])
      .filter(a => a.type === 1) // A record
      .map(a => a.data)

    return {
      success: ips.length > 0,
      latency_ms: latencyMs,
      resolved_ips: ips,
      error_message: ips.length > 0 ? null : 'No A records found',
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return {
      success: false,
      latency_ms: null,
      resolved_ips: [],
      error_message: message.includes('aborted') ? `DNS timeout after ${timeoutMs}ms` : message,
    }
  }
}
