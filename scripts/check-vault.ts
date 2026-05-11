import { createClient } from '@supabase/supabase-js'
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabase = createClient(supabaseUrl, supabaseKey)
async function check() {
  const { data, error } = await supabase.from('vault_accounts').select('*').limit(1)
  if (error) console.error('Error:', error.message)
  else console.log('Table exists. Data:', data)
}
check()
