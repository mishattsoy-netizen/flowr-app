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
  const { data: sp } = await supabaseAdmin.from('spaces').select('*');
  console.log('spaces table rows:');
  (sp || []).forEach(s => console.log(' ', JSON.stringify(s)));

  const { data: wsEnts } = await supabaseAdmin
    .from('entities')
    .select('id, title, type, parent_id, space_id, sync_mode')
    .eq('type', 'workspace');
  console.log('workspace-type entities:');
  (wsEnts || []).forEach(e => console.log(' ', JSON.stringify(e)));

  // Count unsorted (parent_id null) per space for context
  const { data: unsorted } = await supabaseAdmin
    .from('entities')
    .select('id, title, type, space_id, sync_mode')
    .is('parent_id', null)
    .neq('type', 'workspace');
  console.log('root (parent_id=null) non-workspace entities:');
  (unsorted || []).forEach(e => console.log(' ', JSON.stringify(e)));
}

main().catch(console.error);
