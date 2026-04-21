import crypto from 'crypto'

const ALGORITHM = 'aes-256-cbc'

function getEncryptionKey() {
  const key = process.env.ENCRYPTION_KEY || ''
  if (key.length !== 32) {
    throw new Error('ENCRYPTION_KEY must be 32 characters long')
  }
  return Buffer.from(key)
}

export function encrypt(text: string) {
  const key = getEncryptionKey()
  const iv = crypto.randomBytes(16)
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv)
  let encrypted = cipher.update(text)
  encrypted = Buffer.concat([encrypted, cipher.final()])
  return {
    iv: iv.toString('hex'),
    encryptedData: encrypted.toString('hex')
  }
}

export function decrypt(encryptedData: string, iv: string) {
  const key = getEncryptionKey()
  const decipher = crypto.createDecipheriv(ALGORITHM, key, Buffer.from(iv, 'hex'))
  let decrypted = decipher.update(Buffer.from(encryptedData, 'hex'))
  decrypted = Buffer.concat([decrypted, decipher.final()])
  return decrypted.toString()
}
