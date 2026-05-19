import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

import { buscarSolicitacoesSisreg } from '../lib/sisreg';

// Função auxiliar simulando a lógica de formatação da ferramenta buscar_sisreg
function formatarResultados(solicitacoes: any[], tipoBusca: string): string {
  if (solicitacoes.length === 0) return `Nenhuma solicitação encontrada para este paciente.`;

  if (solicitacoes.length === 1 && solicitacoes[0].codigo_procedimento === 'NENHUM_ATIVO') {
    return `Paciente identificado no SISREG, mas não possui nenhuma solicitação ativa ou pendente de *${tipoBusca}* no momento.`;
  }

  // Separa as solicitações ativas normais das que possuem problemas (devolvido/negado)
  const ativas = solicitacoes.filter(s => {
    const status = (s.status || '').toUpperCase();
    return !status.includes('DEVOLVI') && !status.includes('NEGA') && !status.includes('REJEIT') && s.codigo_procedimento !== 'NENHUM_ATIVO';
  });

  const problemas = solicitacoes.filter(s => {
    const status = (s.status || '').toUpperCase();
    return status.includes('DEVOLVI') || status.includes('NEGA') || status.includes('REJEIT');
  });

  // Constrói o texto das ativas
  const formatadasAtivas = ativas.map((s: any) => {
    const procedimento = s.procedimento;
    const dataSolicitacao = s.data_solicitacao ? s.data_solicitacao.split('T')[0].split('-').reverse().join('/') : '—';
    const dataMarcacao = s.data_marcacao ? s.data_marcacao.split('T')[0].split('-').reverse().join('/') : null;
    
    let posicaoStr = '';
    if (s.posicao_fila) {
       posicaoStr = `\n  Sua posição na fila: ${s.posicao_fila}º`;
    }

    let resposta = `• ${procedimento.toUpperCase()}\n  Tipo: ${s.tipo}\n  Situação: ${s.status}`;
    if (dataMarcacao) {
      resposta += `\n  📅 AGENDADO PARA: *${dataMarcacao}*`;
      if (s.unidade_executante) resposta += `\n  📍 LOCAL: ${s.unidade_executante}`;
    } else {
      resposta += `\n  Data de inserção: ${dataSolicitacao}${posicaoStr}`;
    }
    return resposta;
  });

  // Constrói o texto das com problemas (devolvidos/negados)
  const formatadasProblemas = problemas.map((s: any) => {
    const procedimento = s.procedimento;
    const dataSolicitacao = s.data_solicitacao ? s.data_solicitacao.split('T')[0].split('-').reverse().join('/') : '—';
    return `• *${procedimento.toUpperCase()}*\n  Situação: ❌ *${s.status}*\n  Data de inserção: ${dataSolicitacao}`;
  });

  const outputParts: string[] = [];

  if (formatadasAtivas.length > 0) {
    outputParts.push(formatadasAtivas.join('\n\n'));
  }

  if (formatadasProblemas.length > 0) {
    const avisoProblema = `⚠️ *Pendente de Correção / Recusado:*\n\n${formatadasProblemas.join('\n\n')}\n\n*Por favor, entre em contato imediatamente com a Secretaria de Saúde para regularizar seu pedido:* \n📞 Telefone/WhatsApp: *(63) 99130-6916*\n\nOu digite *#humano* para que eu te transfira para um atendente agora mesmo.`;
    outputParts.push(avisoProblema);
  }

  return outputParts.join('\n\n═══════════════════════\n\n');
}

// Simulação de resposta final no webhook
function formatarRespostaFinalWebhook(resultado: string): string {
  if (resultado.includes('Nenhuma solicitação encontrada')) {
    return `❌ *Paciente não encontrado.*\n\nNenhum registro foi localizado no SISREG com este CPF/CNS. Verifique se digitou os números corretos ou ligue para a SMS: *(63) 99130-6916*`;
  } else if (resultado.includes('não possui nenhuma solicitação ativa')) {
    return `ℹ️ *Tudo em dia!*\n\n${resultado}`;
  } else {
    return `📋 *Resultado da sua busca:*\n\n${resultado}`;
  }
}

async function run() {
  console.log('--- INICIANDO TESTE DO FILTRO INTELIGENTE E DEVOLVIDOS/NEGADOS ---\n');

  // TESTE 1: CPF REAL SEM ATIVOS
  const cpfTeste = '13732504700';
  console.log(`=== TESTE 1: CPF REAL SEM ATIVOS (${cpfTeste}) ===`);
  try {
    const resultadosReal = await buscarSolicitacoesSisreg(cpfTeste, 'exame');
    const toolOutput = formatarResultados(resultadosReal, 'exame');
    const finalChatbotMsg = formatarRespostaFinalWebhook(toolOutput);
    console.log('\n💬 Resposta do Chatbot enviada ao paciente:');
    console.log('----------------------------------------------------');
    console.log(finalChatbotMsg);
    console.log('----------------------------------------------------');
  } catch (err: any) {
    console.error('Erro no Teste 1:', err.message);
  }

  console.log('\n');

  // TESTE 2: PACIENTE COM PENDÊNCIA (SIMULADO)
  console.log(`=== TESTE 2: PACIENTE SIMULADO COM CONSULTA PENDENTE E EXAME DEVOLVIDO ===`);
  
  const solicitacoesSimuladas = [
    {
      codigo_procedimento: '0301010072',
      procedimento: 'CONSULTA EM ORTOPEDIA',
      data_solicitacao: '2026-04-10T10:00:00Z',
      data_marcacao: null,
      status: 'SOLICITADO / PENDENTE',
      unidade_executante: null,
      classificacao_risco: 2,
      nascimento: '1985-05-15',
      tipo: 'Consulta',
      posicao_fila: 14
    },
    {
      codigo_procedimento: '0205020046',
      procedimento: 'ULTRASSONOGRAFIA OBSTETRICA',
      data_solicitacao: '2026-05-01T08:00:00Z',
      data_marcacao: null,
      status: 'AGENDAMENTO / DEVOLVIDA / SOLICITANTE',
      unidade_executante: null,
      classificacao_risco: 3,
      nascimento: '1985-05-15',
      tipo: 'Exame'
    }
  ];

  const toolOutputSimulado = formatarResultados(solicitacoesSimuladas, 'ambos');
  const finalChatbotMsgSimulado = formatarRespostaFinalWebhook(toolOutputSimulado);
  console.log('\n💬 Resposta do Chatbot enviada ao paciente:');
  console.log('----------------------------------------------------');
  console.log(finalChatbotMsgSimulado);
  console.log('----------------------------------------------------');
}

run();
