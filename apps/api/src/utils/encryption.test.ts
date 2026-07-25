import { describe, expect, it } from 'vitest'
import { decryptConfig, encryptConfig } from './encryption'

const KEY = 'test-encryption-key-with-enough-entropy'

describe('encrypted notification config', () => {
  it('使用版本化 AES-GCM 密文往返配置', async () => {
    const config = { bot_token: 'secret-token', chat_id: '12345' }
    const encrypted = await encryptConfig(config, KEY)

    expect(encrypted).toMatch(/^enc:v1:/)
    expect(encrypted).not.toContain('secret-token')
    expect(await decryptConfig(encrypted, KEY)).toEqual(config)
  })

  it('兼容读取历史明文 JSON 配置', async () => {
    expect(await decryptConfig('{"url":"https://example.com"}', KEY))
      .toEqual({ url: 'https://example.com' })
  })

  it('错误密钥不能解密', async () => {
    const encrypted = await encryptConfig({ token: 'secret' }, KEY)
    await expect(decryptConfig(encrypted, 'wrong-key')).rejects.toThrow()
  })
})
