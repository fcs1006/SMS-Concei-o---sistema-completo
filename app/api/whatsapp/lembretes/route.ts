import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const EVOLUTION_URL = process.env.EVOLUTION_API_URL!
const EVOLUTION_KEY = process.env.EVOLUTION_API_KEY!
const EVOLUTION_INSTANCE = process.env.EVOLUTION_INSTANCE!

const CRON_SECRET = process.env.CRON_SECRET || 'sms-conceicao-cron-secret-12345'

// Normaliza e formata o telefone para o formato internacional do WhatsApp (ex: 5563991234567)
function formatarNumeroWhatsapp(tel: string | null): string | null {
  if (!tel) return null
  const clean = tel.replace(/\D/g, '')
  if (clean.length === 0) return null
  
  if (clean.startsWith('55') && (clean.length === 12 || clean.length === 13)) {
    return clean
  }
  
  if (clean.length === 10 || clean.length === 11) {
    return `55${clean}`
  }
  
  if (clean.length === 8 || clean.length === 9) {
    // DDD local de Conceição do Tocantins é 63
    return `5563${clean}`
  }
  
  return clean
}

// Envia mensagem via Evolution API e registra na conversa do WhatsApp do sistema
async function enviarMensagemLembrete(numero: string, texto: string) {
  const isEvolutionConfigured = EVOLUTION_URL && EVOLUTION_KEY && EVOLUTION_INSTANCE

  if (isEvolutionConfigured) {
    const resp = await fetch(`${EVOLUTION_URL}/message/sendText/${EVOLUTION_INSTANCE}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': EVOLUTION_KEY },
      body: JSON.stringify({ number: numero, text: texto })
    })

    if (!resp.ok) {
      const err = await resp.text()
      throw new Error(`Evolution API HTTP ${resp.status}: ${err}`)
    }
  } else {
    console.warn(`[Evolution API MOCK] Lembrete enviado para ${numero}: ${texto}`)
  }

  // Grava no histórico do chat como mensagem do 'assistant' para visualização da secretaria
  await supabase.from('whatsapp_conversas').insert([{
    telefone: numero,
    papel: 'assistant',
    mensagem: `[LEMBRETE AUTOMÁTICO] ${texto}`
  }])
}

// Handler principal para processar os lembretes do dia seguinte
async function processarLembretes(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  const searchParams = new URL(request.url).searchParams
  const queryToken = searchParams.get('token')
  
  const token = authHeader ? authHeader.replace('Bearer ', '').trim() : queryToken
  
  if (token !== CRON_SECRET) {
    return NextResponse.json({ ok: false, error: 'Não autorizado' }, { status: 401 })
  }

  // 1. Obter a data de amanhã no fuso horário local (America/Araguaina)
  const timezone = 'America/Araguaina'
  const nowInTz = new Date(new Date().toLocaleString('en-US', { timeZone: timezone }))
  const tomorrowInTz = new Date(nowInTz)
  tomorrowInTz.setDate(tomorrowInTz.getDate() + 1)
  
  const tomorrowStr = tomorrowInTz.toLocaleDateString('sv-SE', { timeZone: timezone })
  const tomorrowFmt = tomorrowStr.split('-').reverse().join('/')

  const resultados = {
    data: tomorrowStr,
    especialidades: { total: 0, enviados: 0, erros: 0, pulados: 0 },
    sisreg: { total: 0, enviados: 0, erros: 0, pulados: 0 },
    tfd: { total: 0, enviados: 0, erros: 0, pulados: 0 }
  }

  try {
    // 2. Carregar logs de lembretes já enviados para amanhã para evitar duplicidades
    const alreadySentSet = new Set<string>()
    const { data: sentLogs, error: logError } = await supabase
      .from('lembretes_enviados')
      .select('tipo, referencia_id')
      .eq('data_evento', tomorrowStr)

    if (!logError && sentLogs) {
      sentLogs.forEach(log => {
        alreadySentSet.add(`${log.tipo}:${log.referencia_id}`)
      })
    }

    // ─── CATEGORIA 1: CONSULTAS E EXAMES LOCAIS (ESPECIALIDADES) ─────────────────────
    const { data: localAppts, error: localErr } = await supabase
      .from('especialidades_agendamentos')
      .select('*')
      .eq('status', 'autorizado')
      .or(`data_atendimento.eq.${tomorrowStr},and(data_atendimento.is.null,data_consulta.eq.${tomorrowStr})`)

    if (localErr) {
      console.error('Erro ao buscar especialidades:', localErr.message)
    } else if (localAppts) {
      resultados.especialidades.total = localAppts.length
      
      for (const appt of localAppts) {
        const key = `especialidade:${appt.id}`
        if (alreadySentSet.has(key)) {
          resultados.especialidades.pulados++
          continue
        }

        const rawPhone = appt.telefone
        const phoneFormatted = formatarNumeroWhatsapp(rawPhone)

        if (!phoneFormatted) {
          resultados.especialidades.erros++
          console.warn(`[Lembretes] Agendamento especialidade ${appt.id} sem telefone válido.`)
          continue
        }

        try {
          const esp = appt.especialidade || 'Consulta'
          const tipoExame = appt.tipo_exame || 'consulta'
          const profissional = appt.profissional_nome || 'A definir'
          const periodo = appt.periodo ? `Período: ${appt.periodo}` : 'Horário comercial'
          
          const mensagem = `Olá, *${appt.paciente_nome}*! 👋\n\n` +
            `Lembramos que você tem um(a) *${esp.toUpperCase()}* (${tipoExame}) agendado(a) para amanhã (*${tomorrowFmt}*) na Secretaria Municipal de Saúde:\n\n` +
            `👨‍⚕️ Profissional: ${profissional}\n` +
            `⏰ ${periodo}\n\n` +
            `⚠️ Se não puder comparecer, por favor, avise a secretaria com antecedência para podermos liberar a vaga para outro paciente. Obrigado!`

          await enviarMensagemLembrete(phoneFormatted, mensagem)

          // Salva log de envio
          await supabase.from('lembretes_enviados').insert([{
            tipo: 'especialidade',
            referencia_id: String(appt.id),
            data_evento: tomorrowStr,
            telefone: phoneFormatted,
            mensagem
          }])

          resultados.especialidades.enviados++
        } catch (e: any) {
          resultados.especialidades.erros++
          console.error(`Erro ao enviar lembrete especialidade ${appt.id}:`, e.message)
        }
      }
    }

    // ─── CATEGORIA 2: SOLICITAÇÕES DO SISREG ──────────────────────────────────────────
    // Envolve tratamento gracioso caso a tabela ainda não tenha sido criada
    try {
      const startOfDay = `${tomorrowStr}T00:00:00`
      const endOfDay = `${tomorrowStr}T23:59:59`
      
      const { data: sisregAppts, error: sisregErr } = await supabase
        .from('monitoramento_sisreg')
        .select('*')
        .gte('data_marcacao', startOfDay)
        .lte('data_marcacao', endOfDay)
        .not('status_solicitacao', 'ilike', '%cancelado%')
        .not('status_solicitacao', 'ilike', '%excluido%')
        .not('status_solicitacao', 'ilike', '%executado%')
        .not('status_solicitacao', 'ilike', '%concluido%')
        .not('status_solicitacao', 'ilike', '%atendido%')

      if (sisregErr) {
        console.error('Erro ao buscar SISREG:', sisregErr.message)
      } else if (sisregAppts) {
        resultados.sisreg.total = sisregAppts.length

        // Mapeamento de CPFs sem telefone no SISREG para buscar na base de pacientes
        const cpfsSemTelefone = sisregAppts
          .filter(s => !s.telefone || s.telefone.replace(/\D/g, '').length < 8)
          .map(s => s.cpf_usuario)
          .filter(Boolean)

        let phoneMap = new Map<string, string>()
        if (cpfsSemTelefone.length > 0) {
          const { data: pacs } = await supabase
            .from('pacientes')
            .select('cpf_cns, telefone')
            .in('cpf_cns', cpfsSemTelefone)
          
          if (pacs) {
            pacs.forEach(p => {
              if (p.telefone) phoneMap.set(p.cpf_cns, p.telefone)
            })
          }
        }

        for (const sol of sisregAppts) {
          const key = `sisreg:${sol.codigo_solicitacao}`
          if (alreadySentSet.has(key)) {
            resultados.sisreg.pulados++
            continue
          }

          let rawPhone = sol.telefone
          if (!rawPhone || rawPhone.replace(/\D/g, '').length < 8) {
            rawPhone = phoneMap.get(sol.cpf_usuario) || null
          }

          const phoneFormatted = formatarNumeroWhatsapp(rawPhone)

          if (!phoneFormatted) {
            resultados.sisreg.erros++
            console.warn(`[Lembretes] SISREG ${sol.codigo_solicitacao} sem telefone válido cadastrado.`)
            continue
          }

          try {
            const dataObj = new Date(sol.data_marcacao)
            const hora = dataObj.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: timezone })
            const procedimento = sol.descricao_interna_procedimento || 'Procedimento regulado'
            const local = sol.nome_unidade_solicitante || 'Local regulado'

            const mensagem = `Olá, *${sol.no_usuario}*! 👋\n\n` +
              `Lembramos que você tem um procedimento regulado pelo *SISREG* agendado para amanhã (*${tomorrowFmt}*) às *${hora}*:\n\n` +
              `🩺 *${procedimento.toUpperCase()}*\n` +
              `📍 Local: ${local}\n\n` +
              `⚠️ Por favor, compareça no horário e local indicados com seus documentos. Caso não possa comparecer, comunique a secretaria de saúde o quanto antes.`

            await enviarMensagemLembrete(phoneFormatted, mensagem)

            // Salva log de envio
            await supabase.from('lembretes_enviados').insert([{
              tipo: 'sisreg',
              referencia_id: String(sol.codigo_solicitacao),
              data_evento: tomorrowStr,
              telefone: phoneFormatted,
              mensagem
            }])

            resultados.sisreg.enviados++
          } catch (e: any) {
            resultados.sisreg.erros++
            console.error(`Erro ao enviar lembrete SISREG ${sol.codigo_solicitacao}:`, e.message)
          }
        }
      }
    } catch (e: any) {
      console.warn('[Lembretes] A tabela monitoramento_sisreg não foi encontrada ou está indisponível:', e.message)
    }

    // ─── CATEGORIA 3: VIAGENS TFD ─────────────────────────────────────────────────────
    const { data: travels, error: travelErr } = await supabase
      .from('viagens')
      .select('*')
      .eq('data_viagem', tomorrowStr)

    if (travelErr) {
      console.error('Erro ao buscar viagens TFD:', travelErr.message)
    } else if (travels) {
      resultados.tfd.total = travels.length

      // TFD não tem coluna telefone na tabela viagens, precisamos buscar da tabela de pacientes
      const cpfsPacientes = [...new Set(travels.map(t => t.paciente_cpf).filter(Boolean))]
      
      let phoneMap = new Map<string, string>()
      if (cpfsPacientes.length > 0) {
        const { data: pacs } = await supabase
          .from('pacientes')
          .select('cpf_cns, telefone')
          .in('cpf_cns', cpfsPacientes)
        
        if (pacs) {
          pacs.forEach(p => {
            if (p.telefone) phoneMap.set(p.cpf_cns, p.telefone)
          })
        }
      }

      for (const travel of travels) {
        const key = `tfd:${travel.id}`
        if (alreadySentSet.has(key)) {
          resultados.tfd.pulados++
          continue
        }

        const rawPhone = phoneMap.get(travel.paciente_cpf) || null
        const phoneFormatted = formatarNumeroWhatsapp(rawPhone)

        if (!phoneFormatted) {
          resultados.tfd.erros++
          console.warn(`[Lembretes] Viagem TFD ${travel.id} sem telefone cadastrado no paciente.`)
          continue
        }

        try {
          const destino = travel.destino || 'Destino TFD'
          const localDestino = travel.local_destino ? ` (${travel.local_destino})` : ''
          const horaSaida = travel.hora || 'A definir'
          
          let acompText = 'Não possui'
          if (travel.tem_acomp === 'SIM' || travel.tem_acomp === 'sim') {
            acompText = travel.acomp1_nome || 'Cadastrado'
            if (travel.acomp2_nome) {
              acompText += ` e ${travel.acomp2_nome}`
            }
          }

          const mensagem = `Olá, *${travel.paciente_nome}*! 🚗\n\n` +
            `Lembramos que sua viagem de *TFD (Tratamento Fora de Domicílio)* está agendada para amanhã (*${tomorrowFmt}*):\n\n` +
            `📍 Destino: ${destino}${localDestino}\n` +
            `⏰ Horário de Saída: *${horaSaida}*\n` +
            `🏢 Local de Saída: *Secretaria Municipal de Saúde (SMS)*\n` +
            `👥 Acompanhante: ${acompText}\n\n` +
            `⚠️ Recomendamos comparecer com 15 minutos de antecedência. Não esqueça seus documentos pessoais e o encaminhamento de viagem. Boa viagem!`

          await enviarMensagemLembrete(phoneFormatted, mensagem)

          // Salva log de envio
          await supabase.from('lembretes_enviados').insert([{
            tipo: 'tfd',
            referencia_id: String(travel.id),
            data_evento: tomorrowStr,
            telefone: phoneFormatted,
            mensagem
          }])

          resultados.tfd.enviados++
        } catch (e: any) {
          resultados.tfd.erros++
          console.error(`Erro ao enviar lembrete TFD ${travel.id}:`, e.message)
        }
      }
    }

  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message, resultados }, { status: 500 })
  }

  return NextResponse.json({ ok: true, resultados })
}

export async function GET(request: NextRequest) {
  return processarLembretes(request)
}

export async function POST(request: NextRequest) {
  return processarLembretes(request)
}
