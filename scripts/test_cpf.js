const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const USER = process.env.SISREG_USER;
const PASSWORD = process.env.SISREG_PASSWORD;
const URL_BASE = process.env.SISREG_URL || 'https://sisreg-es.saude.gov.br';
const INDEX = process.env.SISREG_INDEX || 'solicitacao-ambulatorial-to-conceicao-do-tocantins';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function montarQueryBase(busca, tipo) {
  const soDigitos = busca.replace(/\D/g, '');
  let userQuery = {};

  if (soDigitos.length === 11) {
    userQuery = { match: { cpf_usuario: soDigitos } };
  } else if (soDigitos.length === 15) {
    userQuery = { match: { cns_usuario: soDigitos } };
  } else {
    userQuery = { match_phrase: { no_usuario: busca.toUpperCase() } };
  }

  const mustClauses = [userQuery];

  if (tipo !== 'ambos') {
    let prefixoCodigo = '';
    if (tipo === 'consulta') prefixoCodigo = '03';
    if (tipo === 'exame') prefixoCodigo = '02';

    mustClauses.push({
      bool: {
        should: [
          { wildcard: { "codigo_interno_procedimento": `${prefixoCodigo}*` } },
          { wildcard: { "co_procedimento": `${prefixoCodigo}*` } },
          { wildcard: { "procedimentos.codigo_sigtap": `${prefixoCodigo}*` } },
          { wildcard: { "procedimentos.codigo_interno": `${prefixoCodigo}*` } }
        ],
        minimum_should_match: 1
      }
    });
  }

  return {
    query: {
      bool: {
        must: mustClauses
      }
    }
  };
}

async function testarCPF() {
  const cpfBusca = '13732504700';
  console.log(`\n--- BUSCANDO CPF ${cpfBusca} NO SISREG (ELASTICSEARCH) ---`);

  if (!USER || !PASSWORD) {
    console.error('❌ Erro: Credenciais SISREG não definidas no .env.local!');
    return;
  }

  const auth = Buffer.from(`${USER}:${PASSWORD}`).toString('base64');
  const url = `${URL_BASE.replace(/\/$/, '')}/${INDEX}/_search`;
  const queryBody = {
    ...montarQueryBase(cpfBusca, 'ambos'),
    size: 10,
    sort: [{ data_solicitacao: { order: 'desc' } }],
  };

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${auth}`,
      },
      body: JSON.stringify(queryBody),
    });

    const rawText = await response.text();
    if (!response.ok) {
      console.error('❌ Erro da API SISREG:', rawText);
    } else {
      const data = JSON.parse(rawText);
      const hits = data.hits?.hits || [];
      console.log(`✅ Busca no Elasticsearch retornou ${hits.length} registros.`);
      hits.forEach((h, i) => {
        const s = h._source || {};
        console.log(`\nRegistro ${i + 1} (ES):`);
        console.log(`- Nome: ${s.no_usuario}`);
        console.log(`- CPF: ${s.cpf_usuario}`);
        console.log(`- Procedimento: ${s.no_procedimento || s.descricao_interna_procedimento}`);
        console.log(`- Data Solicitação: ${s.data_solicitacao}`);
        console.log(`- Status: ${s.status_solicitacao || s.no_situacao_solicitacao}`);
      });
    }
  } catch (error) {
    console.error('❌ Erro de conexão no Elasticsearch:', error.message);
  }

  console.log(`\n--- BUSCANDO CPF ${cpfBusca} NO SUPABASE (LOCAL) ---`);
  try {
    const { data: dbData, error: dbError } = await supabase
      .from('monitoramento_sisreg')
      .select('*')
      .eq('cpf_usuario', cpfBusca)
      .order('data_solicitacao', { ascending: false });

    if (dbError) {
      console.error('❌ Erro no Supabase:', dbError.message);
    } else {
      console.log(`✅ Supabase retornou ${dbData.length} registros.`);
      dbData.forEach((p, i) => {
        console.log(`\nRegistro ${i + 1} (DB):`);
        console.log(`- Nome: ${p.no_usuario}`);
        console.log(`- Procedimento: ${p.descricao_interna_procedimento}`);
        console.log(`- Data Solicitação: ${p.data_solicitacao}`);
        console.log(`- Status: ${p.status_solicitacao}`);
      });
    }
  } catch (error) {
    console.error('❌ Erro de conexão com Supabase:', error.message);
  }
}

testarCPF();
