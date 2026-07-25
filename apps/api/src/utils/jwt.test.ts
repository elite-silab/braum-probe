// Braum 布隆 CF 探针 — JWT 工具函数测试

import { describe, it, expect } from 'vitest'
import { signToken, verifyToken, hashPassword, needsPasswordRehash, verifyPassword } from './jwt'

const SECRET = 'test-jwt-secret-key-for-unit-tests'

describe('signToken + verifyToken', () => {
  it('签发并验证有效 token', async () => {
    const token = await signToken({ sub: 'user-1', role: 'admin' }, SECRET)
    expect(typeof token).toBe('string')
    expect(token.split('.')).toHaveLength(3)

    const payload = await verifyToken(token, SECRET)
    expect(payload).not.toBeNull()
    expect(payload!.sub).toBe('user-1')
    expect(payload!.role).toBe('admin')
  })

  it('payload 自动包含 iat 和 exp', async () => {
    const token = await signToken({ sub: 'u1' }, SECRET, 3600)
    const payload = await verifyToken(token, SECRET)
    expect(payload!.iat).toBeDefined()
    expect(payload!.exp).toBeDefined()
    expect((payload!.exp as number) - (payload!.iat as number)).toBe(3600)
  })

  it('过期 token 验证返回 null', async () => {
    // 签发一个 1 秒过期的 token
    const token = await signToken({ sub: 'u1' }, SECRET, -1)
    const payload = await verifyToken(token, SECRET)
    expect(payload).toBeNull()
  })

  it('错误 secret 验证返回 null', async () => {
    const token = await signToken({ sub: 'u1' }, SECRET)
    const payload = await verifyToken(token, 'wrong-secret')
    expect(payload).toBeNull()
  })

  it('篡改 payload 后验证失败', async () => {
    const token = await signToken({ sub: 'u1', role: 'viewer' }, SECRET)
    const parts = token.split('.')
    // 篡改 payload 中的 role
    const tamperedPayload = btoa(JSON.stringify({ sub: 'u1', role: 'admin', iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 86400 })).replace(/=+$/, '')
    const tamperedToken = `${parts[0]}.${tamperedPayload}.${parts[2]}`
    const payload = await verifyToken(tamperedToken, SECRET)
    expect(payload).toBeNull()
  })

  it('无效格式的 token 返回 null', async () => {
    expect(await verifyToken('not-a-jwt', SECRET)).toBeNull()
    expect(await verifyToken('a.b', SECRET)).toBeNull()
    expect(await verifyToken('', SECRET)).toBeNull()
  })

  it('三段式但非 JWT 格式返回 null', async () => {
    expect(await verifyToken('abc.def.ghi', SECRET)).toBeNull()
  })

  it('默认过期时间为 24h (86400s)', async () => {
    const token = await signToken({ sub: 'u1' }, SECRET)
    const payload = await verifyToken(token, SECRET)
    expect((payload!.exp as number) - (payload!.iat as number)).toBe(86400)
  })
})

describe('hashPassword + verifyPassword', () => {
  it('哈希后验证成功', async () => {
    const hash = await hashPassword('my-password')
    expect(hash).toContain('$')
    expect(await verifyPassword('my-password', hash)).toBe(true)
  })

  it('错误密码验证失败', async () => {
    const hash = await hashPassword('correct-password')
    expect(await verifyPassword('wrong-password', hash)).toBe(false)
  })

  it('相同密码两次哈希不同（salt 随机）', async () => {
    const hash1 = await hashPassword('same-password')
    const hash2 = await hashPassword('same-password')
    expect(hash1).not.toBe(hash2)
    // 但都能验证
    expect(await verifyPassword('same-password', hash1)).toBe(true)
    expect(await verifyPassword('same-password', hash2)).toBe(true)
  })

  it('使用带版本和迭代次数的 PBKDF2-SHA256 格式', async () => {
    const hash = await hashPassword('test')
    const [algorithm, iterations, salt, hashPart] = hash.split('$')
    expect(algorithm).toBe('pbkdf2-sha256')
    expect(Number(iterations)).toBeGreaterThanOrEqual(200_000)
    expect(salt).toMatch(/^[0-9a-f]{32}$/) // 16 bytes = 32 hex chars
    expect(hashPart).toMatch(/^[0-9a-f]{64}$/)
    expect(needsPasswordRehash(hash)).toBe(false)
  })

  it('兼容旧 salt$sha256 格式并标记为需要升级', async () => {
    const legacy = '00112233445566778899aabbccddeeff$937995fb9d8c863dc6380d7f981f6495adbe2a4ba93e53c276a1b8b3ee140b6c'
    expect(await verifyPassword('legacy-password', legacy)).toBe(true)
    expect(needsPasswordRehash(legacy)).toBe(true)
  })

  it('无效 stored 格式返回 false', async () => {
    expect(await verifyPassword('test', 'no-dollar-sign')).toBe(false)
    expect(await verifyPassword('test', '$')).toBe(false)
    expect(await verifyPassword('test', '')).toBe(false)
  })

  it('空密码也能哈希和验证', async () => {
    const hash = await hashPassword('')
    expect(await verifyPassword('', hash)).toBe(true)
    expect(await verifyPassword('non-empty', hash)).toBe(false)
  })
})
