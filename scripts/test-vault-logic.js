const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  console.log('--- PHASE 5 VERIFICATION SCRIPT ---');

  // Let's peek at the actual DB state for accounts to see what SHOULD be returned
  const { data: accounts } = await supabase
    .from('vault_accounts')
    .select('id, name, is_active, sort_order, provider')
    .order('provider', { ascending: true })
    .order('sort_order', { ascending: true });

  console.log('\nAll System Accounts in DB:');
  accounts?.forEach(a => {
    console.log(`[${a.provider.toUpperCase()}] "${a.name}" | Active: ${a.is_active} | Sort: ${a.sort_order} | ID: ${a.id.substring(0, 8)}`);
  });

  const { data: keys } = await supabase
    .from('vault')
    .select('id, account_id, key_index, key_id');

  console.log('\nKeys breakdown per active account:');
  
  const providerSummary = {};

  accounts?.filter(a => a.is_active).forEach(a => {
    const accountKeys = keys?.filter(k => k.account_id === a.id).sort((x, y) => x.key_index - y.key_index) || [];
    if (!providerSummary[a.provider]) providerSummary[a.provider] = [];
    providerSummary[a.provider].push(...accountKeys);
    
    console.log(`✅ Active Account: [${a.provider}] "${a.name}" has ${accountKeys.length} keys.`);
  });

  console.log('\n--- Simulated Final Round-Robin Arrays (In Order) ---');
  Object.entries(providerSummary).forEach(([provider, activeKeys]) => {
    console.log(`${provider.toUpperCase()}: ${activeKeys.length} total functional fallback slots found.`);
    activeKeys.forEach((k, i) => {
       console.log(`  (${i+1}) Slot -> ${k.key_id.substring(0,15)}...`);
    });
  });

  console.log('\n✅ DB STRUCTURE VERIFICATION COMPLETE.');
}

run();
