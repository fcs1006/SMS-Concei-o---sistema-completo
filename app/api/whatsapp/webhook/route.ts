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

// ── Verifica horário de funcionamento ───────────────────────────────────────
function dentroDoHorario(): boolean {
  const agora = new Date().toLocaleString('en-US', { timeZone: 'America/Araguaina' })
  const hora = new Date(agora)
  const h = hora.getHours()
  const diaSemana = hora.getDay() // 0=dom, 6=sáb
  if (diaSemana === 0 || diaSemana === 6) return false
  return (h >= 7 && h < 11) || (h >= 13 && h < 17)
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

// ── Envia mensagem via Evolution API ────────────────────────────────────────
async function enviarMensagem(numero: string, texto: string) {
  await fetch(`${EVOLUTION_URL}/message/sendText/${EVOLUTION_INSTANCE}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'apikey': EVOLUTION_KEY },
    body: JSON.stringify({ number: numero, text: texto })
  })
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

    // Primeira mensagem — aviso obrigatório
    const primeiraMsg = historico.length === 0

    const mensagens: Groq.Chat.Completions.ChatCompletionMessageParam[] = [
      ...historico,
      {
        role: 'user',
        content: primeiraMsg
          ? `[PRIMEIRA MENSAGEM DO USUÁRIO — inclua o aviso do canal e do número de emergência no início da sua resposta]\n\n${texto}`
          : texto
      }
    ]

    const systemPrompt = `Você é Francisco, o assistente virtual da Secretaria Municipal de Saúde de Conceição do Tocantins - TO.
Data e hora atual: ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Araguaina' })}

IDENTIDADE E TOM:
- Simpático, prestativo, claro e objetivo como um atendente profissional de saúde pública
- Responda sempre em português brasileiro, linguagem simples e acessível
- Mensagens curtas e diretas (formato WhatsApp)
- Nunca se apresente como médico ou profissional de saúde

AVISO INICIAL (primeira mensagem de cada conversa):
Sempre inicie informando: "📋 Este canal é exclusivo para assuntos da Secretaria Municipal de Saúde. Em caso de urgência ou emergência, entre em contato IMEDIATAMENTE pelo: 📞 *(63) 99130-6916*"

HORÁRIO DE FUNCIONAMENTO (segunda a sexta, 7h–11h e 13h–17h):
- Fora desse horário: informe que a secretaria está fechada e oriente a retornar no próximo horário de atendimento
- Urgências e emergências: sempre redirecione para o *📞 (63) 99130-6916*, independente do horário

ASSUNTOS PERMITIDOS (somente):
- Agendamentos, consultas, exames e retornos da secretaria
- TFD — Tratamento Fora do Domicílio
- Informações sobre serviços da SMS
- Orientações gerais de saúde baseadas em diretrizes do Ministério da Saúde:
  • Hábitos saudáveis, alimentação, atividade física
  • Cuidados com hipertensão, diabetes, saúde bucal, vacinação
  • Prevenção e autocuidado

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

DADOS SENSÍVEIS — NUNCA compartilhe:
- CPF completo, endereço residencial, diagnósticos, prontuários
- Apenas confirme dados de agendamento para o próprio paciente (nome + data de nascimento)

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
        model: 'llama3-groq-70b-8192-tool-use-preview',
        max_tokens: 1024,
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

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    console.error('Webhook Francisco erro:', e)
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 })
  }
}

export async function GET() {
  return NextResponse.json({ ok: true, agente: 'Francisco — SMS Conceição do Tocantins (Groq)' })
}
