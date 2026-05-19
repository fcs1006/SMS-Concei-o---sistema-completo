const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const USER = process.env.SISREG_USER;
const PASSWORD = process.env.SISREG_PASSWORD;
const URL_BASE = process.env.SISREG_URL || 'https://sisreg-es.saude.gov.br';
const INDEX = process.env.SISREG_INDEX || 'solicitacao-ambulatorial-to-conceicao-do-tocantins';

async function testQuery(name, queryClause) {
  const auth = Buffer.from(`${USER}:${PASSWORD}`).toString('base64');
  const url = `${URL_BASE.replace(/\/$/, '')}/${INDEX}/_search`;

  const queryBody = {
    query: {
      bool: {
        must: [
          { match: { cpf_usuario: '13732504700' } },
          queryClause
        ]
      }
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
    console.log(`- Query [${name}] returned: ${hits.length} hits`);
  } catch (error) {
    console.error(`- Query [${name}] failed:`, error.message);
  }
}

async function run() {
  console.log('--- TESTANDO QUERIES DE FILTRO NO ELASTICSEARCH ---');

  // Teste 1: Original Wildcard
  await testQuery('Original Wildcard (02*)', {
    bool: {
      should: [
        { wildcard: { "codigo_interno_procedimento": "02*" } },
        { wildcard: { "co_procedimento": "02*" } },
        { wildcard: { "procedimentos.codigo_sigtap": "02*" } },
        { wildcard: { "procedimentos.codigo_interno": "02*" } }
      ],
      minimum_should_match: 1
    }
  });

  // Teste 2: Wildcard com .keyword
  await testQuery('Wildcard com .keyword (02*)', {
    bool: {
      should: [
        { wildcard: { "procedimentos.codigo_sigtap.keyword": "02*" } },
        { wildcard: { "procedimentos.codigo_interno.keyword": "02*" } }
      ],
      minimum_should_match: 1
    }
  });

  // Teste 3: Prefix Query
  await testQuery('Prefix Query (02)', {
    bool: {
      should: [
        { prefix: { "procedimentos.codigo_sigtap": "02" } },
        { prefix: { "procedimentos.codigo_interno": "02" } }
      ],
      minimum_should_match: 1
    }
  });

  // Teste 4: Prefix Query com .keyword
  await testQuery('Prefix Query com .keyword (02)', {
    bool: {
      should: [
        { prefix: { "procedimentos.codigo_sigtap.keyword": "02" } },
        { prefix: { "procedimentos.codigo_interno.keyword": "02" } }
      ],
      minimum_should_match: 1
    }
  });
}

run();
