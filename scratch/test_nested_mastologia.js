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
            nested: {
              path: 'procedimentos',
              query: {
                bool: {
                  should: [
                    { match: { 'procedimentos.descricao_interna': 'mastologia' } },
                    { match: { 'procedimentos.descricao_sigtap': 'mastologia' } },
                    { match: { 'procedimentos.descricao_interna': 'mastologista' } },
                    { match: { 'procedimentos.descricao_sigtap': 'mastologista' } },
                    { match: { 'procedimentos.descricao_interna': 'masto' } },
                    { match: { 'procedimentos.descricao_sigtap': 'masto' } }
                  ],
                  minimum_should_match: 1
                }
              }
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
      console.log('\nAll unique procedures found:');
      const uniqueProcs = new Set();
      hits.forEach(hit => {
        const s = hit._source || {};
        const procName = s.procedimentos?.[0]?.descricao_interna || s.procedimentos?.[0]?.descricao_sigtap || 'N/A';
        uniqueProcs.add(procName);
      });
      console.log(Array.from(uniqueProcs));
      
      // Let's print details of the first few
      console.log('\nAll records:');
      hits.forEach((hit, idx) => {
        const s = hit._source || {};
        console.log(`${idx + 1}. [${s.data_solicitacao}] Patient: ${s.no_usuario} | CPF: ${s.cpf_usuario} | Proc: ${s.procedimentos?.[0]?.descricao_interna} | Status: ${s.status_solicitacao}`);
      });
    }
  } catch (error) {
    console.error('Error during query:', error.message);
  }
}

run();
