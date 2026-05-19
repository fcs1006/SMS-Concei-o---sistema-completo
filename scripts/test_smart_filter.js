const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const { buscarSolicitacoesSisreg } = require('../dist/lib/sisreg.js'); // compile or require from local ts file using tsx

async function run() {
  console.log('--- TESTANDO FILTRO INTELIGENTE SISREG DIRECTAMENTE DO CÓDIGO ---');
  
  // Como estamos testando arquivo TS, vamos importar dinamicamente o tsx ou rodar diretamente
  try {
    const { buscarSolicitacoesSisreg } = require('./../lib/sisreg');
  } catch (err) {
    // Se falhar a importação de TS no Node puro, usamos o tsx para rodar
  }
}
