// Braum 布隆 CF 探针 — JWT 工具函数（HMAC-SHA256 签名）

const HEADER = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).replace(/=+$/, '')

/**
 * 将 string 转为 Uint8Array
 */
function strToBytes(str: string): Uint8Array {
  return new TextEncoder().encode(str)
}

/**
 * 将 ArrayBuffer 转为 hex 字符串
 */
function bufToHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

/**
 * 将 hex 字符串转为 ArrayBuffer
 */
function hexToBuf(hex: string): ArrayBuffer {
  const bytes = new Uint8Array(hex.length / 2)
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16)
  }
  return bytes.buffer
}

/**
 * 获取 HMAC 密钥
 */
async function getSigningKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    strToBytes(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  )
}

/**
 * 签发 JWT（HMAC-SHA256）
 *
 * @param payload - JWT 载荷（自动注入 iat/exp）
 * @param secret  - 签名密钥
 * @param expiresInSeconds - 过期秒数，默认 24h
 */
export async function signToken(
  payload: Record<string, unknown>,
  secret: string,
  expiresInSeconds = 86400
): Promise<string> {
  const now = Math.floor(Date.now() / 1000)
  const fullPayload = { ...payload, iat: now, exp: now + expiresInSeconds }

  const payloadB64 = btoa(JSON.stringify(fullPayload)).replace(/=+$/, '')
  const signingInput = `${HEADER}.${payloadB64}`

  const key = await getSigningKey(secret)
  const signatureBuf = await crypto.subtle.sign('HMAC', key, strToBytes(signingInput))
  const signatureHex = bufToHex(signatureBuf)

  return `${signingInput}.${signatureHex}`
}

/**
 * 验证并解析 JWT（HMAC-SHA256）
 *
 * @returns 解析后的 payload，验证失败返回 null
 */
export async function verifyToken(
  token: string,
  secret: string
): Promise<Record<string, unknown> | null> {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) return null

    const [headerB64, payloadB64, signatureHex] = parts

    // 验证 header（防止算法混淆攻击）
    const header = JSON.parse(atob(headerB64))
    if (header.alg !== 'HS256' || header.typ !== 'JWT') return null

    // 验证签名
    const signingInput = `${headerB64}.${payloadB64}`
    const key = await getSigningKey(secret)
    const isValid = await crypto.subtle.verify(
      'HMAC',
      key,
      hexToBuf(signatureHex),
      strToBytes(signingInput)
    )
    if (!isValid) return null

    // 解析 payload
    const payload = JSON.parse(atob(payloadB64))

    // 验证过期时间
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return null

    return payload
  } catch {
    return null
  }
}

const PASSWORD_HASH_ALGORITHM = 'pbkdf2-sha256'
const PASSWORD_HASH_ITERATIONS = 210_000

async function derivePasswordHash(password: string, saltHex: string, iterations: number): Promise<string> {
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    strToBytes(password),
    'PBKDF2',
    false,
    ['deriveBits']
  )
  const bits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      hash: 'SHA-256',
      salt: hexToBuf(saltHex),
      iterations,
    },
    keyMaterial,
    256
  )
  return bufToHex(bits)
}

function equalHex(left: string, right: string): boolean {
  if (left.length !== right.length) return false
  let difference = 0
  for (let index = 0; index < left.length; index++) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index)
  }
  return difference === 0
}

/** 密码哈希：PBKDF2-HMAC-SHA256 + 随机 salt。 */
export async function hashPassword(password: string): Promise<string> {
  const saltBytes = crypto.getRandomValues(new Uint8Array(16))
  const salt = bufToHex(saltBytes.buffer)
  const hash = await derivePasswordHash(password, salt, PASSWORD_HASH_ITERATIONS)
  return `${PASSWORD_HASH_ALGORITHM}$${PASSWORD_HASH_ITERATIONS}$${salt}$${hash}`
}

/** 旧哈希会在成功登录后升级。 */
export function needsPasswordRehash(stored: string): boolean {
  const [algorithm, iterations] = stored.split('$')
  return algorithm !== PASSWORD_HASH_ALGORITHM || Number(iterations) < PASSWORD_HASH_ITERATIONS
}

/** 验证 PBKDF2 哈希，并兼容历史 salt$sha256 格式。 */
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split('$')

  if (parts.length === 4 && parts[0] === PASSWORD_HASH_ALGORITHM) {
    const iterations = Number(parts[1])
    const salt = parts[2]
    const expectedHash = parts[3]
    if (!Number.isInteger(iterations) || iterations < 1 || !salt || !expectedHash) return false

    const hash = await derivePasswordHash(password, salt, iterations)
    return equalHex(hash, expectedHash)
  }

  if (parts.length !== 2) return false
  const [salt, expectedHash] = parts
  if (!salt || !expectedHash) return false

  const combined = strToBytes(salt + password)
  const hashBuf = await crypto.subtle.digest('SHA-256', combined)
  const hash = bufToHex(hashBuf)

  return equalHex(hash, expectedHash)
}
