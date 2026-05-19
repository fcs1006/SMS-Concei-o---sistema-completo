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
  
  // Busca direta pelo CPF sem filtros de procedimento
  const queryBody = {
    query: {
      bool: {
        must: [
          { match: { cpf_usuario: '13732504700' } }
        ]
      }
    },
    size: 1
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
    if (hits.length > 0) {
      console.log('\n--- ELASTICSEARCH RAW SOURCE DOCUMENT ---');
      console.log(JSON.stringify(hits[0]._source, null, 2));
    } else {
      console.log('Nenhum registro encontrado para este CPF.');
    }
  } catch (error) {
    console.error('Erro ao buscar:', error.message);
  }
}

run();
