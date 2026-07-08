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

const supabaseAdmin = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY
);

async function main() {
  const ids = ['folder-1783291701552', 'folder-1783291933631', 'folder-1783291984281'];

  const { data: folders } = await supabaseAdmin
    .from('entities')
    .select('id, title, owner_id, created_at, last_modified')
    .in('id', ids);
  console.log('missing folders owner info:');
  (folders || []).forEach(f => console.log(' ', JSON.stringify(f)));

  // a known-good user-created entity for comparison
  const { data: good } = await supabaseAdmin
    .from('entities')
    .select('id, title, owner_id')
    .eq('id', 'e1782948078101_100'); // "Ideas" note, visible in app
  console.log('visible note owner info:');
  (good || []).forEach(f => console.log(' ', JSON.stringify(f)));

  // children of the missing folders
  const { data: children } = await supabaseAdmin
    .from('entities')
    .select('id, title, type, parent_id, owner_id, sync_mode')
    .in('parent_id', ids);
  console.log('children of missing folders:');
  (children || []).forEach(f => console.log(' ', JSON.stringify(f)));
}

main().catch(console.error);
