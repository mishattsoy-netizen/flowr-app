'use server'

import { supabaseAdmin as supabase } from '@/lib/supabase'
import { encrypt, decrypt } from '@/lib/encryption'
import { revalidatePath } from 'next/cache'

// --- ACCOUNTS ---

export async function getVaultData() {
  const [accountsRes, keysRes] = await Promise.all([
    supabase.from('vault_accounts').select('*').order('sort_order', { ascending: true }),
    supabase.from('vault').select('id, key_id, account_id, key_index, description, is_active, updated_at').order('key_index', { ascending: true })
  ])
  return { accounts: accountsRes.data || [], keys: keysRes.data || [] }
}

export async function getVaultKeys() {
  const { data, error } = await supabase
    .from('vault')
    .select('id, key_id, account_id, key_index, description, is_active, updated_at')
    .order('key_index', { ascending: true })
  
  if (error) throw error
  return data || []
}

export async function addVaultAccount(provider: string, name: string) {
  const { data: existing } = await supabase
    .from('vault_accounts')
    .select('id')
    .eq('provider', provider)
  
  const sort_order = existing ? existing.length : 0

  const { error } = await supabase
    .from('vault_accounts')
    .insert({ provider, name, sort_order, is_active: true })
  
  if (error) throw error
  revalidatePath('/admin/vault')
  return { success: true }
}

export async function updateVaultAccount(accountId: string, name: string) {
  const { error } = await supabase
    .from('vault_accounts')
    .update({ name, updated_at: new Date().toISOString() })
    .eq('id', accountId)
  
  if (error) throw error
  revalidatePath('/admin/vault')
  return { success: true }
}

export async function toggleVaultAccount(accountId: string, isActive: boolean) {
  const { error } = await supabase
    .from('vault_accounts')
    .update({ is_active: isActive, updated_at: new Date().toISOString() })
    .eq('id', accountId)
  
  if (error) throw error
  revalidatePath('/admin/vault')
  return { success: true }
}

export async function deleteVaultAccount(accountId: string) {
  const { error } = await supabase
    .from('vault_accounts')
    .delete()
    .eq('id', accountId)
  
  if (error) throw error
  revalidatePath('/admin/vault')
  return { success: true }
}

export async function reorderVaultAccounts(orderedIds: string[]) {
  for (let i = 0; i < orderedIds.length; i++) {
    const { error } = await supabase
      .from('vault_accounts')
      .update({ sort_order: i })
      .eq('id', orderedIds[i])
    if (error) throw error
  }
  revalidatePath('/admin/vault')
  return { success: true }
}

// --- KEYS ---

export async function updateVaultKey(keyId: string, plainValue?: string) {
  const updates: any = { updated_at: new Date().toISOString() }

  if (plainValue) {
    const encrypted = encrypt(plainValue)
    updates.encrypted_value = `${encrypted.iv}:${encrypted.encryptedData}`
  }

  const { error } = await supabase
    .from('vault')
    .update(updates)
    .eq('key_id', keyId)

  if (error) throw error
  revalidatePath('/admin/vault')
  return { success: true }
}

export async function toggleVaultKey(keyId: string, isActive: boolean) {
  const { error } = await supabase
    .from('vault')
    .update({ is_active: isActive, updated_at: new Date().toISOString() })
    .eq('key_id', keyId)

  if (error) throw error
  revalidatePath('/admin/vault')
  return { success: true }
}

export async function addVaultKey(accountId: string | null, provider: string, plainValue: string, customKeyId?: string) {
  if (!plainValue) throw new Error('Value cannot be empty')

  let finalAccountId = accountId

  if (!finalAccountId) {
    // Resolve to general provider for stand-alone keys if not specified
    const { data: acct } = await supabase.from('vault_accounts').select('id').eq('provider', 'general').maybeSingle()
    if (acct) finalAccountId = acct.id
    else {
       // Create fallback general
       const { data: newA, error: e } = await supabase.from('vault_accounts').insert({ provider: 'general', name: 'Primary', is_active: true }).select('id').single()
       if (!e) finalAccountId = newA.id
    }
  }

  const { data: existing } = await supabase
    .from('vault')
    .select('key_id')
    .eq('account_id', finalAccountId)

  const { data: account } = await supabase
    .from('vault_accounts')
    .select('name')
    .eq('id', finalAccountId)
    .single()

  const key_index = existing ? existing.length : 0
  
  // Generate a professional ID: PROVIDER_ACCOUNT_INDEX (e.g., GEMINI_MISHA_5)
  const accountName = account?.name?.split('@')[0].split(' ')[0].toUpperCase() || 'PRIMARY'
  const keyId = customKeyId || `${provider.toUpperCase()}_${accountName}_${key_index}`

  const encrypted = encrypt(plainValue)

  const { error } = await supabase
    .from('vault')
    .insert({
      key_id: keyId,
      encrypted_value: `${encrypted.iv}:${encrypted.encryptedData}`,
      account_id: finalAccountId,
      key_index,
      description: `Provisioned for ${account?.name || provider} at ${new Date().toLocaleTimeString()}`,
      is_active: true,
      updated_at: new Date().toISOString()
    })

  if (error) throw error
  revalidatePath('/admin/vault')
  return { success: true }
}

export async function deleteVaultKey(keyId: string) {
  const { error } = await supabase
    .from('vault')
    .delete()
    .eq('key_id', keyId)

  if (error) throw error
  revalidatePath('/admin/vault')
  return { success: true }
}

export async function revealVaultKey(keyId: string) {
  const { data, error } = await supabase
    .from('vault')
    .select('encrypted_value')
    .eq('key_id', keyId)
    .single()

  if (error) throw error
  if (!data?.encrypted_value) throw new Error('Key not found or empty')

  let iv: string = ''
  let encryptedData: string = ''

  try {
    const parsed = JSON.parse(data.encrypted_value)
    iv = parsed.iv
    encryptedData = parsed.encryptedData
  } catch (e) {
    const parts = data.encrypted_value.split(':')
    if (parts.length < 2) throw new Error('Invalid encryption format in database')
    iv = parts[0]
    encryptedData = parts[1]
  }

  if (!iv || !encryptedData) throw new Error('Could not extract encryption components')

  return decrypt(encryptedData, iv)
}

export async function reorderProviderKeys(orderedKeyIds: string[]) {
  for (let i = 0; i < orderedKeyIds.length; i++) {
    const { error } = await supabase
      .from('vault')
      .update({ key_index: i })
      .eq('key_id', orderedKeyIds[i])
    if (error) throw error
  }

  revalidatePath('/admin/vault')
  return { success: true }
}

