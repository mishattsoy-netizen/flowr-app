import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const envRaw = readFileSync(join(root, '.env'), 'utf8')
const env = Object.fromEntries(
  envRaw.split('\n').filter(l => l.includes('=')).map(l => { const [k, ...v] = l.split('='); return [k.trim(), v.join('=').trim()] })
)
const supabase = createClient(env['NEXT_PUBLIC_SUPABASE_URL'], env['SUPABASE_SERVICE_ROLE_KEY'])

const { data } = await supabase.from('bot_settings').select('*').eq('category', 'answer_style')
console.log('bot_settings columns:', Object.keys(data[0] || {}).join(', '))
for (const r of data) console.log(`  mode=${r.mode} is_active=${r.is_active}`)
