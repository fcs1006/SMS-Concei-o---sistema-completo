require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  try {
    const { data: conversas, error: errConv } = await supabase
      .from('whatsapp_conversas')
      .select('*')
      .limit(5);
    console.log('Conversas with anon key:', conversas, 'Error:', errConv);

    const { data: estados, error: errEst } = await supabase
      .from('whatsapp_estados')
      .select('*')
      .limit(5);
    console.log('Estados with anon key:', estados, 'Error:', errEst);
  } catch (e) {
    console.error(e);
  }
}
check();
