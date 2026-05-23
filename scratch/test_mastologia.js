const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const USER = process.env.SISREG_USER;
const PASSWORD = process.env.SISREG_PASSWORD;
const URL_BASE = process.env.SISREG_URL || 'https://sisreg-es.saude.gov.br';
const INDEX = process.env.SISREG_INDEX || 'solicitacao-ambulatorial-to-conceicao-do-tocantins';

async function run() {
  const auth = Buffer.from(`${USER}:${PASSWORD}`).toString('base64');
  const url = `${URL_BASE.replace(/\/$/, '')}/${INDEX}/_search`;
  
  // Query to find documents with date range and matching mastologia or masto
  const queryBody = {
    query: {
      bool: {
        must: [
          {
            range: {
              data_solicitacao: {
                gte: '2025-01-01T00:00:00Z',
                lte: '2026-05-22T23:59:59Z'
              }
            }
          },
          {
            bool: {
              should: [
                { match_phrase: { "procedimentos.descricao_interna": "mastologia" } },
                { match_phrase: { "procedimentos.descricao_sigtap": "mastologia" } },
                { match_phrase: { "descricao_interna_procedimento": "mastologia" } },
                { match_phrase: { "no_procedimento": "mastologia" } },
                { match_phrase: { "procedimentos.descricao_interna": "masto" } },
                { match_phrase: { "procedimentos.descricao_sigtap": "masto" } },
                { match_phrase: { "descricao_interna_procedimento": "masto" } },
                { match_phrase: { "no_procedimento": "masto" } }
              ],
              minimum_should_match: 1
            }
          }
        ]
      }
    },
    size: 1000,
    sort: [{ data_solicitacao: { order: 'asc' } }]
  };

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${auth}`
      },
      body: JSON.stringify(queryBody)
    });

    const data = await res.json();
    const hits = data.hits?.hits || [];
    console.log(`Found ${hits.length} records matching Mastologia between 01/01/2025 and 22/05/2026`);
    
    if (hits.length > 0) {
      console.log('\nSample procedures found:');
      const uniqueProcs = new Set();
      hits.forEach(hit => {
        const s = hit._source || {};
        const procName = s.procedimentos?.[0]?.descricao_interna || s.no_procedimento || s.descricao_interna_procedimento || 'N/A';
        uniqueProcs.add(procName);
      });
      console.log(Array.from(uniqueProcs));
      
      // Let's print details of the first 3
      console.log('\nFirst 3 records detail:');
      hits.slice(0, 3).forEach((hit, idx) => {
        const s = hit._source || {};
        console.log(`\nRecord ${idx + 1}:`);
        console.log({
          codigo_solicitacao: s.codigo_solicitacao || s.co_solicitacao,
          data_solicitacao: s.data_solicitacao,
          no_usuario: s.no_usuario,
          cpf_usuario: s.cpf_usuario,
          cns_usuario: s.cns_usuario,
          procedimento: s.procedimentos?.[0]?.descricao_interna || s.no_procedimento || s.descricao_interna_procedimento,
          status: s.status_solicitacao || s.no_situacao_solicitacao
        });
      });
    }
  } catch (error) {
    console.error('Error during query:', error.message);
  }
}

run();
