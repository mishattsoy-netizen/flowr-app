import { supabaseAdmin } from './supabase'
import { decrypt } from './encryption'

/**
 * Fetches an encrypted secret from the 'vault' table and returns the decrypted string.
 * @param keyName The name of the key (e.g., 'GEMINI_PRIMARY')
 */
export async function getVaultKey(keyName: string): Promise<string | null> {
  const { data, error } = await supabaseAdmin
    .from('vault')
    .select('encrypted_value')
    .eq('key_id', keyName)
    .maybeSingle()

  if (error || !data?.encrypted_value) {
    return null
  }

  try {
    // Support both JSON format and colon-delimited format
    let iv: string = ''
    let encryptedData: string = ''

    try {
      const parsed = JSON.parse(data.encrypted_value)
      iv = parsed.iv
      encryptedData = parsed.encryptedData
    } catch (e) {
      const parts = data.encrypted_value.split(':')
      if (parts.length < 2) return null
      iv = parts[0]
      encryptedData = parts[1]
    }

    if (!iv || !encryptedData) return null
    return decrypt(encryptedData, iv)
  } catch (error) {
    console.error(`Failed to decrypt vault key: ${keyName}`, error)
    return null
  }
}

/**
 * Fetches all keys for a given provider (e.g., 'GEMINI', 'GROQ')
 * Supports rotation by returning an array of decrypted keys.
 */
export async function getProviderKeys(provider: string): Promise<string[]> {
  const prefix = provider.toUpperCase()
  const { data, error } = await supabaseAdmin
    .from('vault')
    .select('key_id, encrypted_value')
    .ilike('key_id', `${prefix}%`)

  if (error || !data) return []

  const decryptedKeys: string[] = []

  for (const item of data) {
    try {
      let iv: string = ''
      let encryptedData: string = ''

      try {
        const parsed = JSON.parse(item.encrypted_value)
        iv = parsed.iv
        encryptedData = parsed.encryptedData
      } catch (e) {
        const parts = item.encrypted_value.split(':')
        if (parts.length < 2) continue
        iv = parts[0]
        encryptedData = parts[1]
      }

      if (iv && encryptedData) {
        const key = decrypt(encryptedData, iv)
        if (key) decryptedKeys.push(key)
      }
    } catch (e) {
      console.error(`Failed to decrypt key: ${item.key_id}`, e)
    }
  }

  return decryptedKeys
}
