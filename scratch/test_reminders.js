require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Obter a data de amanhã no fuso de America/Araguaina
const timezone = 'America/Araguaina';
const nowInTz = new Date(new Date().toLocaleString('en-US', { timeZone: timezone }));
const tomorrowInTz = new Date(nowInTz);
tomorrowInTz.setDate(tomorrowInTz.getDate() + 1);
const tomorrowStr = tomorrowInTz.toLocaleDateString('sv-SE', { timeZone: timezone });

const TEST_CPF = '99999999999';
const TEST_TEL = '63999999999';
const TEST_NAME = 'PACIENTE TESTE LEMBRETE';

async function setupTestData() {
  console.log('--- Configurando dados de teste ---');
  
  // 1. Inserir ou atualizar paciente de teste
  const { error: pacErr } = await supabase.from('pacientes').upsert({
    nome: TEST_NAME,
    cpf_cns: TEST_CPF,
    telefone: TEST_TEL,
    dt_nasc: '1990-01-01',
    sexo: 'M',
    endereco: 'RUA DOS TESTES, 123',
    bairro: 'CENTRO'
  }, { onConflict: 'cpf_cns' });
  
  if (pacErr) console.error('Erro ao criar paciente de teste:', pacErr.message);
  else console.log('✅ Paciente de teste configurado.');

  // Limpar agendamentos anteriores do CPF de teste para amanhã
  await supabase.from('especialidades_agendamentos').delete().eq('paciente_cns', TEST_CPF);
  await supabase.from('viagens').delete().eq('paciente_cpf', TEST_CPF);
  try {
    await supabase.from('monitoramento_sisreg').delete().eq('cpf_usuario', TEST_CPF);
  } catch(e) {}
  await supabase.from('lembretes_enviados').delete().eq('telefone', '5563999999999');

  // 2. Criar agendamento de especialidade local
  const { error: espErr } = await supabase.from('especialidades_agendamentos').insert({
    especialidade: 'ortopedia',
    paciente_nome: TEST_NAME,
    paciente_cns: TEST_CPF,
    data_consulta: tomorrowStr,
    data_atendimento: tomorrowStr,
    status: 'autorizado',
    telefone: TEST_TEL,
    tipo_exame: 'Primeira Consulta',
    profissional_nome: 'DR. TESTE DE ORTOPEDIA',
    periodo: 'Matutino',
    mes: tomorrowStr.substring(5, 7),
    ano: tomorrowStr.substring(0, 4)
  });

  if (espErr) console.error('Erro ao criar agendamento especialidade:', espErr.message);
  else console.log('✅ Agendamento de especialidade criado.');

  // 3. Criar viagem TFD
  const { error: viaErr } = await supabase.from('viagens').insert({
    data_viagem: tomorrowStr,
    hora: '05:30',
    paciente_cpf: TEST_CPF,
    paciente_nome: TEST_NAME,
    destino: 'CONCEIÇÃO/PALMAS - CARRO',
    local_destino: 'HOSPITAL GERAL DE PALMAS',
    tem_acomp: 'SIM',
    acomp1_nome: 'ACOMPANHANTE TESTE 1',
    acomp1_cpf: '88888888888',
    agendado_por: 'TEST_RUNNER',
    competencia: tomorrowStr.substring(5, 7) + '/' + tomorrowStr.substring(0, 4)
  });

  if (viaErr) console.error('Erro ao criar viagem TFD:', viaErr.message);
  else console.log('✅ Viagem TFD criada.');

  // 4. Criar registro SISREG (se tabela existir)
  try {
    const { error: sisErr } = await supabase.from('monitoramento_sisreg').insert({
      codigo_solicitacao: 99999999999,
      data_solicitacao: new Date().toISOString(),
      data_marcacao: `${tomorrowStr}T09:15:00`,
      no_usuario: TEST_NAME,
      cns_usuario: TEST_CPF,
      cpf_usuario: TEST_CPF,
      telefone: TEST_TEL,
      codigo_interno_procedimento: '0201010010',
      descricao_interna_procedimento: 'EXAME TESTE DE SISREG',
      nome_unidade_solicitante: 'CLINICA MODELO SISREG',
      status_solicitacao: 'AGENDADO / CONFIRMADO'
    });
    
    if (sisErr) {
      console.warn('⚠️ Tabela monitoramento_sisreg pode não existir ou deu erro:', sisErr.message);
    } else {
      console.log('✅ Registro SISREG criado.');
    }
  } catch (e) {
    console.log('⚠️ Tabela monitoramento_sisreg não disponível no banco de dados.');
  }
}

async function verifyRemindersSent() {
  console.log('\n--- Verificando envios no banco de dados ---');
  
  // Buscar na tabela lembretes_enviados
  const { data: logs, error: logsErr } = await supabase
    .from('lembretes_enviados')
    .select('*')
    .eq('telefone', '5563999999999');

  if (logsErr) {
    console.error('Erro ao ler logs de lembretes:', logsErr.message);
  } else {
    console.log(`Logs gravados em lembretes_enviados: ${logs.length}`);
    logs.forEach(l => {
      console.log(`- Tipo: ${l.tipo}, Ref ID: ${l.referencia_id}, Msg: ${l.mensagem.split('\n')[0]}`);
    });
  }

  // Buscar em whatsapp_conversas
  const { data: convs, error: convsErr } = await supabase
    .from('whatsapp_conversas')
    .select('*')
    .eq('telefone', '5563999999999');

  if (convsErr) {
    console.error('Erro ao ler conversas:', convsErr.message);
  } else {
    console.log(`Conversas gravadas em whatsapp_conversas: ${convs.length}`);
    convs.forEach(c => {
      console.log(`- [${c.papel}]: ${c.mensagem.split('\n')[0]}`);
    });
  }
}

async function cleanupTestData() {
  console.log('\n--- Limpando dados de teste ---');
  await supabase.from('especialidades_agendamentos').delete().eq('paciente_cns', TEST_CPF);
  await supabase.from('viagens').delete().eq('paciente_cpf', TEST_CPF);
  try {
    await supabase.from('monitoramento_sisreg').delete().eq('cpf_usuario', TEST_CPF);
  } catch(e) {}
  await supabase.from('lembretes_enviados').delete().eq('telefone', '5563999999999');
  await supabase.from('whatsapp_conversas').delete().eq('telefone', '5563999999999');
  await supabase.from('pacientes').delete().eq('cpf_cns', TEST_CPF);
  console.log('✅ Limpeza concluída.');
}

async function run() {
  try {
    await setupTestData();

    console.log('\n--- Chamando a API de Lembretes localmente ---');
    const response = await fetch('http://localhost:3000/api/whatsapp/lembretes?token=sms-conceicao-cron-secret-12345', {
      method: 'GET'
    });

    const data = await response.json();
    console.log('API Response:', JSON.stringify(data, null, 2));

    await verifyRemindersSent();
  } catch (error) {
    console.error('❌ Erro no fluxo do teste:', error.message);
  } finally {
    await cleanupTestData();
  }
}

run();
