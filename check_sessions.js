const fs = require('fs')
const path = require('path')

const envContent = fs.readFileSync(path.join(__dirname, '.env'), 'utf-8')
envContent.split('\n').forEach(line => {
  const match = line.match(/^([^=]+)=(.*)$/)
  if (match) {
    process.env[match[1]] = match[2]
  }
})

const { createClient } = require('@supabase/supabase-js')
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function check() {
  const { data, error } = await supabaseAdmin.from('bot_session_states').select('*')
  console.log('Error:', error)
  console.log('Session States:', data)
}
check()
