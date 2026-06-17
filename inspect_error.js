const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const envContent = fs.readFileSync('.env', 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^\s*([\w\.\-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    let value = match[2] || '';
    if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
    if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1);
    env[match[1]] = value;
  }
});

const url = env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error('Missing env vars');
  process.exit(1);
}

const supabaseAdmin = createClient(url, serviceKey);

async function main() {
  console.log('Testing setBackendModel update...');
  const { data, error } = await supabaseAdmin
    .from('bot_compiled_prompt')
    .update({ backend_model: 'gemini-2.0-flash' })
    .select();
  
  if (error) {
    console.error('DATABASE ERROR DETECTED:', JSON.stringify(error, null, 2));
  } else {
    console.log('Update succeeded:', data);
  }
}

main().catch(console.error);
