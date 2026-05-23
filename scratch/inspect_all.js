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
  
  // Just match_all to see what a document looks like
  const queryBody = {
    query: {
      match_all: {}
    },
    size: 5
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
    console.log(`Total hits in index: ${data.hits?.total?.value || data.hits?.total}`);
    
    hits.forEach((hit, idx) => {
      console.log(`\nDocument ${idx + 1}:`);
      console.log(JSON.stringify(hit._source, null, 2));
    });
  } catch (error) {
    console.error('Error during query:', error.message);
  }
}

run();
