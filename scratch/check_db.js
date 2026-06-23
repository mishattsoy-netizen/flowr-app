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
  // Let's first create a temp conversation to test deletion
  console.log('Creating a test conversation...');
  const { data: conv, error: createError } = await supabaseAdmin
    .from('conversations')
    .insert({ title: 'Test Cleanup Delete' })
    .select()
    .single();

  if (createError) {
    console.error('Failed to create test conversation:', createError);
    return;
  }

  console.log('Test conversation created:', conv);

  // Attempt to delete it
  console.log('Attempting to delete test conversation...');
  const { error: deleteError } = await supabaseAdmin
    .from('conversations')
    .delete()
    .eq('id', conv.id);

  if (deleteError) {
    console.error('Failed to delete test conversation:', deleteError);
  } else {
    console.log('Test conversation deleted successfully!');
  }

  // Let's query information_schema for foreign keys on conversations table
  console.log('Querying foreign keys / constraints...');
  const { data: constraints, error: constError } = await supabaseAdmin.rpc('inspect_table_constraints', { table_name: 'conversations' });
  if (constError) {
    // If RPC doesn't exist, let's try a direct SQL select or just print error
    console.log('inspect_table_constraints RPC not available. Trying manual select...');
    const { data: direct, error: directError } = await supabaseAdmin
      .from('conversations')
      .select('*')
      .limit(1);
    console.log('Conversations content sample:', direct);
  } else {
    console.log('Constraints details:', constraints);
  }
}

main().catch(console.error);
