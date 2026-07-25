import { describe, expect, it } from 'vitest'
import { parsePublicHttpUrl } from './outbound'

describe('parsePublicHttpUrl', () => {
  it.each([
    'http://127.0.0.1/admin',
    'http://10.0.0.1',
    'http://169.254.169.254/latest/meta-data',
    'http://192.168.1.1',
    'http://[::1]/',
    'http://service.internal/',
    'file:///etc/passwd',
    'javascript:alert(1)',
  ])('拒绝私网或非 HTTP 地址 %s', (url) => {
    expect(parsePublicHttpUrl(url)).toBeNull()
  })

  it.each([
    'https://example.com/health',
    'http://1.1.1.1/',
    'https://sub.example.org:8443/path',
  ])('接受公网 HTTP(S) 地址 %s', (url) => {
    expect(parsePublicHttpUrl(url)?.toString()).toBe(url)
  })

  it('拒绝 URL 中的明文账号凭据', () => {
    expect(parsePublicHttpUrl('https://user:password@example.com/')).toBeNull()
  })
})
