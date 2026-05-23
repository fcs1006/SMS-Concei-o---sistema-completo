require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  try {
    const { data, error } = await supabase.rpc('listar_usuarios'); // check if we can query pg_policies or similar via sql rpc
    console.log('listar_usuarios:', data, error);
    
    // Let's run a raw query to check policies
    const { data: policies, error: errPol } = await supabase.from('pg_policies').select('*').limit(10);
    console.log('policies:', policies, errPol);
  } catch (e) {
    console.error(e);
  }
}
check();
