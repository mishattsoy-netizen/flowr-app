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
const supabaseAdmin = createClient(url, serviceKey);

async function main() {
  // 1. All folders
  const { data: folders, error: fErr } = await supabaseAdmin
    .from('entities')
    .select('id, title, type, parent_id, space_id, last_modified, sync_mode, owner_id')
    .eq('type', 'folder');
  if (fErr) { console.error('folders query error:', fErr); return; }

  // 2. All entity ids + types (to check parent existence)
  const { data: allEnts, error: aErr } = await supabaseAdmin
    .from('entities')
    .select('id, type, title');
  if (aErr) { console.error('all entities query error:', aErr); return; }
  const entById = new Map(allEnts.map(e => [e.id, e]));

  // 3. All workspaces/spaces rows if a separate table exists
  let spaces = [];
  const { data: sp, error: sErr } = await supabaseAdmin
    .from('spaces')
    .select('id, name');
  if (!sErr && sp) spaces = sp;
  else {
    const { data: ws } = await supabaseAdmin.from('workspaces').select('id, name');
    if (ws) spaces = ws;
  }
  const spaceIds = new Set(spaces.map(s => s.id));
  // workspaces may also live in entities table as type='workspace'
  allEnts.filter(e => e.type === 'workspace').forEach(e => spaceIds.add(e.id));

  console.log(`Total folders in DB: ${folders.length}`);
  console.log(`Known space ids: ${JSON.stringify([...spaceIds])}`);
  console.log('---');
  for (const f of folders) {
    const parentExists = f.parent_id ? entById.has(f.parent_id) : null;
    const spaceExists = f.space_id ? spaceIds.has(f.space_id) : null;
    console.log(JSON.stringify({
      title: f.title,
      id: f.id,
      parent_id: f.parent_id,
      parentExists,
      parentTitle: f.parent_id && entById.get(f.parent_id)?.title,
      space_id: f.space_id,
      spaceExists,
      sync_mode: f.sync_mode,
    }));
  }
}

main().catch(console.error);
