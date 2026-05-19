import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI, FunctionDeclaration, SchemaType } from '@google/generative-ai'
import { createClient } from '@supabase/supabase-js'
import { buscarSolicitacoesSisreg, SisregSolicitacaoComFila } from '../../../../lib/sisreg'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '')

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const EVOLUTION_URL = process.env.EVOLUTION_API_URL!
const EVOLUTION_KEY = process.env.EVOLUTION_API_KEY!
const EVOLUTION_INSTANCE = process.env.EVOLUTION_INSTANCE!
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash'
const TELEFONE_TESTE = '5500000000000'

// ── Verifica horário de funcionamento (desativado para testes) ───────────────
function dentroDoHorario(): boolean {
  return true // TODO: reativar após testes
  // const agora = new Date().toLocaleString('en-US', { timeZone: 'America/Araguaina' })
  // const hora = new Date(agora)
  // const h = hora.getHours()
  // const diaSemana = hora.getDay() // 0=dom, 6=sáb
  // if (diaSemana === 0 || diaSemana === 6) return false
  // return (h >= 7 && h < 11) || (h >= 13 && h < 17)
}

// ── Ferramentas do Francisco ─────────────────────────────────────────────────
const tools: FunctionDeclaration[] = [
  {
    name: 'escalar_para_humano',
    description: 'Chama um atendente humano quando Francisco não consegue resolver a solicitação, quando o assunto é muito específico, sensível ou requer intervenção humana.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        motivo: { type: SchemaType.STRING, description: 'Motivo pelo qual está escalando para atendimento humano' }
      },
      required: ['motivo']
    }
  },
  {
    name: 'buscar_agendamentos',
    description: 'Busca agendamentos de consultas e exames de especialidades do paciente pelo nome ou CPF/CNS. Retorna especialidade, tipo de exame, data, status e profissional.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        busca: { type: SchemaType.STRING, description: 'Nome do paciente ou CPF/CNS (com ou sem máscara)' }
      },
      required: ['busca']
    }
  },
  {
    name: 'buscar_paciente',
    description: 'Busca dados cadastrais do paciente (nome, CPF/CNS, data de nascimento, telefone, endereço) na base da secretaria.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        busca: { type: SchemaType.STRING, description: 'Nome do paciente ou CPF/CNS' }
      },
      required: ['busca']
    }
  },
  {
    name: 'buscar_tfd',
    description: 'Busca viagens de TFD (Tratamento Fora do Domicílio) do paciente. Retorna destino, data e horário da viagem.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        busca: { type: SchemaType.STRING, description: 'Nome do paciente ou CPF' },
        data: { type: SchemaType.STRING, description: 'Data no formato YYYY-MM-DD (opcional, para filtrar por data)' }
      },
      required: ['busca']
    }
  },
  {
    name: 'informacoes_secretaria',
    description: 'Retorna informações gerais sobre a Secretaria Municipal de Saúde de Conceição do Tocantins.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        assunto: { type: SchemaType.STRING, description: 'Assunto da dúvida (horário, endereço, serviços, contato, etc.)' }
      },
      required: ['assunto']
    }
  },
  {
    name: 'buscar_sisreg',
    description: 'Consulta o sistema estadual SISREG para verificar o status de solicitações de consultas e exames de média e alta complexidade.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        busca: { type: SchemaType.STRING, description: 'CPF ou Nome do paciente' }
      },
      required: ['busca']
    }
  }
]

