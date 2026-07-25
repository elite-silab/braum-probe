import { describe, expect, it, vi } from 'vitest'
import { redactAuditChanges, writeAuditLog } from './audit'

describe('redactAuditChanges', () => {
  it('递归隐藏密码、token、secret、cookie 和 authorization', () => {
    expect(redactAuditChanges({
      password: 'plain-text',
      profile: { name: 'Alice', api_key: 'key', nested: { bot_token: 'token' } },
      headers: { Authorization: 'Bearer secret', Cookie: 'session=secret' },
    })).toEqual({
      password: '[REDACTED]',
      profile: { name: 'Alice', api_key: '[REDACTED]', nested: { bot_token: '[REDACTED]' } },
      headers: { Authorization: '[REDACTED]', Cookie: '[REDACTED]' },
    })
  })

  it('字符串形式的 config 整体隐藏', () => {
    expect(redactAuditChanges({ config: '{"bot_token":"secret"}' }))
      .toEqual({ config: '[REDACTED]' })
  })
})

describe('writeAuditLog', () => {
  it('只向数据库写入脱敏后的 changes', async () => {
    const chain = {
      bind: vi.fn().mockReturnThis(),
      run: vi.fn().mockResolvedValue({ meta: { changes: 1 } }),
    }
    const env = { DB: { prepare: vi.fn().mockReturnValue(chain) } } as any

    await writeAuditLog(env, {
      action: 'update',
      object_type: 'user',
      object_id: 'user-1',
      changes: { password: 'new-password', name: 'Alice' },
    })

    const serializedChanges = chain.bind.mock.calls[0][4]
    expect(JSON.parse(serializedChanges)).toEqual({ password: '[REDACTED]', name: 'Alice' })
    expect(serializedChanges).not.toContain('new-password')
  })
})
