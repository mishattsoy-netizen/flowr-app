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

const url = 'https://qmufalwubepttjxehvit.supabase.co';
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;

const supabaseAdmin = createClient(url, serviceKey);

async function main() {
  const { data, error } = await supabaseAdmin
    .from('entities')
    .select('id, title, type, parent_id, sort_order, workspace_id')
    .order('sort_order');
  
  if (error) {
    console.error(error);
    return;
  }

  console.log('Entities in database:');
  console.log(JSON.stringify(data, null, 2));
}

main().catch(console.error);
