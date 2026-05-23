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
                    { match: { 'procedimentos.descricao_interna': 'mamografia' } },
                    { match: { 'procedimentos.descricao_sigtap': 'mamografia' } },
                    { match: { 'procedimentos.descricao_interna': 'mama' } },
                    { match: { 'procedimentos.descricao_sigtap': 'mama' } }
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
    console.log(`Found ${hits.length} records matching Breast Imaging between 01/01/2025 and 22/05/2026`);
    
    if (hits.length > 0) {
      console.log('\nAll unique procedures found:');
      const uniqueProcs = new Set();
      hits.forEach(hit => {
        const s = hit._source || {};
        s.procedimentos?.forEach(p => {
          uniqueProcs.add(p.descricao_interna || p.descricao_sigtap || 'N/A');
        });
      });
      console.log(Array.from(uniqueProcs));
      
      // Save raw data to a json file
      const records = hits.map(h => h._source);
      const fs = require('fs');
      fs.writeFileSync(path.resolve(__dirname, 'imaging_dump.json'), JSON.stringify(records, null, 2), 'utf8');
      console.log(`Saved ${records.length} records to scratch/imaging_dump.json successfully.`);
    }
  } catch (error) {
    console.error('Error during query:', error.message);
  }
}

run();