// ── Execução das ferramentas ─────────────────────────────────────────────────
async function executarFerramenta(nome: string, input: any, telefone: string): Promise<string> {
  try {
    if (nome === 'escalar_para_humano') {
      await setEstado(telefone, 'aguardando_humano')
      await supabase.from('whatsapp_conversas').insert([{
        telefone,
        papel: 'sistema',
        mensagem: `🔴 ESCALONADO: ${input.motivo}`
      }])
      
      const avisoAtendente = `🚨 *[SUPORTE HUMANO SOLICITADO]* 🚨\n\n👤 *Paciente:* +${telefone}\n⚠️ *Motivo:* ${input.motivo}\n\n👉 *Atendentes:* Por favor, assumam a conversa diretamente por aqui. Ao finalizar, digitem *#fim* ou *#bot* para reativar o Francisco.`
      await enviarMensagem(telefone, avisoAtendente)
      return 'ESCALONADO'
    }

    if (nome === 'buscar_agendamentos') {
      const soDigitos = input.busca.replace(/\D/g, '')
      let query = supabase
        .from('especialidades_agendamentos')
        .select('especialidade, paciente_nome, paciente_cns, data_consulta, tipo_exame, status, profissional_nome, mes, ano')
        .neq('status', 'excluido')
        .order('data_consulta', { ascending: false })
        .limit(10)

      if (soDigitos.length >= 6) {
        query = query.ilike('paciente_cns', `%${soDigitos}%`)
      } else {
        query = query.ilike('paciente_nome', `%${input.busca.toUpperCase()}%`)
      }

      const { data, error } = await query
      if (error) return `Erro ao buscar: ${error.message}`
      if (!data || data.length === 0) return 'Nenhum agendamento encontrado para este paciente.'

      return data.map(a => {
        const data_fmt = a.data_consulta ? a.data_consulta.split('-').reverse().join('/') : 'não informada'
        const status_pt: Record<string, string> = { pendente: 'Pendente', autorizado: 'Autorizado ✅', negado: 'Negado ❌' }
        return `• ${a.especialidade?.toUpperCase()} — ${a.tipo_exame || 'consulta'}\n  Status: ${status_pt[a.status] || a.status}\n  Data: ${data_fmt}\n  Profissional: ${a.profissional_nome || 'a definir'}`
      }).join('\n\n')
    }

    if (nome === 'buscar_paciente') {
      const soDigitos = input.busca.replace(/\D/g, '')
      let query = supabase
        .from('pacientes')
        .select('nome, cpf_cns, dt_nasc, telefone, endereco, bairro, cep')
        .limit(5)

      if (soDigitos.length >= 6) {
        query = query.ilike('cpf_cns', `%${soDigitos}%`)
      } else {
        query = query.ilike('nome', `%${input.busca.toUpperCase()}%`)
      }

      const { data, error } = await query
      if (error) return `Erro ao buscar: ${error.message}`
      if (!data || data.length === 0) return 'Paciente não encontrado na base da secretaria.'

      return data.map(p => {
        const nasc = p.dt_nasc ? p.dt_nasc.split('-').reverse().join('/') : 'não informada'
        return `• ${p.nome}\n  CPF/CNS: ${p.cpf_cns || '—'}\n  Nascimento: ${nasc}\n  Telefone: ${p.telefone || '—'}\n  Endereço: ${p.endereco || '—'}, ${p.bairro || '—'}`
      }).join('\n\n')
    }

    if (nome === 'buscar_tfd') {
      const soDigitos = input.busca.replace(/\D/g, '')
      let query = supabase
        .from('viagens')
        .select('paciente_nome, paciente_cpf, destino, data_viagem, hora')
        .order('data_viagem', { ascending: false })
        .limit(10)

      if (soDigitos.length >= 6) {
        query = query.ilike('paciente_cpf', `%${soDigitos}%`)
      } else {
        query = query.ilike('paciente_nome', `%${input.busca.toUpperCase()}%`)
      }

      if (input.data) query = query.eq('data_viagem', input.data)

      const { data, error } = await query
      if (error) return `Erro ao buscar: ${error.message}`
      if (!data || data.length === 0) return 'Nenhuma viagem TFD encontrada para este paciente.'

      return data.map(v => {
        const data_fmt = v.data_viagem ? v.data_viagem.split('-').reverse().join('/') : '—'
        return `• ${data_fmt} às ${v.hora || '—'}\n  Destino: ${v.destino || '—'}\n  Paciente: ${v.paciente_nome}`
      }).join('\n\n')
    }

    if (nome === 'informacoes_secretaria') {
      const infos: Record<string, string> = {
        horario: 'A Secretaria Municipal de Saúde funciona de segunda a sexta-feira, das 7h às 13h.',
        endereco: 'A SMS fica localizada na sede do município de Conceição do Tocantins - TO.',
        servicos: 'Oferecemos: agendamento de consultas e exames especializados, TFD (Tratamento Fora do Domicílio), BPA, cadastro de pacientes, almoxarifado de medicamentos e insumos.',
        tfd: 'O TFD (Tratamento Fora do Domicílio) oferece transporte para pacientes que necessitam de atendimento em outros municípios como Palmas e Porto Nacional.',
        agendamento: 'Para agendar consultas em especialidades (ortopedia, ginecologia, oftalmologia, urologia, USG, psiquiatria), procure a SMS com encaminhamento médico do PSF.',
        contato: `📞 *Contatos da Saúde — Conceição do Tocantins*\n\n🏥 *Secretaria Municipal de Saúde (urgências):*\n(63) 99130-6916\n\n🏨 *UBS Urbana (Postinho):*\n(63) 99130-2450\n\n🔬 *Laboratório:*\n(63) 99132-7974\n\n🛡️ *Vigilância Sanitária:*\n(63) 99131-4490\n\n⏰ Atendimento: seg–sex, 7h–11h e 13h–17h`,
      }

      const assunto = input.assunto.toLowerCase()
      for (const [chave, texto] of Object.entries(infos)) {
        if (assunto.includes(chave)) return texto
      }
      return `Serviços da SMS Conceição do Tocantins:\n• Agendamento de especialidades (ortopedia, ginecologia, oftalmologia, urologia, USG, psiquiatria)\n• TFD — transporte para Palmas e Porto Nacional\n• Cadastro de pacientes\n• Almoxarifado de medicamentos\n\nHorário: segunda a sexta, 7h às 13h.`
    }

    if (nome === 'buscar_sisreg') {
      try {
        const solicitacoes = await buscarSolicitacoesSisreg(input.busca, input.tipo)
        if (solicitacoes.length === 0) return `Nenhuma solicitação encontrada para este paciente.`

        if (solicitacoes.length === 1 && solicitacoes[0].codigo_procedimento === 'NENHUM_ATIVO') {
          return `Paciente identificado no SISREG, mas não possui nenhuma solicitação ativa ou pendente de *${input.tipo}* no momento.`
        }

        const formatadas = solicitacoes.map((s: SisregSolicitacaoComFila) => {
          const procedimento = s.procedimento
          const dataSolicitacao = s.data_solicitacao ? s.data_solicitacao.split('T')[0].split('-').reverse().join('/') : '—'
          const dataMarcacao = s.data_marcacao ? s.data_marcacao.split('T')[0].split('-').reverse().join('/') : null
          
          let posicaoStr = ''
          if (s.posicao_fila) {
             posicaoStr = `\n  Sua posição na fila: ${s.posicao_fila}º`
          }

          let resposta = `• ${procedimento.toUpperCase()}\n  Tipo: ${s.tipo}\n  Situação: ${s.status}`
          if (dataMarcacao) {
            resposta += `\n  📅 AGENDADO PARA: *${dataMarcacao}*`
            if (s.unidade_executante) resposta += `\n  📍 LOCAL: ${s.unidade_executante}`
          } else {
            resposta += `\n  Data de inserção: ${dataSolicitacao}${posicaoStr}`
          }
          return resposta
        })
        
        return formatadas.join('\n\n')
      } catch (e: any) {
        return `Erro interno ao acessar a base local: ${e.message}`
      }
    }

    return 'Ferramenta não reconhecida.'
  } catch (e: any) {
    return `Erro interno: ${e.message}`
  }
}

