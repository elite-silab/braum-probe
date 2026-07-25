// Braum 布隆 CF 探针 — HTTP 探测器测试

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { httpProbe } from './http'

// Mock global fetch
const mockFetch = vi.fn()

beforeEach(() => {
  mockFetch.mockReset()
  vi.stubGlobal('fetch', mockFetch)
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('httpProbe', () => {
  it('成功的 HTTP 探测（状态码匹配）', async () => {
    mockFetch.mockResolvedValueOnce({
      status: 200,
      ok: true,
    })

    const result = await httpProbe('https://example.com', 5000, 200)
    expect(result.success).toBe(true)
    expect(result.status_code).toBe(200)
    expect(result.latency_ms).toBeGreaterThanOrEqual(0)
    expect(result.dns_time_ms).toBeGreaterThanOrEqual(0)
    expect(result.error_message).toBeNull()
  })

  it('状态码不匹配 → success=false', async () => {
    mockFetch.mockResolvedValueOnce({
      status: 500,
      ok: false,
    })

    const result = await httpProbe('https://example.com', 5000, 200)
    expect(result.success).toBe(false)
    expect(result.status_code).toBe(500)
    expect(result.error_message).toContain('Expected status 200, got 500')
  })

  it('404 响应但期望 200 → success=false', async () => {
    mockFetch.mockResolvedValueOnce({
      status: 404,
      ok: false,
    })

    const result = await httpProbe('https://example.com/notfound', 5000, 200)
    expect(result.success).toBe(false)
    expect(result.status_code).toBe(404)
  })

  it('请求超时 → success=false', async () => {
    mockFetch.mockImplementationOnce(() => {
      const error = new Error('The operation was aborted')
      error.name = 'AbortError'
      return Promise.reject(error)
    })

    const result = await httpProbe('https://slow.example.com', 1000, 200)
    expect(result.success).toBe(false)
    expect(result.latency_ms).toBeNull()
    expect(result.status_code).toBeNull()
    expect(result.error_message).toContain('Timeout')
  })

  it('网络错误 → success=false', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Connection refused'))

    const result = await httpProbe('https://down.example.com', 5000, 200)
    expect(result.success).toBe(false)
    expect(result.latency_ms).toBeNull()
    expect(result.status_code).toBeNull()
    expect(result.error_message).toBe('Connection refused')
  })

  it('应传递正确的请求参数', async () => {
    mockFetch.mockResolvedValueOnce({ status: 200 })

    await httpProbe('https://example.com/api', 3000, 200)

    expect(mockFetch).toHaveBeenCalledWith(
      'https://example.com/api',
      expect.objectContaining({
        method: 'GET',
        redirect: 'manual',
        headers: { 'User-Agent': 'Braum-Probe/1.0' },
      })
    )
  })

  it('拒绝重定向到私网地址', async () => {
    mockFetch.mockResolvedValueOnce({
      status: 302,
      headers: { get: () => 'http://127.0.0.1/admin' },
    })

    const result = await httpProbe('https://example.com/redirect', 5000, 200)
    expect(result.success).toBe(false)
    expect(result.error_message).toContain('Unsafe redirect')
    expect(mockFetch).toHaveBeenCalledTimes(1)
  })

  it('DNS 时间估算为总时间的约 15%', async () => {
    mockFetch.mockResolvedValueOnce({ status: 200 })

    const result = await httpProbe('https://example.com', 5000, 200)
    if (result.latency_ms && result.dns_time_ms) {
      expect(Math.abs(result.dns_time_ms - result.latency_ms * 0.15)).toBeLessThanOrEqual(0.01)
    }
  })
})
