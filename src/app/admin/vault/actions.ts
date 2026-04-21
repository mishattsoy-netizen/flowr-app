'use server'

import { supabaseAdmin as supabase } from '@/lib/supabase'
import { encrypt, decrypt } from '@/lib/encryption'
import { revalidatePath } from 'next/cache'

/**
 * Fetches all keys from the vault (names only).
 */
export async function getVaultKeys() {
  const { data, error } = await supabase
    .from('vault')
    .select('key_id, description, updated_at')
    .order('key_id', { ascending: true })

  if (error) throw error
  return data
}

/**
 * Updates a key in the vault with new encryption.
 */
export async function updateVaultKey(keyId: string, plainValue: string) {
  if (!plainValue) throw new Error('Value cannot be empty')

  const encrypted = encrypt(plainValue)

  const { error } = await supabase
    .from('vault')
    .update({
      encrypted_value: `${encrypted.iv}:${encrypted.encryptedData}`,
      updated_at: new Date().toISOString()
    })
    .eq('key_id', keyId)

  if (error) throw error
  revalidatePath('/admin/vault')
  return { success: true }
}

/**
 * Adds a new key to the vault.
 */
export async function addVaultKey(keyId: string, plainValue: string) {
  if (!keyId || !plainValue) throw new Error('Key name and Value cannot be empty')

  const encrypted = encrypt(plainValue)

  const { error } = await supabase
    .from('vault')
    .insert({
      key_id: keyId,
      encrypted_value: `${encrypted.iv}:${encrypted.encryptedData}`,
      updated_at: new Date().toISOString()
    })

  if (error) throw error
  revalidatePath('/admin/vault')
  return { success: true }
}

/**
 * Deletes a key from the vault.
 */
export async function deleteVaultKey(keyId: string) {
  const { error } = await supabase
    .from('vault')
    .delete()
    .eq('key_id', keyId)

  if (error) throw error
  revalidatePath('/admin/vault')
  return { success: true }
}

/**
 * Decrypts and reveals a vault key value.
 */
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

  // Support both JSON format and colon-delimited format
  try {
    const parsed = JSON.parse(data.encrypted_value)
    iv = parsed.iv
    encryptedData = parsed.encryptedData
  } catch (e) {
    // Fallback: Support colon-delimited format [iv]:[encryptedData]
    const parts = data.encrypted_value.split(':')
    if (parts.length < 2) throw new Error('Invalid encryption format in database')
    iv = parts[0]
    encryptedData = parts[1]
  }

  if (!iv || !encryptedData) throw new Error('Could not extract encryption components')

  return decrypt(encryptedData, iv)
}
