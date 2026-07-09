import { createClient } from '@supabase/supabase-js'
import { supabaseAdmin } from '@/lib/supabase'

export async function assertAdmin(accessToken: string | null | undefined): Promise<void> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !anonKey || !accessToken) {
    throw new Error('Unauthorized')
  }

  const anonClient = createClient(url, anonKey, { auth: { persistSession: false } })
  const { data: { user }, error } = await anonClient.auth.getUser(accessToken)
  if (error || !user?.email) {
    throw new Error('Unauthorized')
  }

  const { data } = await supabaseAdmin
    .from('admins')
    .select('email')
    .eq('email', user.email)
    .single()

  if (!data) {
    throw new Error('Unauthorized')
  }
}
