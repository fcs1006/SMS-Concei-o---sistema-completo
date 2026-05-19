import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

import { buscarSolicitacoesSisreg } from '../lib/sisreg';

async function run() {
  console.log('--- INICIANDO TESTE DO FILTRO INTELIGENTE DO FRANCISCO (SISREG) ---\n');

  const cpfTeste = '13732504700';

  try {
    console.log(`Buscando EXAMES para o CPF ${cpfTeste}...`);
    const resultadosExame = await buscarSolicitacoesSisreg(cpfTeste, 'exame');
    
    console.log('\nResultados retornados pela função:');
    console.log(JSON.stringify(resultadosExame, null, 2));

    console.log('\n--- SIMULANDO PROCESSAMENTO DO WEBHOOK ---');
    if (resultadosExame.length === 1 && resultadosExame[0].codigo_procedimento === 'NENHUM_ATIVO') {
      const toolOutput = `Paciente identificado no SISREG, mas não possui nenhuma solicitação ativa ou pendente de *exame* no momento.`;
      console.log('🗣️ Retorno da ferramenta buscar_sisreg:');
      console.log(`> "${toolOutput}"`);
      
      const webhookResponse = `ℹ️ *Tudo em dia!*\n\n${toolOutput}`;
      console.log('\n💬 Resposta final enviada ao paciente pelo Chatbot:');
      console.log('----------------------------------------------------');
      console.log(webhookResponse);
      console.log('----------------------------------------------------');
    } else {
      console.log('Erro: O filtro inteligente deveria ter ocultado todos os exames passados e cancelados!');
    }

  } catch (error: any) {
    console.error('❌ Erro durante o teste:', error.message);
  }
}

run();
