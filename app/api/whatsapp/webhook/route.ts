import { NextRequest, NextResponse } from 'next/server'
import Groq from 'groq-sdk'
import { createClient } from '@supabase/supabase-js'

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const EVOLUTION_URL = process.env.EVOLUTION_API_URL!
const EVOLUTION_KEY = process.env.EVOLUTION_API_KEY!
const EVOLUTION_INSTANCE = process.env.EVOLUTION_INSTANCE!

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
const tools: Groq.Chat.Completions.ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'escalar_para_humano',
      description: 'Chama um atendente humano quando Francisco não consegue resolver a solicitação, quando o assunto é muito específico, sensível ou requer intervenção humana.',
      parameters: {
        type: 'object',
        properties: {
          motivo: { type: 'string', description: 'Motivo pelo qual está escalando para atendimento humano' }
        },
        required: ['motivo']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'buscar_agendamentos',
      description: 'Busca agendamentos de consultas e exames de especialidades do paciente pelo nome ou CPF/CNS. Retorna especialidade, tipo de exame, data, status e profissional.',
      parameters: {
        type: 'object',
        properties: {
          busca: { type: 'string', description: 'Nome do paciente ou CPF/CNS (com ou sem máscara)' }
        },
        required: ['busca']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'buscar_paciente',
      description: 'Busca dados cadastrais do paciente (nome, CPF/CNS, data de nascimento, telefone, endereço) na base da secretaria.',
      parameters: {
        type: 'object',
        properties: {
          busca: { type: 'string', description: 'Nome do paciente ou CPF/CNS' }
        },
        required: ['busca']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'buscar_tfd',
      description: 'Busca viagens de TFD (Tratamento Fora do Domicílio) do paciente. Retorna destino, data e horário da viagem.',
      parameters: {
        type: 'object',
        properties: {
          busca: { type: 'string', description: 'Nome do paciente ou CPF' },
          data: { type: 'string', description: 'Data no formato YYYY-MM-DD (opcional, para filtrar por data)' }
        },
        required: ['busca']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'informacoes_secretaria',
      description: 'Retorna informações gerais sobre a Secretaria Municipal de Saúde de Conceição do Tocantins.',
      parameters: {
        type: 'object',
        properties: {
          assunto: { type: 'string', description: 'Assunto da dúvida (horário, endereço, serviços, contato, etc.)' }
        },
        required: ['assunto']
      }
    }
  }
]

// ── Execução das ferramentas ─────────────────────────────────────────────────
async function executarFerramenta(nome: string, input: any, telefone: string): Promise<string> {
  try {
    if (nome === 'escalar_para_humano') {
      await supabase.from('whatsapp_conversas').insert([{
        telefone,
        papel: 'sistema',
        mensagem: `🔴 ESCALONADO: ${input.motivo}`
      }])
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

    return 'Ferramenta não reconhecida.'
  } catch (e: any) {
    return `Erro interno: ${e.message}`
  }
}

// ── Envia mensagem de texto via Evolution API ────────────────────────────────
async function enviarMensagem(numero: string, texto: string) {
  await fetch(`${EVOLUTION_URL}/message/sendText/${EVOLUTION_INSTANCE}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'apikey': EVOLUTION_KEY },
    body: JSON.stringify({ number: numero, text: texto })
  })
}

// ── Menus em texto (compatível com qualquer conexão WhatsApp) ────────────────
const MENU_PRINCIPAL = `📋 *Como posso ajudar?*

1️⃣ UBS Urbana (Postinho)
2️⃣ UBS Rural (Hospital)
3️⃣ Laboratório
4️⃣ Secretaria de Saúde
5️⃣ Academia de Saúde
6️⃣ Vigilância Sanitária
7️⃣ 🔍 Ver meus agendamentos
8️⃣ 🚗 TFD — Minhas viagens

_Digite o número da opção ou descreva sua dúvida_`

const MENUS_SECUNDARIOS: Record<string, string> = {
  '1': `🏨 *UBS Urbana (Postinho)*\n📞 *(63) 99130-2450*\n\n1️⃣ Nutricionista\n2️⃣ Psicólogo\n3️⃣ Dentista\n4️⃣ Farmácia\n5️⃣ Vacina\n\n0️⃣ ↩ Voltar ao menu`,
  '2': `🏥 *UBS Rural (Hospital)*\n📞 *(63) 99130-6916*\n\n1️⃣ Eletrocardiograma (ECG)\n2️⃣ Dentista\n3️⃣ Urgência / Emergência\n4️⃣ Agendamento de viagens (TFD)\n\n0️⃣ ↩ Voltar ao menu`,
  '3': `🔬 *Laboratório*\n📞 *(63) 99132-7974*\n\n1️⃣ Realizar exame de sangue\n2️⃣ Resultado de exame\n3️⃣ Assistente social\n\n0️⃣ ↩ Voltar ao menu`,
  '4': `🏛️ *Secretaria de Saúde*\n📞 *(63) 99130-6916*\n\n1️⃣ Consulta com especialista\n2️⃣ Consulta com psiquiatra\n3️⃣ Tomografia / Ressonância\n4️⃣ Posição do meu pedido\n5️⃣ Consulta / Exame particular\n\n0️⃣ ↩ Voltar ao menu`,
  '5': `🏃 *Academia de Saúde*\n\n1️⃣ Consulta com fisioterapeuta\n2️⃣ Acompanhamento de fisioterapia\n\n0️⃣ ↩ Voltar ao menu`,
  '6': `🛡️ *Vigilância Sanitária*\n📞 *(63) 99131-4490*\n\n1️⃣ Emissão de alvará sanitário\n2️⃣ Registrar denúncia\n\n0️⃣ ↩ Voltar ao menu`,
}

// Respostas diretas para opções de submenu
const RESPOSTAS_DIRETAS: Record<string, string> = {
  // UBS Urbana
  '1-1': `🥗 *Nutricionista — UBS Urbana (Postinho)*\n\nO agendamento é feito diretamente na UBS Urbana.\n📞 Ligue: *(63) 99130-2450*\n\n_Leve seu cartão SUS e encaminhamento._`,
  '1-2': `🧠 *Psicólogo — UBS Urbana (Postinho)*\n\nO agendamento é feito diretamente na UBS Urbana.\n📞 Ligue: *(63) 99130-2450*\n\n_Leve seu cartão SUS e encaminhamento._`,
  '1-3': `🦷 *Dentista — UBS Urbana (Postinho)*\n\nO agendamento é feito com o seu ACS urbano ou diretamente na UBS.\n📞 Ligue: *(63) 99130-2450*`,
  '1-4': `💊 *Farmácia — UBS Urbana (Postinho)*\n\nA retirada de medicamentos é feita na própria UBS Urbana.\n📞 *(63) 99130-2450*\n\n_Leve a receita médica atualizada._`,
  '1-5': `💉 *Vacina — UBS Urbana (Postinho)*\n\nVacinação e atualização da carteira de vacinação na UBS Urbana.\n📞 *(63) 99130-2450*\n\n_Leve sua carteira de vacinação._`,
  // UBS Rural
  '2-1': `❤️ *Eletrocardiograma (ECG) — UBS Rural (Hospital)*\n\nAgendamento feito diretamente na UBS Rural com encaminhamento médico.\n📞 *(63) 99130-6916*`,
  '2-2': `🦷 *Dentista — UBS Rural (Hospital)*\n\nAgendamento com o seu ACS rural ou diretamente na UBS Rural.\n📞 *(63) 99130-6916*`,
  '2-3': `🚨 *Urgência / Emergência*\n\nDirija-se imediatamente à *UBS Rural (Hospital)* ou ligue:\n📞 *(63) 99130-6916*`,
  '2-4': `🚗 *Agendamento de viagens — TFD*\n\nPara agendar transporte para tratamento fora do município, procure a *UBS Rural* com a documentação médica.\n📞 *(63) 99130-6916*`,
  // Laboratório
  '3-1': `🩸 *Realizar exame de sangue — Laboratório*\n\nLeve o pedido médico ao laboratório municipal.\n📞 *(63) 99132-7974*\n\n_Horário: segunda a sexta, 7h às 11h._`,
  '3-2': `📄 *Resultado de exame — Laboratório*\n\nO resultado pode ser retirado no laboratório municipal.\n📞 *(63) 99132-7974*`,
  '3-3': `🤝 *Assistente Social — Laboratório*\n\nO atendimento com assistente social é realizado no laboratório municipal.\n📞 *(63) 99132-7974*`,
  // Secretaria
  '4-1': `🏥 *Consulta com especialista — Secretaria de Saúde*\n\nPara agendar consulta com ortopedista, ginecologista, oftalmologista, urologista ou USG, procure a Secretaria de Saúde com:\n• Encaminhamento do médico do PSF\n• Cartão SUS\n• Documento de identidade\n\n📞 *(63) 99130-6916*`,
  '4-2': `🧠 *Consulta com Psiquiatra — Secretaria de Saúde*\n\nAgendamento feito na Secretaria de Saúde com encaminhamento médico.\n📞 *(63) 99130-6916*`,
  '4-3': `🩻 *Tomografia / Ressonância — Secretaria de Saúde*\n\nAgendamento feito na Secretaria de Saúde com pedido médico.\n📞 *(63) 99130-6916*`,
  '4-4': `🔍 *Posição do pedido*\n\nPara consultar o status do seu agendamento, me informe seu *nome completo* ou *CPF*.`,
  '4-5': `💳 *Consulta / Exame particular*\n\nPara agendamentos particulares, entre em contato diretamente com a Secretaria de Saúde.\n📞 *(63) 99130-6916*`,
  // Academia
  '5-1': `🦵 *Fisioterapeuta — Academia de Saúde*\n\nConsultas com fisioterapeuta são realizadas na Academia de Saúde do município. Procure a unidade para agendamento.`,
  '5-2': `📋 *Acompanhamento de Fisioterapia — Academia de Saúde*\n\nO acompanhamento fisioterapêutico é feito na Academia de Saúde. Procure a unidade com seu encaminhamento.`,
  // Vigilância
  '6-1': `📜 *Alvará Sanitário — Vigilância Sanitária*\n\nPara emissão de alvará sanitário, entre em contato com a VISA municipal.\n📞 *(63) 99131-4490*`,
  '6-2': `📢 *Denúncia — Vigilância Sanitária*\n\nPara registrar uma denúncia sanitária, entre em contato com a VISA municipal.\n📞 *(63) 99131-4490*\n\n_O sigilo do denunciante é garantido._`,
}

async function enviarMenu(numero: string) {
  await enviarMensagem(numero, MENU_PRINCIPAL)
}

// ── Busca e atualiza estado da conversa ──────────────────────────────────────
async function getEstado(telefone: string): Promise<string> {
  const { data } = await supabase
    .from('whatsapp_estados')
    .select('estado')
    .eq('telefone', telefone)
    .maybeSingle()
  return data?.estado || 'menu'
}

async function setEstado(telefone: string, estado: string) {
  await supabase.from('whatsapp_estados').upsert(
    { telefone, estado, atualizado_em: new Date().toISOString() },
    { onConflict: 'telefone' }
  )
}

// ── Carrega histórico da conversa ────────────────────────────────────────────
async function carregarHistorico(telefone: string): Promise<Groq.Chat.Completions.ChatCompletionMessageParam[]> {
  const { data } = await supabase
    .from('whatsapp_conversas')
    .select('papel, mensagem')
    .eq('telefone', telefone)
    .order('criado_em', { ascending: true })
    .limit(20)

  if (!data) return []
  return data.map(r => ({
    role: r.papel as 'user' | 'assistant',
    content: r.mensagem
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

    if (body?.data?.key?.fromMe) return NextResponse.json({ ok: true })
    if (body?.event !== 'messages.upsert') return NextResponse.json({ ok: true })

    const remoteJid: string = body?.data?.key?.remoteJid || ''
    const telefone = remoteJid.replace('@s.whatsapp.net', '').replace('@g.us', '')
    if (!telefone || remoteJid.includes('@g.us')) return NextResponse.json({ ok: true })

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
    const estado = await getEstado(telefone)
    const input = texto.trim()
    const inputNum = input.replace(/[^0-9]/g, '')

    // ── Primeira mensagem: apresentação + menu ───────────────────────────────
    if (primeiraMsg) {
      const apresentacao = `Olá! 👋 Sou o *Francisco*, assistente virtual da *Secretaria Municipal de Saúde de Conceição do Tocantins*.\n\n📋 Este canal é exclusivo para assuntos da SMS. Em caso de urgência ou emergência, entre em contato *imediatamente*: 📞 *(63) 99130-6916*`
      await salvarMensagem(telefone, 'assistant', apresentacao)
      await enviarMensagem(telefone, apresentacao)
      await setEstado(telefone, 'menu')
      await salvarMensagem(telefone, 'assistant', MENU_PRINCIPAL)
      await enviarMensagem(telefone, MENU_PRINCIPAL)
      return NextResponse.json({ ok: true })
    }

    // ── Palavra-chave para voltar ao menu ────────────────────────────────────
    if (['0', 'menu', 'voltar', 'início', 'inicio'].includes(input.toLowerCase())) {
      await setEstado(telefone, 'menu')
      await salvarMensagem(telefone, 'assistant', MENU_PRINCIPAL)
      await enviarMensagem(telefone, MENU_PRINCIPAL)
      return NextResponse.json({ ok: true })
    }

    // ── Navegação no menu principal (opções 1-8) ─────────────────────────────
    if (estado === 'menu' && inputNum && Number(inputNum) >= 1 && Number(inputNum) <= 6) {
      const submenu = MENUS_SECUNDARIOS[inputNum]
      await setEstado(telefone, `sub_${inputNum}`)
      await salvarMensagem(telefone, 'assistant', submenu)
      await enviarMensagem(telefone, submenu)
      return NextResponse.json({ ok: true })
    }

    // Opção 7: ver agendamentos
    if (estado === 'menu' && inputNum === '7') {
      const resp = `🔍 *Ver meus agendamentos*\n\nInforme seu *nome completo* ou *CPF* para eu buscar seus agendamentos.`
      await setEstado(telefone, 'buscar_agendamento')
      await salvarMensagem(telefone, 'assistant', resp)
      await enviarMensagem(telefone, resp)
      return NextResponse.json({ ok: true })
    }

    // Opção 8: TFD/viagens
    if (estado === 'menu' && inputNum === '8') {
      const resp = `🚗 *TFD — Minhas viagens*\n\nInforme seu *nome completo* ou *CPF* para eu buscar suas viagens agendadas.`
      await setEstado(telefone, 'buscar_tfd')
      await salvarMensagem(telefone, 'assistant', resp)
      await enviarMensagem(telefone, resp)
      return NextResponse.json({ ok: true })
    }

    // ── Navegação no submenu ─────────────────────────────────────────────────
    if (estado.startsWith('sub_') && inputNum) {
      const pai = estado.replace('sub_', '')
      const chave = `${pai}-${inputNum}`

      // Opção 4-4 (posição do pedido) → entra no fluxo de busca por IA
      if (chave === '4-4') {
        const resp = `🔍 Informe seu *nome completo* ou *CPF* para eu consultar o status do seu pedido.`
        await setEstado(telefone, 'buscar_agendamento')
        await salvarMensagem(telefone, 'assistant', resp)
        await enviarMensagem(telefone, resp)
        return NextResponse.json({ ok: true })
      }

      const respDireta = RESPOSTAS_DIRETAS[chave]
      if (respDireta) {
        await salvarMensagem(telefone, 'assistant', respDireta)
        await enviarMensagem(telefone, respDireta)
        await setEstado(telefone, 'menu')
        await salvarMensagem(telefone, 'assistant', MENU_PRINCIPAL)
        await enviarMensagem(telefone, MENU_PRINCIPAL)
        return NextResponse.json({ ok: true })
      }
    }

    // ── Busca direta de agendamentos (sem IA) ────────────────────────────────
    if (estado === 'buscar_agendamento') {
      const resultado = await executarFerramenta('buscar_agendamentos', { busca: input }, telefone)
      const resposta = resultado === 'Nenhum agendamento encontrado para este paciente.'
        ? `❌ Nenhum agendamento encontrado para *${input}*.\n\nVerifique se o nome ou CPF está correto e tente novamente, ou ligue para a SMS:\n📞 *(63) 99130-6916*`
        : `📋 *Seus agendamentos:*\n\n${resultado}`
      await salvarMensagem(telefone, 'assistant', resposta)
      await enviarMensagem(telefone, resposta)
      await setEstado(telefone, 'menu')
      await salvarMensagem(telefone, 'assistant', MENU_PRINCIPAL)
      await enviarMensagem(telefone, MENU_PRINCIPAL)
      return NextResponse.json({ ok: true })
    }

    // ── Busca direta de viagens TFD (sem IA) ─────────────────────────────────
    if (estado === 'buscar_tfd') {
      const resultado = await executarFerramenta('buscar_tfd', { busca: input }, telefone)
      const resposta = resultado === 'Nenhuma viagem TFD encontrada para este paciente.'
        ? `❌ Nenhuma viagem encontrada para *${input}*.\n\nVerifique o nome ou CPF, ou entre em contato:\n📞 *(63) 99130-6916*`
        : `🚗 *Suas viagens TFD:*\n\n${resultado}`
      await salvarMensagem(telefone, 'assistant', resposta)
      await enviarMensagem(telefone, resposta)
      await setEstado(telefone, 'menu')
      await salvarMensagem(telefone, 'assistant', MENU_PRINCIPAL)
      await enviarMensagem(telefone, MENU_PRINCIPAL)
      return NextResponse.json({ ok: true })
    }

    // ── Fluxos abertos tratados pela IA ──────────────────────────────────────
    const mensagens: Groq.Chat.Completions.ChatCompletionMessageParam[] = [
      ...historico,
      { role: 'user', content: texto }
    ]

    const systemPrompt = `Você é Francisco, o assistente virtual da Secretaria Municipal de Saúde de Conceição do Tocantins - TO.
Data e hora atual: ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Araguaina' })}

IDENTIDADE E TOM:
- Simpático, prestativo, claro e objetivo como um atendente profissional de saúde pública
- Responda sempre em português brasileiro, linguagem simples e acessível
- Mensagens curtas e diretas (formato WhatsApp)
- Nunca se apresente como médico ou profissional de saúde
- NUNCA se reapresente — a apresentação já foi enviada automaticamente
- Vá direto ao ponto: responda imediatamente o que o usuário perguntou ou pediu

AVISO DE EMERGÊNCIA (sempre que relevante):
Urgências e emergências: redirecione para 📞 *(63) 99130-6916*, independente do horário.

HORÁRIO DE FUNCIONAMENTO (segunda a sexta, 7h–11h e 13h–17h):
- Fora desse horário: informe que a secretaria está fechada e oriente a retornar no próximo horário de atendimento
- Urgências e emergências: sempre redirecione para o *📞 (63) 99130-6916*, independente do horário

MAPA DE SERVIÇOS — onde cada serviço é atendido:

🏨 *UBS Urbana (Postinho)* — 📞 (63) 99130-2450
- Nutricionista
- Psicólogo
- Dentista (ACS urbano)
- Farmácia (retirada de medicamentos)
- Vacina / carteira de vacinação

🏥 *UBS Rural (Hospital)* — 📞 (63) 99130-6916
- Eletrocardiograma (ECG)
- Dentista (ACS rural)
- Urgência e Emergência
- Agendamento de viagens (TFD)

🔬 *Laboratório* — 📞 (63) 99132-7974
- Realização de exames de sangue
- Resultados de exames de sangue
- Assistente social

🏛️ *Secretaria Municipal de Saúde* — 📞 (63) 99130-6916
- Consultas com especialistas (ortopedia, ginecologia, oftalmologia, urologia, USG)
- Consulta com psiquiatra
- Exames de imagem (tomografia, ressonância)
- Consultar posição/status de pedido de agendamento
- Agendar consulta ou exame particular

🏃 *Academia de Saúde*
- Consulta com fisioterapeuta
- Acompanhamento de fisioterapia

🛡️ *Vigilância Sanitária* — 📞 (63) 99131-4490
- Emissão de alvará sanitário
- Denúncias à VISA municipal

TRIAGEM — REGRA PARA CONSULTAS DE ROTINA (clínico geral / médico de família):
Quando o usuário quiser marcar consulta médica de rotina, pergunte o ACS para direcionar à UBS correta:

🏥 UBS RURAL → ACS: 02-Luzimaria, 05-Georgina, 06-Edilton, 07-Alaides, 08-Ramiro, 09-Greison, 10-Laurindo, 11-Kelisson, 12-Jurivan
→ "Sua consulta deve ser marcada diretamente no *UBS Rural (Hospital)*. Você pode ligar para: 📞 *(63) 99130-6916*"

🏨 UBS URBANA → ACS: 01-Iva, 03-Maira, 04-Lindaura, 13-Dilma, 14-Delfino
→ "Sua consulta deve ser marcada diretamente no *UBS Urbana (Postinho)*. Você pode ligar para: 📞 *(63) 99130-2450*"

Se não souber o ACS: "Você pode verificar com seu ACS na sua microárea ou comparecer à UBS mais próxima."

USO DAS FERRAMENTAS — REGRAS OBRIGATÓRIAS:
- Quando o usuário fornecer um nome ou número (CPF, CNS), chame IMEDIATAMENTE a ferramenta sem pedir mais informações
- CPF pode vir com ou sem máscara (ex: 137.325.047-00 ou 13732504700) — ambos são válidos, use direto na busca
- NUNCA pergunte o motivo da consulta — não é necessário para buscar dados
- NUNCA escreva <function=...> no texto — use apenas as ferramentas estruturadas
- Se o usuário já forneceu nome ou CPF, não peça novamente

ASSUNTOS PROIBIDOS:
- Diagnósticos, prescrições ou orientações médicas específicas
- Assuntos fora da área de saúde (política, jurídico, financeiro, etc.)
- Para esses casos: "Este canal é exclusivo para assuntos de saúde. Para essa dúvida, procure o serviço adequado."

LGPD — PROTEÇÃO DE DADOS (Lei nº 13.709/2018):

Coleta e uso de dados:
- Colete apenas o mínimo necessário para responder à solicitação (princípio da necessidade, art. 6º)
- Use os dados exclusivamente para a finalidade informada — atendimento da SMS (princípio da finalidade, art. 6º)
- Nunca use dados de saúde para outros fins além do atendimento solicitado (art. 11)

Dados sensíveis de saúde (proteção reforçada, art. 11):
- Nunca repita, confirme ou exponha dados de saúde, diagnósticos, medicamentos ou condições clínicas do paciente
- Nunca compartilhe informações de um paciente com terceiros, nem com outros usuários da conversa
- Dados de saúde só podem ser tratados no contexto de tutela da saúde pela autoridade sanitária

O que NUNCA fazer:
- Nunca revelar CPF, data de nascimento, endereço, telefone ou diagnóstico de terceiros
- Nunca confirmar se uma pessoa está cadastrada no sistema para quem não seja ela mesma
- Nunca armazenar ou repetir dados sensíveis além do necessário para responder
- Nunca fazer perfil ou julgamento sobre o paciente com base nos dados

Direitos do titular (art. 18) — se o usuário solicitar:
- Direito de saber quais dados a SMS possui sobre ele → oriente a ir presencialmente à secretaria
- Direito de corrigir dados → oriente a ir presencialmente
- Direito de excluir dados → oriente a ir presencialmente com documento de identidade

Transparência — informe quando solicitado:
- "Esta conversa é registrada pela Secretaria Municipal de Saúde para fins de atendimento, conforme a LGPD."
- Os dados coletados neste canal têm finalidade exclusiva de atendimento à saúde pública municipal

CONTATOS DA SAÚDE (responda diretamente quando perguntarem):
- 🚨 Urgências/Emergências: (63) 99130-6916
- 🏥 Secretaria Municipal de Saúde: (63) 99130-6916
- 🏨 UBS Urbana (Postinho): (63) 99130-2450
- 🔬 Laboratório: (63) 99132-7974
- 🛡️ Vigilância Sanitária: (63) 99131-4490

QUANDO ESCALAR PARA HUMANO (use a ferramenta escalar_para_humano):
- Situação de risco ou sofrimento emocional relatado
- Reclamação ou denúncia grave
- Solicitação explícita de falar com atendente
- Após 3 tentativas sem resolver o problema do usuário
- Assunto muito específico que exige análise humana`

    // Loop do agente com ferramentas
    let resposta = ''
    let tentativas = 0

    while (tentativas < 5) {
      tentativas++

      const response = await groq.chat.completions.create({
        model: 'llama3-groq-8b-8192-tool-use-preview',
        max_tokens: 512,
        temperature: 0.3,
        messages: [{ role: 'system', content: systemPrompt }, ...mensagens],
        tools,
        tool_choice: 'auto'
      })

      const msg = response.choices[0].message
      const toolCalls = msg.tool_calls

      if (!toolCalls || toolCalls.length === 0) {
        // Remove vazamento de chamadas de ferramenta no texto
        const texto_resp = (msg.content || '').replace(/<function=[^>]*>[^<]*<\/function>/g, '').trim()
        resposta = texto_resp || 'Desculpe, não consegui processar sua mensagem.'
        break
      }

      // Executa as ferramentas
      mensagens.push({ role: 'assistant', content: msg.content || '', tool_calls: toolCalls })

      for (const tc of toolCalls) {
        const input = JSON.parse(tc.function.arguments || '{}')
        const resultado = await executarFerramenta(tc.function.name, input, telefone)
        mensagens.push({
          role: 'tool',
          tool_call_id: tc.id,
          content: resultado
        })
      }
    }

    if (!resposta) resposta = 'Desculpe, não consegui processar sua mensagem no momento. Tente novamente ou ligue para a secretaria.'

    await salvarMensagem(telefone, 'assistant', resposta)
    await enviarMensagem(telefone, resposta)
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
  return NextResponse.json({ ok: true, agente: 'Francisco — SMS Conceição do Tocantins (Groq)' })
}
