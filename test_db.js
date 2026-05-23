require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  // Let's run a query to get table names
  const { data, error } = await supabase.rpc('listar_tabelas');
  if (error) {
    console.log('Error listing tables via RPC:', error);
    // If RPC doesn't exist, let's try reading from postgrest catalog or info schema
    const { data: data2, error: error2 } = await supabase
      .from('pg_tables')
      .select('tablename')
      .eq('schemaname', 'public');
    console.log('pg_tables:', data2, error2);
  } else {
    console.log('Tables:', data);
  }
}
check();
