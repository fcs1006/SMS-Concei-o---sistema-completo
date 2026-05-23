require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function test() {
  console.log('Querying one row of especialidades_agendamentos:');
  const { data: esp, error: espErr } = await supabase.from('especialidades_agendamentos').select('*').limit(1);
  if (espErr) console.error('esp error:', espErr);
  else console.log('esp keys:', esp.length > 0 ? Object.keys(esp[0]) : 'empty', esp[0]);

  console.log('\nQuerying one row of monitoramento_sisreg:');
  const { data: sis, error: sisErr } = await supabase.from('monitoramento_sisreg').select('*').limit(1);
  if (sisErr) console.error('sis error:', sisErr);
  else console.log('sis keys:', sis.length > 0 ? Object.keys(sis[0]) : 'empty', sis[0]);

  console.log('\nQuerying one row of viagens:');
  const { data: via, error: viaErr } = await supabase.from('viagens').select('*').limit(1);
  if (viaErr) console.error('via error:', viaErr);
  else console.log('via keys:', via.length > 0 ? Object.keys(via[0]) : 'empty', via[0]);

  console.log('\nQuerying one row of pacientes:');
  const { data: pac, error: pacErr } = await supabase.from('pacientes').select('*').limit(1);
  if (pacErr) console.error('pac error:', pacErr);
  else console.log('pac keys:', pac.length > 0 ? Object.keys(pac[0]) : 'empty', pac[0]);
}

test();
