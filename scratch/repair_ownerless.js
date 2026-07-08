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

const USER_ID = 'a67b639a-ebdd-4a1d-b0ba-2a237f8fe843';
const APPLY = process.argv.includes('--apply');

async function main() {
  // Find ALL ownerless rows across content tables
  const { data: ents } = await supabaseAdmin
    .from('entities')
    .select('id, title, type, parent_id, space_id')
    .is('owner_id', null);
  console.log(`ownerless entities: ${(ents || []).length}`);
  (ents || []).forEach(e => console.log(' ', JSON.stringify(e)));

  const { data: tasks } = await supabaseAdmin
    .from('tasks')
    .select('id, title')
    .is('owner_id', null);
  console.log(`ownerless tasks: ${(tasks || []).length}`);
  (tasks || []).forEach(t => console.log(' ', JSON.stringify(t)));

  if (!APPLY) {
    console.log('\nDry run. Re-run with --apply to assign these to', USER_ID);
    return;
  }

  if ((ents || []).length > 0) {
    const { error, count } = await supabaseAdmin
      .from('entities')
      .update({ owner_id: USER_ID }, { count: 'exact' })
      .is('owner_id', null);
    console.log('entities update:', error ? error.message : `OK (${count} rows)`);
  }
  if ((tasks || []).length > 0) {
    const { error, count } = await supabaseAdmin
      .from('tasks')
      .update({ owner_id: USER_ID }, { count: 'exact' })
      .is('owner_id', null);
    console.log('tasks update:', error ? error.message : `OK (${count} rows)`);
  }
}

main().catch(console.error);
