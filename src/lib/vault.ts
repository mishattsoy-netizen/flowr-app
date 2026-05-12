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
    .eq('is_active', true)
    .maybeSingle()

  if (error || !data?.encrypted_value) {
    if (error) console.error(`Vault error for ${keyName}:`, error.message)
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

export async function getProviderKeys(provider: string): Promise<string[]> {
  const prefix = provider.toLowerCase()

  // 1. Fetch active accounts for this provider, ordered by sort_order
  const { data: accounts, error: accountError } = await supabaseAdmin
    .from('vault_accounts')
    .select('id')
    .eq('provider', prefix)
    .eq('is_active', true)
    .order('sort_order', { ascending: true })

  if (accountError) {
    console.error(`Failed to fetch accounts for provider: ${provider}`, accountError)
    return []
  }

  if (!accounts || accounts.length === 0) {
    // Fallback: If no accounts exist, try to find keys matching the provider prefix
    const { data, error: fallbackError } = await supabaseAdmin
      .from('vault')
      .select('encrypted_value, key_id, is_active')
      .ilike('key_id', `${provider.toUpperCase()}%`)
    
    if (fallbackError) {
      console.error(`Fallback fetch failed for ${provider}:`, fallbackError.message)
      return []
    }

    // Filter out metadata and INACTIVE keys
    const filteredData = (data || []).filter((item: any) => 
      item.is_active !== false &&
      !item.key_id.includes('_ACCOUNT_ID') && 
      !item.key_id.includes('_BASE_URL') &&
      !item.key_id.includes('_ORG_ID')
    )
    
    return decryptKeys(filteredData)
  }

  // 2. Fetch active keys for these accounts
  const accountIds = accounts.map((a: any) => a.id)
  const { data: keys, error: keyError } = await supabaseAdmin
    .from('vault')
    .select('encrypted_value, account_id, key_index')
    .in('account_id', accountIds)
    .eq('is_active', true)

  if (keyError || !keys) {
    console.error(`Failed to fetch keys for provider: ${provider}`, keyError)
    return []
  }

  // 3. Order keys: first by account sort_order (derived from accountIds array), then by key_index
  const orderedKeys = keys.sort((a: any, b: any) => {
    const accountIndexA = accountIds.indexOf(a.account_id)
    const accountIndexB = accountIds.indexOf(b.account_id)
    if (accountIndexA !== accountIndexB) {
      return accountIndexA - accountIndexB
    }
    return (a.key_index || 0) - (b.key_index || 0)
  })

  return decryptKeys(orderedKeys)
}

function decryptKeys(items: any[]): string[] {
  const decryptedKeys: string[] = []

  for (const item of items) {
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
      console.error(`Failed to decrypt key`, e)
    }
  }

  return decryptedKeys
}
