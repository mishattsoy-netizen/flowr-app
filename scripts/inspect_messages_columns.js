const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// Load env from project root
const envPath = path.join(process.cwd(), '.env');
const envContent = fs.readFileSync(envPath, 'utf8');
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

const url = env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error('Missing env vars');
  process.exit(1);
}

const supabaseAdmin = createClient(url, serviceKey);

async function main() {
  console.log('Querying messages table columns...');
  // Query messages table to inspect the columns in the first row
  const { data: messages, error } = await supabaseAdmin
    .from('messages')
    .select('*')
    .limit(1);

  if (error) {
    console.error('Failed to select from messages:', error);
  } else {
    console.log('Messages table structure (keys of first row):', messages.length > 0 ? Object.keys(messages[0]) : 'No rows found in messages table');
  }

  // Let's check conversations too
  const { data: convs, error: convsErr } = await supabaseAdmin
    .from('conversations')
    .select('*')
    .limit(1);

  if (convsErr) {
    console.error('Failed to select from conversations:', convsErr);
  } else {
    console.log('Conversations table structure (keys of first row):', convs.length > 0 ? Object.keys(convs[0]) : 'No rows found in conversations table');
  }
}

main().catch(console.error);
