const PREFIX = 'enc:v1'

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function base64UrlToBytes(value: string): Uint8Array<ArrayBuffer> {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '=')
  const binary = atob(padded)
  return Uint8Array.from(binary, (character) => character.charCodeAt(0))
}

async function deriveKey(secret: string): Promise<CryptoKey> {
  if (!secret) throw new Error('ENCRYPTION_KEY is not configured')
  const keyBytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(secret))
  return crypto.subtle.importKey('raw', keyBytes, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt'])
}

/** Encrypt JSON configuration using AES-256-GCM. */
export async function encryptConfig(config: unknown, secret: string): Promise<string> {
  const plaintext = new TextEncoder().encode(JSON.stringify(config ?? {}))
  if (plaintext.byteLength > 64 * 1024) throw new Error('Notification config is too large')

  const iv = crypto.getRandomValues(new Uint8Array(12))
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    await deriveKey(secret),
    plaintext
  )

  return `${PREFIX}:${bytesToBase64Url(iv)}:${bytesToBase64Url(new Uint8Array(ciphertext))}`
}

/** Decrypt current ciphertexts and read legacy plaintext JSON during migration. */
export async function decryptConfig(stored: string, secret: string): Promise<Record<string, unknown>> {
  if (!stored.startsWith(`${PREFIX}:`)) {
    return JSON.parse(stored || '{}') as Record<string, unknown>
  }

  const parts = stored.split(':')
  if (parts.length !== 4) throw new Error('Invalid encrypted notification config')
  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: base64UrlToBytes(parts[2]) },
    await deriveKey(secret),
    base64UrlToBytes(parts[3])
  )
  return JSON.parse(new TextDecoder().decode(plaintext)) as Record<string, unknown>
}
