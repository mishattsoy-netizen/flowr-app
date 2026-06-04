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

const { data, error } = await supabase.from('router_chains').select('*')
if (error) { console.error('ERR', error); process.exit(1) }

const targets = data.filter(r => (r.system_prompt || '').includes('pill'))
console.log('Chains with pill rule:', targets.length)
for (const row of targets) {
  // extract the pill-bearing line(s)
  const lines = (row.system_prompt || '').split('\n').filter(l => l.includes('pill') && (l.includes('Source') || l.includes('adjacent') || l.includes('sentence text')))
  console.log(`\n##### ${row.category} / platform=${row.platform} / id=${row.id} #####`)
  for (const l of lines) console.log(l.trim())
}
