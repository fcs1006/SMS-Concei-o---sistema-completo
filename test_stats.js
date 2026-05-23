require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  const hoje = new Date()
  const pad = (n) => String(n).padStart(2, '0')
  const hojeStr = `${hoje.getFullYear()}-${pad(hoje.getMonth() + 1)}-${pad(hoje.getDate())}`
  const inicioMes = `${hoje.getFullYear()}-${pad(hoje.getMonth() + 1)}-01`

  const { count: vHoje, error: errHoje } = await supabase.from('viagens').select('*', { count: 'exact', head: true }).eq('data_viagem', hojeStr)
  const { count: vMes, error: errMes } = await supabase.from('viagens').select('*', { count: 'exact', head: true }).gte('data_viagem', inicioMes)
  const { count: pTot, error: errTot } = await supabase.from('pacientes').select('*', { count: 'exact', head: true })
  const { count: sAtv, error: errAtv } = await supabase.from('usuarios').select('*', { count: 'exact', head: true }).eq('ativo', true)
  
  const { data: vDest, error: errDest } = await supabase.from('viagens').select('destino').gte('data_viagem', inicioMes)
  const { data: vUlt, error: errUlt } = await supabase.from('viagens')
    .select('data_viagem, hora, paciente_nome, destino, criado_em')
    .order('criado_em', { ascending: false })
    .limit(5)

  console.log('Using Anon Key:');
  console.log('Viagens Hoje count:', vHoje, errHoje);
  console.log('Viagens Mes count:', vMes, errMes);
  console.log('Pacientes Total count:', pTot, errTot);
  console.log('Servidores Ativos count:', sAtv, errAtv);
  console.log('Destinos data:', vDest?.length, errDest);
  console.log('Ultimas Viagens data:', vUlt?.length, errUlt);
}
check();
