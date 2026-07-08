import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config()

const url = 'https://qmufalwubepttjxehvit.supabase.co'
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabase = createClient(url, serviceKey)

async function run() {
  const { data, error } = await supabase
    .from('router_chains')
    .select('model_list')
    .eq('category', 'WEB_SEARCH')
    .eq('platform', 'telegram')
    .maybeSingle()

  if (error) {
    console.error(error)
    return
  }
  console.log('WEB_SEARCH model list in DB:')
  console.log(JSON.stringify(data?.model_list, null, 2))
}

run()
