import crypto from 'crypto'

const TOKEN_TTL_MS = 10 * 60 * 1000 // 10 minutes

function getSecret(): string {
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET
  if (!secret) throw new Error('TELEGRAM_WEBHOOK_SECRET is not configured')
  return secret
}

function sign(payload: string): string {
  return crypto.createHmac('sha256', getSecret()).update(payload).digest('hex')
}

/**
 * Issues a short-lived, HMAC-signed token binding a Telegram chat id to a
 * point in time, so the /auth/telegram-link flow can prove the link request
 * actually originated from the bot's /login command rather than an
 * attacker-guessed or forwarded chat id.
 */
export function createTelegramLinkToken(telegramId: number): string {
  const timestamp = Date.now().toString()
  const payload = `${telegramId}.${timestamp}`
  const signature = sign(payload)
  return `${timestamp}.${signature}`
}

export function verifyTelegramLinkToken(telegramId: number, token: string): boolean {
  const [timestamp, signature] = token.split('.')
  if (!timestamp || !signature) return false

  const age = Date.now() - Number(timestamp)
  if (!Number.isFinite(age) || age < 0 || age > TOKEN_TTL_MS) return false

  const expected = sign(`${telegramId}.${timestamp}`)
  const expectedBuf = Buffer.from(expected, 'hex')
  const actualBuf = Buffer.from(signature, 'hex')
  if (expectedBuf.length !== actualBuf.length) return false
  return crypto.timingSafeEqual(expectedBuf, actualBuf)
}
