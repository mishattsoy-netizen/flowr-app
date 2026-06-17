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
  console.log('Querying triggers and functions...');
  const { data, error } = await supabaseAdmin.rpc('inspect_triggers_and_functions');
  
  if (error) {
    // If the helper function doesn't exist, let's run a raw sql query via PostgREST if possible,
    // or let's try a system table select if select permissions exist.
    console.error('RPC inspect failed:', error);
    
    // Let's query pg_trigger directly if we can
    console.log('Attempting direct query to pg_trigger / pg_proc...');
    const { data: trigData, error: trigError } = await supabaseAdmin
      .from('pg_trigger')
      .select('*')
      .limit(5);
    if (trigError) {
      console.error('Direct pg_trigger select failed:', trigError);
    } else {
      console.log('pg_trigger contents:', trigData);
    }
    return;
  }

  console.log('Triggers found:', data);
}

main().catch(console.error);
