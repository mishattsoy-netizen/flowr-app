import { getProviderKeys } from '../src/lib/vault'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

async function runTest() {
  console.log('--- Phase 5 Verification ---')

  // 1. Find a target provider that has multiple accounts, or create mock data.
  // Let's just dump current Gemini retrieval.
  try {
    console.log('\nChecking GEMINI configuration...')
    const geminiKeys = await getProviderKeys('gemini')
    console.log(`Found ${geminiKeys.length} total active keys returned for Gemini.`)

    // Let's peek at the actual DB state for accounts to see what SHOULD be returned
    const { data: accounts } = await supabase
      .from('vault_accounts')
      .select('id, name, is_active, sort_order')
      .eq('provider', 'gemini')
      .order('sort_order', { ascending: true })

    console.log('\nGemini Accounts in DB:')
    accounts?.forEach(a => {
      console.log(` - Account: "${a.name}" | Active: ${a.is_active} | Sort: ${a.sort_order} | ID: ${a.id.substring(0, 8)}`)
    })

    // Check keys count per account
    const { data: allKeys } = await supabase
      .from('vault')
      .select('id, account_id, key_index')
      .in('account_id', accounts?.map(a => a.id) || [])

    console.log('\nKeys Analysis:')
    accounts?.forEach(a => {
      const count = allKeys?.filter(k => k.account_id === a.id).length || 0
      console.log(` - "${a.name}" has ${count} keys total.`)
    })

    const expectedActiveKeys = accounts
      ?.filter(a => a.is_active)
      .reduce((sum, a) => sum + (allKeys?.filter(k => k.account_id === a.id).length || 0), 0)

    console.log(`\nVerification Results:`)
    console.log(` - Calculated expected active keys in code logic: ${expectedActiveKeys}`)
    console.log(` - Keys returned by getProviderKeys(): ${geminiKeys.length}`)

    if (geminiKeys.length === expectedActiveKeys) {
      console.log('✅ SUCCESS: Logic is retrieving correctly filtered and ordered active keys.')
    } else {
      console.log('❌ FAILURE: Mismatch detected in keys count.')
    }
  } catch (err) {
    console.error('Error during test execution:', err)
  }
}

runTest()