// ── Envia mensagem de texto via Evolution API ────────────────────────────────
async function enviarMensagem(numero: string, texto: string) {
  if (numero === TELEFONE_TESTE) return

  if (!EVOLUTION_URL || !EVOLUTION_KEY || !EVOLUTION_INSTANCE) {
    throw new Error('Evolution API nao configurada. Configure EVOLUTION_API_URL, EVOLUTION_API_KEY e EVOLUTION_INSTANCE.')
  }

  await fetch(`${EVOLUTION_URL}/message/sendText/${EVOLUTION_INSTANCE}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'apikey': EVOLUTION_KEY },
    body: JSON.stringify({ number: numero, text: texto })
  })
}

// ── Menus em texto (compatível com qualquer conexão WhatsApp) ────────────────
const MENU_PRINCIPAL = `📋 *Como posso ajudar?*

1️⃣ 🏥 Marcar Consulta ou Exame
2️⃣ 🔍 Ver meus agendamentos (Secretaria)
3️⃣ 🩺 Consultar pedido no SISREG (Estado)
4️⃣ 🚗 TFD — Minhas viagens
5️⃣ 💊 Remédios e Farmácia
6️⃣ 🩸 Resultados de Exames (Laboratório)
7️⃣ 📞 Telefones e Endereços úteis
8️⃣ 🗣️ Falar com um Atendente

_Digite o número da opção ou descreva sua dúvida_`

async function enviarMenu(numero: string) {
  await salvarMensagem(numero, 'assistant', MENU_PRINCIPAL)
  await enviarMensagem(numero, MENU_PRINCIPAL)
}

async function getEstadoInfo(telefone: string): Promise<{ estado: string; atualizado_em: string | null }> {
  const { data } = await supabase
    .from('whatsapp_estados')
    .select('estado, atualizado_em')
    .eq('telefone', telefone)
    .maybeSingle()
  return {
    estado: data?.estado || 'menu',
    atualizado_em: data?.atualizado_em || null
  }
}

async function setEstado(telefone: string, estado: string) {
  await supabase.from('whatsapp_estados').upsert(
    { telefone, estado, atualizado_em: new Date().toISOString() },
    { onConflict: 'telefone' }
  )
}

// ── Carrega histórico da conversa ────────────────────────────────────────────
async function carregarHistorico(telefone: string): Promise<{role: string, parts: {text: string}[]}[]> {
  const { data } = await supabase
    .from('whatsapp_conversas')
    .select('papel, mensagem')
    .eq('telefone', telefone)
    .order('criado_em', { ascending: true })
    .limit(20)

  if (!data) return []
  return data.map(r => ({
    role: r.papel === 'assistant' ? 'model' : 'user',
    parts: [{ text: r.mensagem }]
  }))
}

// ── Salva mensagem no histórico ──────────────────────────────────────────────
async function salvarMensagem(telefone: string, papel: string, mensagem: string) {
  await supabase.from('whatsapp_conversas').insert([{ telefone, papel, mensagem }])
}

// ── Webhook principal ────────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    if (body?.event !== 'messages.upsert') return NextResponse.json({ ok: true })
 
    const remoteJid: string = body?.data?.key?.remoteJid || ''
    const telefone = remoteJid.replace('@s.whatsapp.net', '').replace('@g.us', '')
    if (!telefone || remoteJid.includes('@g.us')) return NextResponse.json({ ok: true })
 
    if (body?.data?.key?.fromMe) {
      const msgObj = body?.data?.message
      const textoAtendente = (
        msgObj?.conversation ||
        msgObj?.extendedTextMessage?.text || ''
      ).trim().toLowerCase()
 
      if (['#fim', '#bot', '#voltarbot', '#encerrar'].includes(textoAtendente)) {
        await setEstado(telefone, 'menu')
        const respFinalizar = `✨ A Secretaria Municipal de Saúde agradece o seu contato! O seu atendimento foi finalizado. Tenha um excelente dia! 🏥\n\n_Se precisar de mim novamente, basta enviar uma nova mensagem._`
        await salvarMensagem(telefone, 'assistant', respFinalizar)
        await enviarMensagem(telefone, respFinalizar)
      }
      return NextResponse.json({ ok: true })
    }

    const msgObj = body?.data?.message
    const texto: string =
      msgObj?.conversation ||
      msgObj?.extendedTextMessage?.text ||
      msgObj?.listResponseMessage?.title ||
      msgObj?.buttonsResponseMessage?.selectedDisplayText ||
      msgObj?.imageMessage?.caption || ''

    if (!texto.trim()) return NextResponse.json({ ok: true })

    const historico = await carregarHistorico(telefone)
    await salvarMensagem(telefone, 'user', texto)

    // Fora do horário de funcionamento
    if (!dentroDoHorario()) {
      const respFechado = `Olá! 👋 Sou o Francisco, assistente virtual da SMS Conceição do Tocantins.\n\n⏰ No momento a secretaria está *fechada*.\n\n🕐 Horário de atendimento:\nSegunda a sexta: 7h–11h e 13h–17h\n\n🚨 Em caso de urgência ou emergência, entre em contato *imediatamente*:\n📞 *(63) 99130-6916*`
      await salvarMensagem(telefone, 'assistant', respFechado)
      await enviarMensagem(telefone, respFechado)
      return NextResponse.json({ ok: true })
    }

    const primeiraMsg = historico.length === 0
    const { estado: estadoDB, atualizado_em } = await getEstadoInfo(telefone)

    // Comando de encerramento enviado pelo usuário para reativar o bot (útil também no painel de testes)
    const textoComando = texto.trim().toLowerCase()
    if (['#fim', '#bot', '#voltarbot', '#encerrar'].includes(textoComando)) {
      await setEstado(telefone, 'menu')
      const respFinalizar = `✨ A Secretaria Municipal de Saúde agradece o seu contato! O seu atendimento foi finalizado e o assistente virtual Francisco foi reativado. 🏥\n\n_Se precisar de mim novamente, basta enviar uma nova mensagem._`
      await salvarMensagem(telefone, 'assistant', respFinalizar)
      await enviarMensagem(telefone, respFinalizar)
      return NextResponse.json({ ok: true })
    }

    if (estadoDB === 'aguardando_humano') {
      // Se ficou mais de 2 horas inativo, reseta para o bot para não travar a pessoa para sempre
      const TIMEOUT_HUMANO = 2 * 60 * 60 * 1000 // 2 horas
      if (atualizado_em) {
        const ultimaAtualizacao = new Date(atualizado_em).getTime()
        if (Date.now() - ultimaAtualizacao > TIMEOUT_HUMANO) {
          await setEstado(telefone, 'menu')
          // Continua para o bot normal
        } else {
          // Ainda está sob controle humano
          return NextResponse.json({ ok: true })
        }
      } else {
        return NextResponse.json({ ok: true })
      }
    }
    
    // Inatividade: 5 minutos (5 * 60 * 1000)
    const TIMEOUT_INATIVIDADE = 5 * 60 * 1000
    let estado = estadoDB
    
    if (atualizado_em && estadoDB !== 'menu' && !primeiraMsg) {
      const ultimaAtualizacao = new Date(atualizado_em).getTime()
      const agora = Date.now()
      if (agora - ultimaAtualizacao > TIMEOUT_INATIVIDADE) {
        // Reseta o estado para menu
        await setEstado(telefone, 'menu')
        estado = 'menu'
        
        const respTimeout = `⏱️ *Atendimento finalizado por inatividade*\n\nComo você ficou mais de 5 minutos sem responder, o atendimento anterior foi encerrado. A Secretaria Municipal de Saúde agradece o seu contato! Tenha um excelente dia. 🏥\n\n_Se precisar de mim novamente, basta enviar uma nova mensagem._`
        await salvarMensagem(telefone, 'assistant', respTimeout)
        await enviarMensagem(telefone, respTimeout)
        return NextResponse.json({ ok: true })
      }
    }

    const input = texto.trim()
    const inputNum = input.replace(/[^0-9]/g, '')

    // ── Primeira mensagem: apresentação + menu ───────────────────────────────
    if (primeiraMsg) {
      const apresentacaoMenu = `Olá! 👋 Bem-vindo(a) ao atendimento da *Secretaria Municipal de Saúde de Conceição do Tocantins*.\n\nSou o *Francisco*, seu assistente virtual. Estou aqui para facilitar sua vida com informações da saúde do nosso município.\n\n🚨 *Atenção:* Este canal é exclusivo para informações. Emergências ligue: 📞 *(63) 99130-6916*\n\n${MENU_PRINCIPAL}`
      await setEstado(telefone, 'menu')
      await salvarMensagem(telefone, 'assistant', apresentacaoMenu)
      await enviarMensagem(telefone, apresentacaoMenu)
      return NextResponse.json({ ok: true })
    }

    // ── Palavra-chave para voltar ao menu ────────────────────────────────────
    if (['0', 'menu', 'voltar', 'início', 'inicio'].includes(input.toLowerCase())) {
      await setEstado(telefone, 'menu')
      await salvarMensagem(telefone, 'assistant', MENU_PRINCIPAL)
      await enviarMensagem(telefone, MENU_PRINCIPAL)
      return NextResponse.json({ ok: true })
    }

    if (estado === 'menu' && ['oi', 'ola', 'olá', 'bom dia', 'boa tarde', 'boa noite'].includes(input.toLowerCase())) {
      const apresentacaoMenu = `Olá! 👋 Bem-vindo(a) ao atendimento da *Secretaria Municipal de Saúde de Conceição do Tocantins*.\n\nSou o *Francisco*, seu assistente virtual. Estou aqui para facilitar sua vida com informações da saúde do nosso município.\n\n🚨 *Atenção:* Este canal é exclusivo para informações. Emergências ligue: 📞 *(63) 99130-6916*\n\n${MENU_PRINCIPAL}`
      await salvarMensagem(telefone, 'assistant', apresentacaoMenu)
      await enviarMensagem(telefone, apresentacaoMenu)
      return NextResponse.json({ ok: true })
    }

    if (estado === 'menu' && inputNum) {
      if (inputNum === '1') {
        const resp = `🏥 *Marcar Consulta ou Exame*\n\nVocê deseja marcar:\n1️⃣ *Consulta*\n2️⃣ *Exame*\n\n_Digite o número da opção:_`
        await setEstado(telefone, 'opcao_marcar_tipo')
        await salvarMensagem(telefone, 'assistant', resp)
        await enviarMensagem(telefone, resp)
        return NextResponse.json({ ok: true })
      }
      if (inputNum === '2') {
        const resp = `🔍 *Ver meus agendamentos (SMS)*\n\nInforme seu *CPF* ou *CNS* para eu buscar seus agendamentos na Secretaria de Saúde.`
        await setEstado(telefone, 'buscar_agendamento')
        await salvarMensagem(telefone, 'assistant', resp)
        await enviarMensagem(telefone, resp)
        return NextResponse.json({ ok: true })
      }
      if (inputNum === '3') {
        const resp = `🩺 *Consultar pedido no SISREG (Estado)*\n\nVocê deseja consultar o status de:\n1️⃣ *Consulta*\n2️⃣ *Exame*\n\n_Digite o número da opção:_`
        await setEstado(telefone, 'menu_sisreg_tipo')
        await salvarMensagem(telefone, 'assistant', resp)
        await enviarMensagem(telefone, resp)
        return NextResponse.json({ ok: true })
      }
      if (inputNum === '4') {
        const resp = `🚗 *TFD — Minhas viagens*\n\nInforme seu *CPF* ou *CNS* para eu buscar suas viagens agendadas.`
        await setEstado(telefone, 'buscar_tfd')
        await salvarMensagem(telefone, 'assistant', resp)
        await enviarMensagem(telefone, resp)
        return NextResponse.json({ ok: true })
      }
      if (inputNum === '5') {
        const resp = `💊 *Remédios e Farmácia*\n\nA retirada de medicamentos é feita na *UBS Urbana (Postinho)*.\n📞 *(63) 99130-2450*\n\n_Leve a receita médica atualizada e seu Cartão SUS._`
        await salvarMensagem(telefone, 'assistant', resp)
        await enviarMensagem(telefone, resp)
        await enviarMenu(telefone)
        return NextResponse.json({ ok: true })
      }
      if (inputNum === '6') {
        const resp = `🩸 *Resultados de Exames (Laboratório)*\n\nO laboratório municipal realiza exames e entrega resultados de segunda a sexta, das 7h às 11h.\n📞 *(63) 99132-7974*`
        await salvarMensagem(telefone, 'assistant', resp)
        await enviarMensagem(telefone, resp)
        await enviarMenu(telefone)
        return NextResponse.json({ ok: true })
      }
      if (inputNum === '7') {
        const resp = `📞 *Telefones e Endereços úteis*\n\n🚨 *Urgência/Emergência*: (63) 99130-6916\n🏥 *Sec. de Saúde*: (63) 99130-6916\n🏨 *UBS Urbana (Postinho)*: (63) 99130-2450\n🔬 *Laboratório*: (63) 99132-7974\n🛡️ *Vigilância Sanitária*: (63) 99131-4490`
        await salvarMensagem(telefone, 'assistant', resp)
        await enviarMensagem(telefone, resp)
        await enviarMenu(telefone)
        return NextResponse.json({ ok: true })
      }
      if (inputNum === '8') {
        const resp = `🗣️ Transferindo para um atendente humano... Por favor, aguarde.`
        await executarFerramenta('escalar_para_humano', { motivo: 'Opção do menu selecionada' }, telefone)
        await salvarMensagem(telefone, 'assistant', resp)
        await enviarMensagem(telefone, resp)
        await setEstado(telefone, 'aguardando_humano')
        return NextResponse.json({ ok: true })
      }
    }

    if (estado === 'opcao_marcar_tipo' && inputNum) {
      if (inputNum === '1') {
        const resp = `🩺 *Marcar Consulta*\n\nOnde você deseja realizar a consulta?\n1️⃣ *Na UBS* (Postinho ou Hospital)\n2️⃣ *Com Médico Especialista*\n3️⃣ *Consulta Particular*\n\n_Digite o número da opção:_`
        await setEstado(telefone, 'opcao_marcar_consulta_local')
        await salvarMensagem(telefone, 'assistant', resp)
        await enviarMensagem(telefone, resp)
        return NextResponse.json({ ok: true })
      }
      if (inputNum === '2') {
        const resp = `🔬 *Marcar Exame*\n\nQual tipo de exame você deseja marcar?\n1️⃣ *Exames de Sangue*\n2️⃣ *Prevenção (PCCU)*\n3️⃣ *Ultrassonografia (USG)*\n4️⃣ *Eletrocardiograma*\n5️⃣ *Exame Particular*\n\n_Digite o número da opção:_`
        await setEstado(telefone, 'opcao_marcar_exame_tipo')
        await salvarMensagem(telefone, 'assistant', resp)
        await enviarMensagem(telefone, resp)
        return NextResponse.json({ ok: true })
      }

      const resp = `❌ Opção inválida.\n\nDigite 1 para *Consulta* ou 2 para *Exame*.`
      await salvarMensagem(telefone, 'assistant', resp)
      await enviarMensagem(telefone, resp)
      return NextResponse.json({ ok: true })
    }

    if (estado === 'opcao_marcar_consulta_local' && inputNum) {
      if (inputNum === '1') {
        const resp = `🏥 *Consulta na UBS (Postinho ou Hospital)*\n\n• Para atendimento médico, com dentista ou atualização de vacinas, vá ou ligue na sua UBS:\n\n🌆 *Zona Urbana:*\nUBS Abilio Francisco de Azevedo (Postinho)\n📞 *(63) 99130-2450*\n\n🏡 *Zona Rural:*\nUBS Luiz Francisco de Miranda (Hospital)\n📞 *(63) 99130-6916*\n\n🚨 *Casos de Urgência:*\nVocê pode ir diretamente à UBS Luiz Francisco de Miranda (Hospital) para avaliação. A unidade funciona 24 horas.\n\n❓ *Posso te ajudar em algo mais?*\n1️⃣ Sim\n2️⃣ Não`
        await setEstado(telefone, 'perguntar_mais_ajuda')
        await salvarMensagem(telefone, 'assistant', resp)
        await enviarMensagem(telefone, resp)
        return NextResponse.json({ ok: true })
      }
      if (inputNum === '2') {
        const resp = `✨ *Consulta com Especialista (Saúde Mais Próximo de Você)*\n\n• O atendimento das especialidades acontece uma vez ao mês.\n• Para conseguir o atendimento, você precisa passar primeiro pela consulta na UBS e deixar a cópia do pedido médico na Secretaria de Saúde.\n• Seguimos rigorosamente a ordem de chegada, dos pedidos mais antigos para os mais recentes.\n\n⚠️ *Informação Importante:*\nDeixe sempre seu contato telefônico atualizado! Os dias e horários são informados através do WhatsApp ou por ligação.\nSe você deixou seu pedido há muito tempo, por favor, entre em contato com a secretaria para verificar os dados, pois podemos ter tentado falar com você e não conseguimos.\n\n❓ *Posso te ajudar em algo mais?*\n1️⃣ Sim\n2️⃣ Não`
        await setEstado(telefone, 'perguntar_mais_ajuda')
        await salvarMensagem(telefone, 'assistant', resp)
        await enviarMensagem(telefone, resp)
        return NextResponse.json({ ok: true })
      }
      if (inputNum === '3') {
        const resp = `💼 *Consulta Particular*\n\nVocê já possui a indicação ou encaminhamento médico para esta consulta?\n1️⃣ *Sim, já tenho o pedido/indicação*\n2️⃣ *Não tenho o pedido/indicação*\n\n_Digite o número da opção:_`
        await setEstado(telefone, 'opcao_marcar_particular_consulta_pedido')
        await salvarMensagem(telefone, 'assistant', resp)
        await enviarMensagem(telefone, resp)
        return NextResponse.json({ ok: true })
      }

      const resp = `❌ Opção inválida.\n\nOnde você deseja realizar a consulta?\n1️⃣ Na UBS (Postinho ou Hospital)\n2️⃣ Com Médico Especialista\n3️⃣ Consulta Particular`
      await salvarMensagem(telefone, 'assistant', resp)
      await enviarMensagem(telefone, resp)
      return NextResponse.json({ ok: true })
    }

    if (estado === 'opcao_marcar_exame_tipo' && inputNum) {
      if (inputNum === '1') {
        const resp = `🧪 *Exames de Sangue (Laboratório)*\n\nPara agendar ou tirar dúvidas sobre exames de sangue, entre em contato diretamente com o Laboratório Municipal:\n📞 *(63) 99132-7974*\n\n⏰ Horário de atendimento:\nSegunda a sexta-feira, das 7h às 11h e das 13h às 17h.\n\n❓ *Posso te ajudar em algo mais?*\n1️⃣ Sim\n2️⃣ Não`
        await setEstado(telefone, 'perguntar_mais_ajuda')
        await salvarMensagem(telefone, 'assistant', resp)
        await enviarMensagem(telefone, resp)
        return NextResponse.json({ ok: true })
      }
      if (inputNum === '2') {
        const resp = `🌸 *Prevenção (PCCU)*\n\nPara verificar o agendamento de exames de Prevenção (PCCU), entre em contato com a sua UBS de referência:\n\n🌆 *Zona Urbana (Postinho Abilio):*\n📞 *(63) 99130-2450*\n\n🏡 *Zona Rural (Hospital Luiz):*\n📞 *(63) 99130-6916*\n\n❓ *Posso te ajudar em algo mais?*\n1️⃣ Sim\n2️⃣ Não`
        await setEstado(telefone, 'perguntar_mais_ajuda')
        await salvarMensagem(telefone, 'assistant', resp)
        await enviarMensagem(telefone, resp)
        return NextResponse.json({ ok: true })
      }
      if (inputNum === '3') {
        const resp = `✨ *Ultrassonografia (USG)*\n\n• O atendimento de Ultrassonografia (USG) acontece uma vez ao mês junto com os especialistas do projeto *Saúde Mais Próximo de Você*.\n• Para conseguir a USG, você precisa passar pela consulta na UBS e deixar a cópia do pedido médico na Secretaria de Saúde.\n• Seguimos a ordem de chegada, dos pedidos mais antigos para os mais recentes.\n\n⚠️ *Dúvidas ou Informações:*\nEntre em contato diretamente com a Secretaria de Saúde:\n📞 *(63) 99130-6916*\n\n❓ *Posso te ajudar em algo mais?*\n1️⃣ Sim\n2️⃣ Não`
        await setEstado(telefone, 'perguntar_mais_ajuda')
        await salvarMensagem(telefone, 'assistant', resp)
        await enviarMensagem(telefone, resp)
        return NextResponse.json({ ok: true })
      }
      if (inputNum === '4') {
        const resp = `💓 *Eletrocardiograma*\n\nPara agendar ou verificar o agendamento de Eletrocardiograma, entre em contato com a UBS Luiz Francisco de Miranda (Hospital):\n📞 *(63) 99130-6916*\n\n❓ *Posso te ajudar em algo mais?*\n1️⃣ Sim\n2️⃣ Não`
        await setEstado(telefone, 'perguntar_mais_ajuda')
        await salvarMensagem(telefone, 'assistant', resp)
        await enviarMensagem(telefone, resp)
        return NextResponse.json({ ok: true })
      }
      if (inputNum === '5') {
        const resp = `💼 *Exame Particular*\n\nVocê já possui o pedido médico para este exame?\n1️⃣ *Sim, já tenho o pedido*\n2️⃣ *Não tenho o pedido*\n\n_Digite o número da opção:_`
        await setEstado(telefone, 'opcao_marcar_particular_pedido')
        await salvarMensagem(telefone, 'assistant', resp)
        await enviarMensagem(telefone, resp)
        return NextResponse.json({ ok: true })
      }

      const resp = `❌ Opção inválida.\n\nQual tipo de exame você deseja marcar?\n1️⃣ Exames de Sangue\n2️⃣ Prevenção (PCCU)\n3️⃣ Ultrassonografia (USG)\n4️⃣ Eletrocardiograma\n5️⃣ Exame Particular`
      await salvarMensagem(telefone, 'assistant', resp)
      await enviarMensagem(telefone, resp)
      return NextResponse.json({ ok: true })
    }

    if (estado === 'opcao_marcar_particular_pedido' && inputNum) {
      if (inputNum === '1') {
        const resp = `📸 Por favor, envie uma *foto bem legível* do seu pedido médico particular aqui no WhatsApp para que eu possa transferir seu atendimento para o setor responsável.`
        await setEstado(telefone, 'opcao_marcar_particular_foto')
        await salvarMensagem(telefone, 'assistant', resp)
        await enviarMensagem(telefone, resp)
        return NextResponse.json({ ok: true })
      }
      if (inputNum === '2') {
        const resp = `⚠️ *Atenção:*\nPara agendar exames particulares com nossa ajuda, é obrigatório possuir o pedido médico prévio. Por favor, consulte um médico em sua UBS para obter a indicação do exame.\n\n❓ *Posso te ajudar em algo mais?*\n1️⃣ Sim\n2️⃣ Não`
        await setEstado(telefone, 'perguntar_mais_ajuda')
        await salvarMensagem(telefone, 'assistant', resp)
        await enviarMensagem(telefone, resp)
        return NextResponse.json({ ok: true })
      }

      const resp = `❌ Opção inválida.\n\nVocê já possui o pedido médico para o exame?\n1️⃣ Sim, já tenho o pedido\n2️⃣ Não tenho o pedido`
      await salvarMensagem(telefone, 'assistant', resp)
      await enviarMensagem(telefone, resp)
      return NextResponse.json({ ok: true })
    }

    if (estado === 'opcao_marcar_particular_foto') {
      const resp = `🗣️ *Transferindo para um Atendente...*\n\nEstou encaminhando seu pedido de exame particular para o setor responsável. Por favor, aguarde, em breve você será atendido por um humano.`
      await executarFerramenta('escalar_para_humano', { motivo: 'Pedido de exame particular com foto enviado' }, telefone)
      await setEstado(telefone, 'aguardando_humano')
      await salvarMensagem(telefone, 'assistant', resp)
      await enviarMensagem(telefone, resp)
      return NextResponse.json({ ok: true })
    }

    if (estado === 'opcao_marcar_particular_consulta_pedido' && inputNum) {
      if (inputNum === '1') {
        const resp = `📸 Por favor, envie uma *foto bem legível* do seu pedido/encaminhamento de consulta particular aqui no WhatsApp para que eu possa transferir seu atendimento para o setor responsável.`
        await setEstado(telefone, 'opcao_marcar_particular_consulta_foto')
        await salvarMensagem(telefone, 'assistant', resp)
        await enviarMensagem(telefone, resp)
        return NextResponse.json({ ok: true })
      }
      if (inputNum === '2') {
        const resp = `⚠️ *Atenção:*\nPara agendar consultas particulares com nossa ajuda, é necessário possuir a indicação/encaminhamento médico prévio. Por favor, consulte um médico em sua UBS para obter a indicação.\n\n❓ *Posso te ajudar em algo mais?*\n1️⃣ Sim\n2️⃣ Não`
        await setEstado(telefone, 'perguntar_mais_ajuda')
        await salvarMensagem(telefone, 'assistant', resp)
        await enviarMensagem(telefone, resp)
        return NextResponse.json({ ok: true })
      }

      const resp = `❌ Opção inválida.\n\nVocê já possui o pedido/encaminhamento médico para a consulta?\n1️⃣ Sim, já tenho o pedido\n2️⃣ Não tenho o pedido`
      await salvarMensagem(telefone, 'assistant', resp)
      await enviarMensagem(telefone, resp)
      return NextResponse.json({ ok: true })
    }

    if (estado === 'opcao_marcar_particular_consulta_foto') {
      const resp = `🗣️ *Transferindo para um Atendente...*\n\nEstou encaminhando seu pedido de consulta particular para o setor responsável. Por favor, aguarde, em breve você será atendido por um humano.`
      await executarFerramenta('escalar_para_humano', { motivo: 'Pedido de consulta particular com foto enviado' }, telefone)
      await setEstado(telefone, 'aguardando_humano')
      await salvarMensagem(telefone, 'assistant', resp)
      await enviarMensagem(telefone, resp)
      return NextResponse.json({ ok: true })
    }
      
    if (estado === 'perguntar_mais_ajuda' && inputNum) {
      if (inputNum === '1') {
        await setEstado(telefone, 'menu')
        await enviarMenu(telefone)
        return NextResponse.json({ ok: true })
      }
      if (inputNum === '2') {
        const resp = `✨ A Secretaria Municipal de Saúde agradece o seu contato! Tenha um excelente dia. 🏥\n\n_Se precisar de mim novamente, basta enviar uma mensagem._`
        await setEstado(telefone, 'menu')
        await salvarMensagem(telefone, 'assistant', resp)
        await enviarMensagem(telefone, resp)
        return NextResponse.json({ ok: true })
      }

      const resp = `❌ Opção inválida.\n\n❓ *Posso te ajudar em algo mais?*\n1️⃣ Sim\n2️⃣ Não`
      await salvarMensagem(telefone, 'assistant', resp)
      await enviarMensagem(telefone, resp)
      return NextResponse.json({ ok: true })
    }

    if (estado === 'menu_sisreg_tipo' && inputNum) {
      if (inputNum === '1') {
        const resp = `👨‍⚕️ *Consulta Especializada*\n\nInforme seu *CPF* ou *CNS* para eu verificar como está seu pedido de consulta no sistema estadual.`
        await setEstado(telefone, 'buscar_sisreg_consulta')
        await salvarMensagem(telefone, 'assistant', resp)
        await enviarMensagem(telefone, resp)
        return NextResponse.json({ ok: true })
      }
      if (inputNum === '2') {
        const resp = `🔬 *Exames*\n\nInforme seu *CPF* ou *CNS* para eu verificar como está seu pedido de exame no sistema estadual.`
        await setEstado(telefone, 'buscar_sisreg_exame')
        await salvarMensagem(telefone, 'assistant', resp)
        await enviarMensagem(telefone, resp)
        return NextResponse.json({ ok: true })
      }
      
      const resp = `❌ Opção inválida.\n\nDigite 1 para *Consulta* ou 2 para *Exame*.`
      await salvarMensagem(telefone, 'assistant', resp)
      await enviarMensagem(telefone, resp)
      return NextResponse.json({ ok: true })
    }

    // ── Busca direta de agendamentos (sem IA) ────────────────────────────────
    if (estado === 'buscar_agendamento') {
      const soDigitos = input.replace(/\D/g, '')
      if (soDigitos.length !== 11 && soDigitos.length !== 15) {
        const respInvalido = `❌ *CPF ou CNS inválido.*\n\nPor favor, envie apenas os *11 números do seu CPF* ou os *15 números do seu CNS*. Para sua segurança, a busca por nome foi desativada.`
        await salvarMensagem(telefone, 'assistant', respInvalido)
        await enviarMensagem(telefone, respInvalido)
        return NextResponse.json({ ok: true })
      }

      const resultado = await executarFerramenta('buscar_agendamentos', { busca: soDigitos }, telefone)
      const resposta = resultado === 'Nenhum agendamento encontrado para este paciente.'
        ? `❌ Nenhum agendamento encontrado para o CPF/CNS *${soDigitos}*.\n\nVerifique se os dados estão corretos e tente novamente, ou ligue para a SMS:\n📞 *(63) 99130-6916*`
        : `📋 *Seus agendamentos:*\n\n${resultado}`
      const comAjuda = `${resposta}\n\n❓ *Posso te ajudar em algo mais?*\n1️⃣ Sim\n2️⃣ Não`
      await setEstado(telefone, 'perguntar_mais_ajuda')
      await salvarMensagem(telefone, 'assistant', comAjuda)
      await enviarMensagem(telefone, comAjuda)
      return NextResponse.json({ ok: true })
    }

    // ── Busca direta de viagens TFD (sem IA) ─────────────────────────────────
    if (estado === 'buscar_tfd') {
      const soDigitos = input.replace(/\D/g, '')
      if (soDigitos.length !== 11 && soDigitos.length !== 15) {
        const respInvalido = `❌ *CPF ou CNS inválido.*\n\nPor favor, envie apenas os *11 números do seu CPF* ou os *15 números do seu CNS*. Para sua segurança, a busca por nome foi desativada.`
        await salvarMensagem(telefone, 'assistant', respInvalido)
        await enviarMensagem(telefone, respInvalido)
        return NextResponse.json({ ok: true })
      }

      const resultado = await executarFerramenta('buscar_tfd', { busca: soDigitos }, telefone)
      const resposta = resultado === 'Nenhuma viagem TFD encontrada para este paciente.'
        ? `❌ Nenhuma viagem encontrada para o CPF/CNS *${soDigitos}*.\n\nVerifique se os dados estão corretos, ou entre em contato:\n📞 *(63) 99130-6916*`
        : `🚗 *Suas viagens TFD:*\n\n${resultado}`
      const comAjuda = `${resposta}\n\n❓ *Posso te ajudar em algo mais?*\n1️⃣ Sim\n2️⃣ Não`
      await setEstado(telefone, 'perguntar_mais_ajuda')
      await salvarMensagem(telefone, 'assistant', comAjuda)
      await enviarMensagem(telefone, comAjuda)
      return NextResponse.json({ ok: true })
    }

    // ── Busca direta SISREG (sem IA) ─────────────────────────────────────────
    if (estado === 'buscar_sisreg_consulta' || estado === 'buscar_sisreg_exame') {
      const tipoBusca = estado === 'buscar_sisreg_consulta' ? 'consulta' : 'exame'
      
      // Validação estrita para CPF (11 dígitos) ou CNS (15 dígitos)
      const soDigitos = input.replace(/\D/g, '')
      if (soDigitos.length !== 11 && soDigitos.length !== 15) {
        const respInvalido = `❌ *CPF ou CNS inválido.*\n\nPor favor, envie apenas os *11 números do seu CPF* ou os *15 números do seu CNS*. Para sua segurança, a busca por nome foi desativada.`
        await salvarMensagem(telefone, 'assistant', respInvalido)
        await enviarMensagem(telefone, respInvalido)
        return NextResponse.json({ ok: true })
      }

      const resultado = await executarFerramenta('buscar_sisreg', { busca: soDigitos, tipo: tipoBusca }, telefone)
      
      let resposta = ''
      if (resultado.includes('Nenhuma solicitação encontrada')) {
        resposta = `❌ *Paciente não encontrado.*\n\nNenhum registro foi localizado no SISREG com este CPF/CNS. Verifique se digitou os números corretos ou ligue para a SMS: *(63) 99130-6916*`
      } else if (resultado.includes('não possui nenhuma solicitação ativa')) {
        resposta = `ℹ️ *Tudo em dia!*\n\n${resultado}`
      } else {
        resposta = `📋 *Resultado da sua busca:*\n\n${resultado}`
      }
      
      const comAjuda = `${resposta}\n\n❓ *Posso te ajudar em algo mais?*\n1️⃣ Sim\n2️⃣ Não`
      await setEstado(telefone, 'perguntar_mais_ajuda')
      await salvarMensagem(telefone, 'assistant', comAjuda)
      await enviarMensagem(telefone, comAjuda)
      return NextResponse.json({ ok: true })
    }

    // ── Fluxos abertos tratados pela IA ──────────────────────────────────────

    const systemPrompt = `Você é Francisco, o assistente virtual da Secretaria Municipal de Saúde de Conceição do Tocantins - TO.
Data e hora atual: ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Araguaina' })}

═══════════════════════════════════════
IDENTIDADE E PAPEL
═══════════════════════════════════════
Você é um ATENDENTE VIRTUAL de saúde pública. Seu papel é:
✅ Informar sobre serviços, horários e contatos da SMS
✅ Consultar agendamentos, viagens TFD e dados cadastrais do sistema municipal
✅ Direcionar o cidadão para o local e contato correto
✅ Escalar para atendente humano quando necessário

Você NÃO É e NUNCA deve agir como:
❌ Médico, enfermeiro, farmacêutico ou qualquer profissional de saúde
❌ Consultor jurídico, financeiro ou de qualquer outra área fora da SMS
❌ Fonte de informações médicas, diagnósticos ou tratamentos

TOM E ESTILO:
- Português brasileiro, linguagem simples e acessível
- Mensagens curtas e diretas (formato WhatsApp — sem parágrafos longos)
- Empático em situações de sofrimento, mas sempre redirecionando ao serviço correto
- NUNCA se reapresente — a apresentação já foi feita automaticamente
- Vá direto ao ponto: responda o que foi perguntado

═══════════════════════════════════════
🚫 GUARDRAILS — CONTEÚDO PROIBIDO
═══════════════════════════════════════
Se o usuário pedir qualquer um dos itens abaixo, responda EXATAMENTE com a mensagem indicada e use a ferramenta escalar_para_humano:

1. SINTOMAS / DIAGNÓSTICOS
   Exemplos: "tenho dor no peito", "estou com febre", "meu filho está vomitando", "o que pode ser essa dor?"
   Resposta obrigatória: "Não sou profissional de saúde e não posso avaliar sintomas. 🚨 Em caso de urgência, procure imediatamente a UBS Rural (Hospital): 📞 *(63) 99130-6916*. Se não for urgência, marque uma consulta com seu médico."

2. PRESCRIÇÕES / MEDICAMENTOS
   Exemplos: "posso tomar esse remédio?", "qual a dose de paracetamol?", "esse medicamento faz mal?"
   Resposta obrigatória: "Não tenho como orientar sobre medicamentos — isso é responsabilidade do médico ou farmacêutico. 💊 Para dúvidas sobre medicamentos, procure a farmácia da UBS: 📞 *(63) 99130-2450*."

3. LAUDOS / RESULTADOS CLÍNICOS
   Exemplos: "meu exame deu X, é grave?", "o que significa esse resultado?"
   Resposta obrigatória: "Não posso interpretar resultados de exames — isso é função do médico. Para retirar ou discutir resultados, procure o laboratório: 📞 *(63) 99132-7974*."

4. SAÚDE MENTAL / SOFRIMENTO EMOCIONAL
   Exemplos: "estou muito triste", "não quero mais viver", "estou desesperado"
   Resposta obrigatória: "Sinto muito que esteja passando por isso. 💙 Vou acionar um atendente para te ajudar." → use imediatamente escalar_para_humano.

5. ASSUNTOS FORA DA SMS
   Exemplos: política, jurídico, financeiro, outros municípios, notícias
   Resposta obrigatória: "Este canal é exclusivo para serviços de saúde de Conceição do Tocantins. Para essa dúvida, procure o órgão responsável."

REGRA DE OURO: Se tiver dúvida se deve responder, NÃO responda — direcione para o telefone da SMS ou escale para humano. Nunca invente informações.

═══════════════════════════════════════
MAPADE SERVIÇOS
═══════════════════════════════════════
🏨 *UBS Urbana (Postinho)* — 📞 (63) 99130-2450
- Nutricionista, Psicólogo, Dentista (ACS urbano)
- Farmácia (retirada de medicamentos com receita)
- Vacina / carteira de vacinação

🏥 *UBS Rural (Hospital)* — 📞 (63) 99130-6916
- Eletrocardiograma (ECG), Dentista (ACS rural)
- Urgência e Emergência 🚨
- Agendamento de viagens TFD

🔬 *Laboratório* — 📞 (63) 99132-7974
- Realização e resultado de exames de sangue
- Assistente social

🏛️ *Secretaria Municipal de Saúde* — 📞 (63) 99130-6916
- Especialistas: ortopedia, ginecologia, oftalmologia, urologia, USG, psiquiatria
- Exames de imagem (tomografia, ressonância)
- Status de pedido de agendamento (usar buscar_sisreg para solicitações do estado)
- Agendar consulta ou exame particular

SISTEMA SISREG:
- Use a ferramenta 'buscar_sisreg' para consultas e exames que são regulados pelo estado (geralmente especialidades e exames complexos).
- Se o usuário perguntar "Como está meu pedido no SISREG?" ou fornecer o CPF para ver exames pendentes, use esta ferramenta.

🏃 *Academia de Saúde*
- Fisioterapeuta e acompanhamento de fisioterapia

🛡️ *Vigilância Sanitária* — 📞 (63) 99131-4490
- Alvará sanitário, denúncias

═══════════════════════════════════════
TRIAGEM — CONSULTA DE ROTINA
═══════════════════════════════════════
Quando pedir consulta médica geral/rotina, pergunte o número do ACS:

UBS RURAL: ACS 02-Luzimaria, 05-Georgina, 06-Edilton, 07-Alaides, 08-Ramiro, 09-Greison, 10-Laurindo, 11-Kelisson, 12-Jurivan
UBS URBANA: ACS 01-Iva, 03-Maira, 04-Lindaura, 13-Dilma, 14-Delfino

Se não souber o ACS: "Verifique com seu ACS ou compareça à UBS mais próxima."

═══════════════════════════════════════
FERRAMENTAS — REGRAS OBRIGATÓRIAS
═══════════════════════════════════════
- Nome ou CPF/CNS recebido → chame a ferramenta IMEDIATAMENTE, sem perguntar mais nada
- CPF com ou sem máscara são válidos
- NUNCA escreva <function=...> no texto
- Se a ferramenta não retornar resultado → informe e ofereça o telefone da SMS
- Se não tiver certeza de uma informação → diga "Não tenho essa informação. Ligue para a SMS: 📞 *(63) 99130-6916*"

═══════════════════════════════════════
LGPD — PROTEÇÃO DE DADOS
═══════════════════════════════════════
- Colete apenas o mínimo necessário (nome ou CPF para buscas)
- NUNCA revele CPF, data de nascimento, endereço ou dados de terceiros
- NUNCA confirme se uma pessoa está cadastrada para quem não seja ela mesma
- Dados de saúde: nunca repita diagnósticos, medicamentos ou condições clínicas
- Se perguntarem sobre os dados armazenados → oriente a ir presencialmente à secretaria
- Se solicitado: "Esta conversa é registrada pela SMS para fins de atendimento, conforme a LGPD."

═══════════════════════════════════════
QUANDO ESCALAR PARA HUMANO
═══════════════════════════════════════
Use a ferramenta escalar_para_humano:
- Sofrimento emocional ou risco de vida relatado
- Reclamação ou denúncia grave contra a secretaria
- Solicitação explícita de falar com atendente
- Após 2 tentativas sem resolver o problema
- Qualquer situação de urgência médica
- Assunto muito específico ou sensível que exige análise humana

CONTATOS DE EMERGÊNCIA:
🚨 Urgências: (63) 99130-6916 | UBS Urbana: (63) 99130-2450 | Lab: (63) 99132-7974 | VISA: (63) 99131-4490`

    const model = genAI.getGenerativeModel({
      model: GEMINI_MODEL,
      systemInstruction: systemPrompt,
      tools: [{ functionDeclarations: tools }],
    })

    const chat = model.startChat({
      history: historico,
    })

    // Loop do agente com ferramentas
    let resposta = ''
    let tentativas = 0
    let messageToSend: any = texto

    while (tentativas < 5) {
      tentativas++

      const responseResult = await chat.sendMessage(messageToSend)
      const response = responseResult.response

      const functionCalls = response.functionCalls()

      if (!functionCalls || functionCalls.length === 0) {
        resposta = response.text().trim() || 'Desculpe, não consegui processar sua mensagem.'
        break
      }

      // Executa as ferramentas
      const functionResponses = []

      for (const call of functionCalls) {
        const resultado = await executarFerramenta(call.name, call.args, telefone)
        functionResponses.push({
          functionResponse: {
            name: call.name,
            response: { name: call.name, content: resultado }
          }
        })
      }

      messageToSend = functionResponses
    }

    if (!resposta) resposta = 'Desculpe, não consegui processar sua mensagem no momento. Tente novamente ou ligue para a secretaria.'

    await salvarMensagem(telefone, 'assistant', resposta)
    await enviarMensagem(telefone, resposta)

    // Se o estado foi alterado para aguardando_humano (pelo acionamento da ferramenta de escalonamento),
    // encerra o webhook aqui sem restaurar o estado 'menu' ou enviar o menu principal.
    const { estado: estadoFinal } = await getEstadoInfo(telefone)
    if (estadoFinal === 'aguardando_humano') {
      return NextResponse.json({ ok: true })
    }

    await setEstado(telefone, 'menu')
    await salvarMensagem(telefone, 'assistant', MENU_PRINCIPAL)
    await enviarMensagem(telefone, MENU_PRINCIPAL)

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    console.error('Webhook Francisco erro:', e)
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 })
  }
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    agente: 'Francisco — SMS Conceição do Tocantins (Gemini)',
    model: GEMINI_MODEL,
    evolutionConfigured: Boolean(EVOLUTION_URL && EVOLUTION_KEY && EVOLUTION_INSTANCE)
  })
}
