import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const EVOLUTION_URL = process.env.EVOLUTION_API_URL!
const EVOLUTION_KEY = process.env.EVOLUTION_API_KEY!
const EVOLUTION_INSTANCE = process.env.EVOLUTION_INSTANCE!

// ── Ferramentas do Francisco ─────────────────────────────────────────────────
const tools: Anthropic.Tool[] = [
  {
    name: 'buscar_agendamentos',
    description: 'Busca agendamentos de consultas e exames de especialidades do paciente pelo nome ou CPF/CNS. Retorna especialidade, tipo de exame, data, status e profissional.',
    input_schema: {
      type: 'object' as const,
      properties: {
        busca: { type: 'string', description: 'Nome do paciente ou CPF/CNS (com ou sem máscara)' }
      },
      required: ['busca']
    }
  },
  {
    name: 'buscar_paciente',
    description: 'Busca dados cadastrais do paciente (nome, CPF/CNS, data de nascimento, telefone, endereço) na base da secretaria.',
    input_schema: {
      type: 'object' as const,
      properties: {
        busca: { type: 'string', description: 'Nome do paciente ou CPF/CNS' }
      },
      required: ['busca']
    }
  },
  {
    name: 'buscar_tfd',
    description: 'Busca viagens de TFD (Tratamento Fora do Domicílio) do paciente. Retorna destino, data e horário da viagem.',
    input_schema: {
      type: 'object' as const,
      properties: {
        busca: { type: 'string', description: 'Nome do paciente ou CPF' },
        data: { type: 'string', description: 'Data no formato YYYY-MM-DD (opcional, para filtrar por data)' }
      },
      required: ['busca']
    }
  },
  {
    name: 'informacoes_secretaria',
    description: 'Retorna informações gerais sobre a Secretaria Municipal de Saúde de Conceição do Tocantins.',
    input_schema: {
      type: 'object' as const,
      properties: {
        assunto: { type: 'string', description: 'Assunto da dúvida (horário, endereço, serviços, contato, etc.)' }
      },
      required: ['assunto']
    }
  }
]

// ── Execução das ferramentas ─────────────────────────────────────────────────
async function executarFerramenta(nome: string, input: any): Promise<string> {
  try {
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
        tfd: 'O TFD (Tratamento Fora do Domicílio) oferece transporte para pacientes que necessitam de atendimento em outros municípios como Palmas e Porto Nacional. Para incluir uma viagem, procure a secretaria com o encaminhamento médico.',
        agendamento: 'Para agendar consultas em especialidades (ortopedia, ginecologia, oftalmologia, urologia, USG, psiquiatria), procure a SMS com encaminhamento médico do PSF.',
        contato: 'Entre em contato com a Secretaria Municipal de Saúde de Conceição do Tocantins pelo WhatsApp ou presencialmente.',
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
  const url = `${EVOLUTION_URL}/message/sendText/${EVOLUTION_INSTANCE}`
  await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'apikey': EVOLUTION_KEY },
    body: JSON.stringify({ number: numero, text: texto })
  })
}

// ── Carrega histórico da conversa ────────────────────────────────────────────
async function carregarHistorico(telefone: string): Promise<Anthropic.MessageParam[]> {
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

    // Filtrar apenas mensagens recebidas (não enviadas pelo bot)
    if (body?.data?.key?.fromMe) return NextResponse.json({ ok: true })
    if (body?.event !== 'messages.upsert') return NextResponse.json({ ok: true })

    const remoteJid: string = body?.data?.key?.remoteJid || ''
    const telefone = remoteJid.replace('@s.whatsapp.net', '').replace('@g.us', '')
    if (!telefone || remoteJid.includes('@g.us')) return NextResponse.json({ ok: true }) // ignora grupos

    const msgObj = body?.data?.message
    const texto: string =
      msgObj?.conversation ||
      msgObj?.extendedTextMessage?.text ||
      msgObj?.imageMessage?.caption || ''

    if (!texto.trim()) return NextResponse.json({ ok: true })

    // Carrega histórico e salva mensagem do usuário
    const historico = await carregarHistorico(telefone)
    await salvarMensagem(telefone, 'user', texto)

    const mensagens: Anthropic.MessageParam[] = [
      ...historico,
      { role: 'user', content: texto }
    ]

    // Loop do agente com ferramentas
    let resposta = ''
    let tentativas = 0

    while (tentativas < 5) {
      tentativas++
      const response = await anthropic.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 1024,
        system: `Você é Francisco, o assistente virtual da Secretaria Municipal de Saúde de Conceição do Tocantins - TO.
Você é simpático, prestativo e fala de forma clara e objetiva, como um atendente profissional.
Responda sempre em português brasileiro.
Seja conciso — mensagens de WhatsApp devem ser curtas e diretas.
Quando não souber algo, diga honestamente e oriente o paciente a ligar ou ir pessoalmente à secretaria.
Não invente informações médicas ou datas que não estejam no sistema.
Data e hora atual: ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Araguaina' })}`,
        messages: mensagens,
        tools
      })

      // Verifica se tem chamadas de ferramentas
      const toolUses = response.content.filter(b => b.type === 'tool_use')

      if (response.stop_reason === 'end_turn' || toolUses.length === 0) {
        // Resposta final
        const textBlock = response.content.find(b => b.type === 'text')
        resposta = (textBlock as any)?.text || 'Desculpe, não consegui processar sua mensagem.'
        break
      }

      // Executa ferramentas
      mensagens.push({ role: 'assistant', content: response.content })

      const resultados: Anthropic.ToolResultBlockParam[] = []
      for (const tool of toolUses) {
        const resultado = await executarFerramenta(tool.name, (tool as any).input)
        resultados.push({
          type: 'tool_result',
          tool_use_id: tool.id,
          content: resultado
        })
      }

      mensagens.push({ role: 'user', content: resultados })
    }

    if (!resposta) resposta = 'Desculpe, não consegui processar sua mensagem no momento. Tente novamente ou ligue para a secretaria.'

    // Salva resposta e envia
    await salvarMensagem(telefone, 'assistant', resposta)
    await enviarMensagem(telefone, resposta)

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    console.error('Webhook Francisco erro:', e)
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 })
  }
}

export async function GET() {
  return NextResponse.json({ ok: true, agente: 'Francisco — SMS Conceição do Tocantins' })
}
