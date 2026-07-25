// Braum 布隆 CF 探针 — DNS 探测器测试

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { dnsProbe } from './dns'

const mockFetch = vi.fn()

beforeEach(() => {
  vi.stubGlobal('fetch', mockFetch)
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('dnsProbe', () => {
  it('成功解析域名（有 A 记录）', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        Answer: [
          { data: '93.184.216.34', type: 1 },
          { data: '93.184.216.35', type: 1 },
        ],
      }),
    })

    const result = await dnsProbe('example.com', 5000)
    expect(result.success).toBe(true)
    expect(result.resolved_ips).toEqual(['93.184.216.34', '93.184.216.35'])
    expect(result.latency_ms).toBeGreaterThanOrEqual(0)
    expect(result.error_message).toBeNull()
  })

  it('无 A 记录 → success=false', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ Answer: [] }),
    })

    const result = await dnsProbe('no-records.example.com', 5000)
    expect(result.success).toBe(false)
    expect(result.resolved_ips).toEqual([])
    expect(result.error_message).toBe('No A records found')
  })

  it('过滤非 A 记录', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        Answer: [
          { data: '93.184.216.34', type: 1 },   // A record
          { data: '::1', type: 28 },              // AAAA record (应被过滤)
          { data: 'mail.example.com', type: 15 }, // MX record (应被过滤)
        ],
      }),
    })

    const result = await dnsProbe('example.com', 5000)
    expect(result.success).toBe(true)
    expect(result.resolved_ips).toEqual(['93.184.216.34'])
  })

  it('DNS 服务返回错误 → success=false', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
    })

    const result = await dnsProbe('error.com', 5000)
    expect(result.success).toBe(false)
    expect(result.latency_ms).toBeNull()
    expect(result.error_message).toContain('DNS query failed')
  })

  it('DNS 查询超时 → success=false', async () => {
    mockFetch.mockImplementationOnce(() => {
      const error = new Error('The operation was aborted')
      error.name = 'AbortError'
      return Promise.reject(error)
    })

    const result = await dnsProbe('slow-domain.com', 1000)
    expect(result.success).toBe(false)
    expect(result.latency_ms).toBeNull()
    expect(result.error_message).toContain('DNS timeout')
  })

  it('网络错误 → success=false', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network unreachable'))

    const result = await dnsProbe('any-domain.com', 5000)
    expect(result.success).toBe(false)
    expect(result.error_message).toBe('Network unreachable')
  })

  it('使用 Cloudflare DoH API', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ Answer: [{ data: '1.2.3.4', type: 1 }] }),
    })

    await dnsProbe('test.com', 5000)

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('cloudflare-dns.com/dns-query?name=test.com'),
      expect.objectContaining({
        headers: expect.objectContaining({
          'Accept': 'application/dns-json',
          'User-Agent': 'Braum-Probe/1.0',
        }),
      })
    )
  })

  it('Answer 字段为空数组时 success=false', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({}), // 无 Answer 字段
    })

    const result = await dnsProbe('empty.com', 5000)
    expect(result.success).toBe(false)
    expect(result.resolved_ips).toEqual([])
  })
})
