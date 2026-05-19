const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function run() {
  console.log('Buscando exemplos de pacientes sincronizados...');
  const { data, error } = await supabase
    .from('monitoramento_sisreg')
    .select('no_usuario, cpf_usuario, cns_usuario, descricao_interna_procedimento, status_solicitacao')
    .limit(3);

  if (error) {
    console.error('Erro ao buscar do Supabase:', error.message);
    return;
  }

  console.log('\n--- PACIENTES DISPONÍVEIS PARA TESTE NO FRANCISCO ---');
  data.forEach((p, idx) => {
    console.log(`\nExemplo ${idx + 1}:`);
    console.log(`- Nome: ${p.no_usuario}`);
    console.log(`- CPF: ${p.cpf_usuario || 'Não informado'}`);
    console.log(`- CNS: ${p.cns_usuario || 'Não informado'}`);
    console.log(`- Procedimento: ${p.descricao_interna_procedimento}`);
    console.log(`- Status: ${p.status_solicitacao}`);
  });
}

run();
