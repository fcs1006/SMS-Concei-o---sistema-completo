import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServer } from '@/lib/supabaseServer'
import { getActiveClientConfig } from '@/lib/config'
import { formatarNumeroWhatsapp, enviarMensagemLembrete, enviarBotoesLembrete, obterCpfVariacoes, substituirVariaveis } from '@/lib/whatsapp'


const CRON_SECRET = process.env.CRON_SECRET || 'sms-conceicao-cron-secret-12345'

// Função auxiliar para analisar carimbos de data/hora (timestamps) no fuso horário America/Araguaina (UTC-3)
// se não houver um sufixo de fuso horário, para evitar distorções em servidores (como Vercel) rodando em UTC.
function parseTimestampToTz(timestampStr: string | null | undefined): Date | null {
  if (!timestampStr) return null
  
  // Substitui espaço por T
  let normalized = timestampStr.trim().replace(' ', 'T')
  
  // Se não contiver T, trata como data pura sem hora
  if (!normalized.includes('T')) {
    return new Date(`${normalized}T00:00:00-03:00`)
  }
  
  // Verifica se já tem indicador de fuso horário (Z ou +/- offset)
  const parts = normalized.split('T')
  const timePart = parts[1] || ''
  const hasTz = /Z|[+-]\d{2}(:?\d{2})?$/.test(timePart)
  
  if (hasTz) {
    return new Date(normalized)
  }
  
  return new Date(`${normalized}-03:00`)
}

// Despacha o lembrete de acordo com a configuração de modo (manual ou automático)
async function despacharLembrete({
  modoManual,
  tipo,
  referencia_id,
  data_evento,
  paciente_nome,
  telefone,
  mensagem,
  botoes,
  assistantName
}: {
  modoManual: boolean
  tipo: string
  referencia_id: string
  data_evento: string
  paciente_nome: string
  telefone: string
  mensagem: string
  botoes?: Array<{ id: string, label: string }>
  assistantName: string
}) {
  const supabase = getSupabaseServer()
  if (modoManual) {
    const { error } = await supabase.from('lembretes_pendentes').upsert([{
      tipo,
      referencia_id,
      data_evento,
      paciente_nome,
      telefone,
      mensagem,
      botoes: botoes || null
    }], { onConflict: 'tipo,referencia_id,data_evento' })
    
    if (error) {
      console.error(`[Lembretes] Erro ao salvar lembrete pendente para ${telefone}:`, error.message)
      throw new Error(error.message)
    }
  } else {
    if (botoes && botoes.length > 0) {
      const title = 'Aviso de Agendamento'
      await enviarBotoesLembrete(telefone, title, mensagem, botoes, assistantName)
    } else {
      await enviarMensagemLembrete(telefone, mensagem)
    }

    // Salva log de envio na tabela de controle de duplicidades
    const { error: insertErr } = await supabase.from('lembretes_enviados').insert([{
      tipo,
      referencia_id,
      data_evento,
      telefone,
      mensagem
    }])
    if (insertErr) throw new Error(insertErr.message)
  }
}

// Handler principal para processar os lembretes do dia seguinte
async function processarLembretes(request: NextRequest) {
  const supabase = getSupabaseServer()
  const clientConfig = await getActiveClientConfig()
  const modoManual = clientConfig.modoLembrete === 'manual'

  const authHeader = request.headers.get('authorization')
  const searchParams = new URL(request.url).searchParams
  const queryToken = searchParams.get('token')
  const userCpf = searchParams.get('userCpf')
  const targetTipo = searchParams.get('tipo')?.toLowerCase() // 'tfd', 'consultas', ou null/vazio para todos
  
  const token = authHeader ? authHeader.replace('Bearer ', '').trim() : queryToken

  const userAgent = request.headers.get('user-agent') || 'Não identificado'
  const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'IP não identificado'

  // Grava log de diagnóstico para sabermos quem chamou a API e em qual horário
  try {
    await supabase.from('whatsapp_conversas').insert([{
      telefone: '5500000000000',
      papel: 'assistant',
      mensagem: `[CRON DIAGNOSTICO] Chamada. Tipo: ${targetTipo || 'todos'}, Token: ${token ? 'Sim' : 'Não'}, CPF: ${userCpf || 'Não'}, User-Agent: ${userAgent}, IP: ${ip}`
    }])
  } catch (err) {
    console.error('Erro ao gravar log de diagnóstico de cron:', err)
  }
  
  let isAuthorized = false
  if (token === CRON_SECRET) {
    isAuthorized = true
  } else if (userCpf) {
    // Valida se o usuário é ativo no banco
    const { data: user, error: userErr } = await supabase
      .from('usuarios')
      .select('ativo')
      .eq('usuario', userCpf)
      .eq('ativo', true)
      .maybeSingle()

    if (!userErr && user) {
      isAuthorized = true
    }
  }

  if (!isAuthorized) {
    return NextResponse.json({ ok: false, error: 'Não autorizado' }, { status: 401 })
  }

  const timezone = 'America/Araguaina'
  const nowInTz = new Date(new Date().toLocaleString('en-US', { timeZone: timezone }))

  // Bloqueio de disparos automáticos fora da janela de horário de atendimento permitida (08:00 às 21:00)
  // Somente aplica se for disparado automaticamente (quando NÃO for passado o CPF de um administrador)
  if (!userCpf) {
    const horaLocal = nowInTz.getHours()
    if (horaLocal < 8 || horaLocal >= 21) {
      console.warn(`[Lembretes] Bloqueado disparo automático fora de horário. Hora local: ${horaLocal}h`)
      return NextResponse.json({ 
        ok: true, 
        mensagem: `Execução ignorada: fora do horário de atendimento permitido (08:00 às 21:00). Hora local em Brasília: ${horaLocal}h` 
      })
    }
  }

  // 1. Obter a data de amanhã no fuso horário local (America/Araguaina)
  const tomorrowInTz = new Date(nowInTz)
  tomorrowInTz.setDate(tomorrowInTz.getDate() + 1)
  
  const todayStr = nowInTz.toLocaleDateString('sv-SE', { timeZone: timezone })
  const tomorrowStr = tomorrowInTz.toLocaleDateString('sv-SE', { timeZone: timezone })
  const tomorrowFmt = tomorrowStr.split('-').reverse().join('/')

  const resultados = {
    data: tomorrowStr,
    modo: modoManual ? 'manual' : 'automatico',
    especialidades: { total: 0, enviados: 0, erros: 0, pulados: 0 },
    sisreg: { total: 0, enviados: 0, erros: 0, pulados: 0 },
    tfd: { total: 0, enviados: 0, erros: 0, pulados: 0 }
  }

  try {
    // 2. Carregar logs de lembretes a partir de hoje para evitar duplicidades
    const alreadySentSet = new Set<string>()
    const { data: sentLogs, error: logError } = await supabase
      .from('lembretes_enviados')
      .select('tipo, referencia_id, data_evento')
      .gte('data_evento', todayStr)

    if (!logError && sentLogs) {
      sentLogs.forEach(log => {
        alreadySentSet.add(`${log.tipo}:${log.referencia_id}:${log.data_evento}`)
      })
    }

    // Carregar também os lembretes salvos como PENDENTES no modo manual
    try {
      const { data: pendingLogs, error: pendingErr } = await supabase
        .from('lembretes_pendentes')
        .select('id, tipo, referencia_id, data_evento')
        .gte('data_evento', todayStr)

      if (!pendingErr && pendingLogs) {
        // Limpeza de Lembretes Órfãos (cujo agendamento/viagem de origem foi deletado)
        const tfdIds = pendingLogs.filter(p => p.tipo.startsWith('tfd')).map(p => p.referencia_id).filter(Boolean)
        const espIds = pendingLogs.filter(p => p.tipo.startsWith('esp')).map(p => p.referencia_id).filter(Boolean)
        const sisIds = pendingLogs.filter(p => p.tipo.startsWith('sis')).map(p => p.referencia_id).filter(Boolean)

        const orphanedIds: number[] = []

        // 1. TFD (Viagens)
        if (tfdIds.length > 0) {
          const { data: existingTfd } = await supabase
            .from('viagens')
            .select('id')
            .in('id', tfdIds)
          const existingTfdSet = new Set(existingTfd?.map(t => String(t.id)) || [])
          pendingLogs.forEach(p => {
            if (p.tipo.startsWith('tfd') && !existingTfdSet.has(String(p.referencia_id))) {
              orphanedIds.push(p.id)
            }
          })
        }

        // 2. Especialidades Locais
        if (espIds.length > 0) {
          const { data: existingEsp } = await supabase
            .from('especialidades_agendamentos')
            .select('id')
            .in('id', espIds)
          const existingEspSet = new Set(existingEsp?.map(e => String(e.id)) || [])
          pendingLogs.forEach(p => {
            if (p.tipo.startsWith('esp') && !existingEspSet.has(String(p.referencia_id))) {
              orphanedIds.push(p.id)
            }
          })
        }

        // 3. SISREG
        if (sisIds.length > 0) {
          try {
            const { data: existingSis } = await supabase
              .from('monitoramento_sisreg')
              .select('codigo_solicitacao')
              .in('codigo_solicitacao', sisIds.map(id => parseInt(id)).filter(id => !isNaN(id)))
            const existingSisSet = new Set(existingSis?.map(s => String(s.codigo_solicitacao)) || [])
            pendingLogs.forEach(p => {
              if (p.tipo.startsWith('sis') && !existingSisSet.has(String(p.referencia_id))) {
                orphanedIds.push(p.id)
              }
            })
          } catch (e) {
            // Ignora se a tabela monitoramento_sisreg não existir
          }
        }

        // Deleta os órfãos do banco
        if (orphanedIds.length > 0) {
          await supabase.from('lembretes_pendentes').delete().in('id', orphanedIds)
          console.log(`[Lembretes] Removidos ${orphanedIds.length} lembretes órfãos do banco de dados.`)
        }

        // Filtra os logs pendentes ativos que restaram para adicionar ao alreadySentSet
        const activePendingLogs = pendingLogs.filter(p => !orphanedIds.includes(p.id))
        activePendingLogs.forEach(log => {
          alreadySentSet.add(`${log.tipo}:${log.referencia_id}:${log.data_evento}`)
        })
      }
    } catch (e: any) {
      console.warn('[Lembretes] Tabela lembretes_pendentes indisponível para carregar duplicidades:', e.message)
    }

    // ─── CATEGORIA 1: CONSULTAS E EXAMES LOCAIS (ESPECIALIDADES) ─────────────────────
    if (!targetTipo || targetTipo === 'consultas') {
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
          const key = `esp_vesp:${appt.id}:${tomorrowStr}`
          if (alreadySentSet.has(key)) {
            resultados.especialidades.pulados++
            continue
          }

          const rawPhone = appt.telefone
          const phoneFormatted = formatarNumeroWhatsapp(rawPhone, clientConfig.defaultDDD)

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
            
            const defaultMsg = `Olá, *${appt.paciente_nome}*! 👋\n\n` +
              `Lembramos que você tem um(a) *${esp.toUpperCase()}* (${tipoExame}) agendado(a) para amanhã (*${tomorrowFmt}*) na Secretaria Municipal de Saúde de ${clientConfig.municipalityName}:\n\n` +
              `👨‍⚕️ Profissional: ${profissional}\n` +
              `⏰ ${periodo}\n\n` +
              `⚠️ Se não puder comparecer, por favor, avise a secretaria com antecedência para podermos liberar a vaga para outro paciente. Obrigado!`

            const variables = {
              paciente_nome: appt.paciente_nome,
              especialidade: esp,
              tipo_exame: tipoExame,
              data_evento: tomorrowFmt,
              profissional: profissional,
              periodo: periodo,
              municipio: clientConfig.municipalityName,
              assistente_nome: clientConfig.assistantName
            }

            const mensagem = clientConfig.template_esp_vesp
              ? substituirVariaveis(clientConfig.template_esp_vesp, variables)
              : defaultMsg

            await despacharLembrete({
              modoManual,
              tipo: 'esp_vesp',
              referencia_id: String(appt.id),
              data_evento: tomorrowStr,
              paciente_nome: appt.paciente_nome,
              telefone: phoneFormatted,
              mensagem,
              assistantName: clientConfig.assistantName
            })

            resultados.especialidades.enviados++
          } catch (e: any) {
            resultados.especialidades.erros++
            console.error(`Erro ao enviar lembrete especialidade ${appt.id}:`, e.message)
          }
        }
      }
    }

    // ─── CATEGORIA 2: SOLICITAÇÕES DO SISREG (DESATIVADO PARA EVITAR DUPLICIDADE COM AUTORIZAÇÃO E TFD) ───
    /*
    if (!targetTipo || targetTipo === 'consultas') {
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
            const variacoesCpfs = cpfsSemTelefone.flatMap(cpf => obterCpfVariacoes(cpf))
            const { data: pacs } = await supabase
              .from('pacientes')
              .select('cpf_cns, telefone')
              .in('cpf_cns', variacoesCpfs)
            
            if (pacs) {
              pacs.forEach(p => {
                if (p.telefone) {
                  phoneMap.set(p.cpf_cns, p.telefone)
                  const clean = p.cpf_cns.replace(/\D/g, '')
                  phoneMap.set(clean, p.telefone)
                  if (clean.length === 11) {
                    const formatted = `${clean.substring(0, 3)}.${clean.substring(3, 6)}.${clean.substring(6, 9)}-${clean.substring(9)}`
                    phoneMap.set(formatted, p.telefone)
                  }
                }
              })
            }
          }

          for (const sol of sisregAppts) {
            const key = `sis_vesp:${sol.codigo_solicitacao}:${tomorrowStr}`
            if (alreadySentSet.has(key)) {
              resultados.sisreg.pulados++
              continue
            }

            let rawPhone = sol.telefone
            if (!rawPhone || rawPhone.replace(/\D/g, '').length < 8) {
              rawPhone = phoneMap.get(sol.cpf_usuario) || null
            }

            const phoneFormatted = formatarNumeroWhatsapp(rawPhone, clientConfig.defaultDDD)

            if (!phoneFormatted) {
              resultados.sisreg.erros++
              console.warn(`[Lembretes] SISREG ${sol.codigo_solicitacao} sem telefone válido cadastrado.`)
              continue
            }

            try {
              const dataObj = parseTimestampToTz(sol.data_marcacao)
              if (!dataObj) continue
              const hora = dataObj.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: timezone })
              const procedimento = sol.descricao_interna_procedimento || 'Procedimento regulado'
              const local = sol.nome_unidade_executante || sol.nome_unidade_solicitante || 'Local regulado'

              const defaultMsg = `Olá, *${sol.no_usuario}*! 👋\n\n` +
                `Lembramos que você tem um procedimento regulado pelo *SISREG* agendado para amanhã (*${tomorrowFmt}*) às *${hora}*:\n\n` +
                `🩺 *${procedimento.toUpperCase()}*\n` +
                `📍 Local: ${local}\n\n` +
                `⚠️ Por favor, compareça no horário e local indicados com seus documentos. Caso não possa comparecer, comunique a secretaria de saúde o quanto antes.`

              const variables = {
                paciente_nome: sol.no_usuario,
                procedimento: procedimento,
                data_evento: tomorrowFmt,
                horario: hora,
                local: local,
                municipio: clientConfig.municipalityName,
                assistente_nome: clientConfig.assistantName
              }

              const mensagem = clientConfig.template_sis_vesp
                ? substituirVariaveis(clientConfig.template_sis_vesp, variables)
                : defaultMsg

              await despacharLembrete({
                modoManual,
                tipo: 'sis_vesp',
                referencia_id: String(sol.codigo_solicitacao),
                data_evento: tomorrowStr,
                paciente_nome: sol.no_usuario,
                telefone: phoneFormatted,
                mensagem,
                assistantName: clientConfig.assistantName
              })

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
    }
    */

    // ─── CATEGORIA 3: VIAGENS TFD ─────────────────────────────────────────────────────
    if (!targetTipo || targetTipo === 'tfd') {
      const { data: travels, error: travelErr } = await supabase
        .from('viagens')
        .select('*')
        .eq('data_viagem', tomorrowStr)

      if (travelErr) {
        console.error('Erro ao buscar viagens TFD:', travelErr.message)
      } else if (travels) {
        resultados.tfd.total = travels.length

        // TFD não tem coluna telefone na tabela viagens, precisamos buscar da tabela de pacientes
        const cpfsPacientes = [...new Set(
          travels.flatMap(t => [t.paciente_cpf, t.acomp1_cpf, t.acomp2_cpf].filter(Boolean))
        )]
        
        let phoneMap = new Map<string, string>()
        let nameMap = new Map<string, string>()
        if (cpfsPacientes.length > 0) {
          const variacoesCpfs = cpfsPacientes.flatMap(cpf => obterCpfVariacoes(cpf))
          const { data: pacs } = await supabase
            .from('pacientes')
            .select('cpf_cns, telefone, nome')
            .in('cpf_cns', variacoesCpfs)
          
          if (pacs) {
            pacs.forEach(p => {
              if (p.telefone) {
                phoneMap.set(p.cpf_cns, p.telefone)
                const clean = p.cpf_cns.replace(/\D/g, '')
                phoneMap.set(clean, p.telefone)
                if (clean.length === 11) {
                  const formatted = `${clean.substring(0, 3)}.${clean.substring(3, 6)}.${clean.substring(6, 9)}-${clean.substring(9)}`
                  phoneMap.set(formatted, p.telefone)
                }
              }
              if (p.nome) {
                nameMap.set(p.cpf_cns, p.nome)
                const clean = p.cpf_cns.replace(/\D/g, '')
                nameMap.set(clean, p.nome)
                if (clean.length === 11) {
                  const formatted = `${clean.substring(0, 3)}.${clean.substring(3, 6)}.${clean.substring(6, 9)}-${clean.substring(9)}`
                  nameMap.set(formatted, p.nome)
                }
              }
            })
          }
        }

        for (const travel of travels) {
          const key = `tfd_vesp:${travel.id}:${tomorrowStr}`
          if (alreadySentSet.has(key)) {
            resultados.tfd.pulados++
            continue
          }

          const rawPhone = phoneMap.get(travel.paciente_cpf) || null
          const phoneFormatted = formatarNumeroWhatsapp(rawPhone, clientConfig.defaultDDD)

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
              const acomp1 = travel.acomp1_nome || (travel.acomp1_cpf ? nameMap.get(travel.acomp1_cpf) : '') || 'Cadastrado'
              acompText = acomp1
              const acomp2 = travel.acomp2_nome || (travel.acomp2_cpf ? nameMap.get(travel.acomp2_cpf) : '')
              if (acomp2) {
                acompText += ` e ${acomp2}`
              }
            }

            const defaultMsg = `Olá, *${travel.paciente_nome}*! 🚗\n\n` +
              `Lembramos que sua viagem de *TFD (Tratamento Fora de Domicílio)* está agendada para amanhã (*${tomorrowFmt}*):\n\n` +
              `📍 Destino: ${destino}${localDestino}\n` +
              `⏰ Horário de Saída: *${horaSaida}*\n` +
              `🏢 Local de Saída: *Secretaria Municipal de Saúde de ${clientConfig.municipalityName}*\n` +
              `👥 Acompanhante: ${acompText}\n\n` +
              `⚠️ Recomendamos comparecer com 15 minutos de antecedência. Não esqueça seus documentos pessoais e o encaminhamento de viagem. Boa viagem!`

            const variables = {
              paciente_nome: travel.paciente_nome,
              data_evento: tomorrowFmt,
              destino: `${destino}${localDestino}`,
              horario_saida: horaSaida,
              acompanhante: acompText,
              municipio: clientConfig.municipalityName,
              assistente_nome: clientConfig.assistantName
            }

            const mensagem = clientConfig.template_tfd_vesp
              ? substituirVariaveis(clientConfig.template_tfd_vesp, variables)
              : defaultMsg

            await despacharLembrete({
              modoManual,
              tipo: 'tfd_vesp',
              referencia_id: String(travel.id),
              data_evento: tomorrowStr,
              paciente_nome: travel.paciente_nome,
              telefone: phoneFormatted,
              mensagem,
              botoes: [
                { id: `TFD_CONFIRMAR_${travel.id}`, label: 'Sim, vou viajar' },
                { id: `TFD_DESISTIR_${travel.id}`, label: 'Não vou viajar' }
              ],
              assistantName: clientConfig.assistantName
            })

            resultados.tfd.enviados++
          } catch (e: any) {
            resultados.tfd.erros++
            console.error(`Erro ao enviar lembrete TFD ${travel.id}:`, e.message)
          }
        }
      }
    }

    // ─── CATEGORIA 4: NOTIFICAÇÃO DE AUTORIZAÇÕES (DISPARADA VIA VARREDURA) ──────────
    if (targetTipo === 'autorizacoes') {
      // 1. Especialidades locais autorizadas para hoje ou depois
      const { data: futureLocalAppts, error: localAuthErr } = await supabase
        .from('especialidades_agendamentos')
        .select('*')
        .eq('status', 'autorizado')
        .or(`data_atendimento.gte.${todayStr},and(data_atendimento.is.null,data_consulta.gte.${todayStr})`)

      if (localAuthErr) {
        console.error('Erro ao buscar autorizações locais:', localAuthErr.message)
      } else if (futureLocalAppts) {
        resultados.especialidades.total = futureLocalAppts.length

        for (const appt of futureLocalAppts) {
          const eventDate = appt.data_atendimento || appt.data_consulta
          const key = `esp_auto:${appt.id}:${eventDate}`
          
          if (alreadySentSet.has(key)) {
            resultados.especialidades.pulados++
            continue
          }

          const rawPhone = appt.telefone
          const phoneFormatted = formatarNumeroWhatsapp(rawPhone, clientConfig.defaultDDD)

          if (!phoneFormatted) {
            resultados.especialidades.erros++
            continue
          }

          try {
            const esp = appt.especialidade || 'Consulta'
            const tipoExame = appt.tipo_exame || 'consulta'
            const profissional = appt.profissional_nome || 'A definir'
            const periodo = appt.periodo ? `Período: ${appt.periodo}` : 'Horário comercial'
            const eventDateFmt = eventDate.split('-').reverse().join('/')

            const defaultMsg = `Olá, *${appt.paciente_nome}*! 🎉\n\n` +
              `Temos uma boa notícia! O seu agendamento de *${esp.toUpperCase()}* (${tipoExame}) foi *AUTORIZADO* e agendado para:\n\n` +
              `📅 Data: *${eventDateFmt}*\n` +
              `👨‍⚕️ Profissional: ${profissional}\n` +
              `⏰ ${periodo}\n\n` +
              `🏢 Local: Secretaria Municipal de Saúde de ${clientConfig.municipalityName} (ou local indicado)\n\n` +
              `⚠️ *Importante:* Compareça à Secretaria Municipal de Saúde de ${clientConfig.municipalityName} para obter mais informações, realizar a retirada da sua autorização e agendar a viagem (caso vá utilizar o transporte sanitário do município).`

            const variables = {
              paciente_nome: appt.paciente_nome,
              especialidade: esp,
              tipo_exame: tipoExame,
              data_evento: eventDateFmt,
              profissional: profissional,
              periodo: periodo,
              municipio: clientConfig.municipalityName,
              assistente_nome: clientConfig.assistantName
            }

            const mensagem = clientConfig.template_esp_auto
              ? substituirVariaveis(clientConfig.template_esp_auto, variables)
              : defaultMsg

            await despacharLembrete({
              modoManual,
              tipo: 'esp_auto',
              referencia_id: String(appt.id),
              data_evento: eventDate,
              paciente_nome: appt.paciente_nome,
              telefone: phoneFormatted,
              mensagem,
              assistantName: clientConfig.assistantName
            })

            resultados.especialidades.enviados++
          } catch (e: any) {
            resultados.especialidades.erros++
            console.error(`Erro ao enviar autorização especialidade ${appt.id}:`, e.message)
          }
        }
      }

      // 2. SISREG autorizados para hoje ou depois
      try {
        const todayStart = `${todayStr}T00:00:00`
        const { data: futureSisregAppts, error: sisregAuthErr } = await supabase
          .from('monitoramento_sisreg')
          .select('*')
          .gte('data_marcacao', todayStart)
          .not('status_solicitacao', 'ilike', '%cancelado%')
          .not('status_solicitacao', 'ilike', '%excluido%')
          .not('status_solicitacao', 'ilike', '%executado%')
          .not('status_solicitacao', 'ilike', '%concluido%')
          .not('status_solicitacao', 'ilike', '%atendido%')

        if (sisregAuthErr) {
          console.error('Erro ao buscar autorizações SISREG:', sisregAuthErr.message)
        } else if (futureSisregAppts) {
          resultados.sisreg.total = futureSisregAppts.length

          const cpfsSemTelefone = futureSisregAppts
            .filter(s => !s.telefone || s.telefone.replace(/\D/g, '').length < 8)
            .map(s => s.cpf_usuario)
            .filter(Boolean)

          let phoneMap = new Map<string, string>()
          if (cpfsSemTelefone.length > 0) {
            const variacoesCpfs = cpfsSemTelefone.flatMap(cpf => obterCpfVariacoes(cpf))
            const { data: pacs } = await supabase
              .from('pacientes')
              .select('cpf_cns, telefone')
              .in('cpf_cns', variacoesCpfs)
            
            if (pacs) {
              pacs.forEach(p => {
                if (p.telefone) {
                  phoneMap.set(p.cpf_cns, p.telefone)
                  const clean = p.cpf_cns.replace(/\D/g, '')
                  phoneMap.set(clean, p.telefone)
                  if (clean.length === 11) {
                    const formatted = `${clean.substring(0, 3)}.${clean.substring(3, 6)}.${clean.substring(6, 9)}-${clean.substring(9)}`
                    phoneMap.set(formatted, p.telefone)
                  }
                }
              })
            }
          }

          for (const sol of futureSisregAppts) {
            const eventDate = sol.data_marcacao.split('T')[0]
            const key = `sis_auto:${sol.codigo_solicitacao}:${eventDate}`

            if (alreadySentSet.has(key)) {
              resultados.sisreg.pulados++
              continue
            }

            let rawPhone = sol.telefone
            if (!rawPhone || rawPhone.replace(/\D/g, '').length < 8) {
              rawPhone = phoneMap.get(sol.cpf_usuario) || null
            }

            const phoneFormatted = formatarNumeroWhatsapp(rawPhone, clientConfig.defaultDDD)

            if (!phoneFormatted) {
              resultados.sisreg.erros++
              continue
            }

            try {
              const dataObj = parseTimestampToTz(sol.data_marcacao)
              if (!dataObj) continue
              const hora = dataObj.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: timezone })
              const procedimento = sol.descricao_interna_procedimento || 'Procedimento regulado'
              const local = sol.nome_unidade_executante || sol.nome_unidade_solicitante || 'Local regulado'
              const eventDateFmt = eventDate.split('-').reverse().join('/')

              const defaultMsg = `Olá, *${sol.no_usuario}*! 🎉\n\n` +
                `Temos uma boa notícia! O seu procedimento do *SISREG* foi *AUTORIZADO* e agendado para:\n\n` +
                `🩺 *${procedimento.toUpperCase()}*\n` +
                `📅 Data: *${eventDateFmt}* às *${hora}*\n` +
                `📍 Local: ${local}\n\n` +
                `⚠️ *Importante:* Compareça à Secretaria Municipal de Saúde de ${clientConfig.municipalityName} para obter mais informações, realizar a retirada da sua autorização e agendar a viagem (caso vá utilizar o transporte sanitário do município).`

              const variables = {
                paciente_nome: sol.no_usuario,
                procedimento: procedimento,
                data_evento: eventDateFmt,
                horario: hora,
                local: local,
                municipio: clientConfig.municipalityName,
                assistente_nome: clientConfig.assistantName
              }

              const mensagem = clientConfig.template_sis_auto
                ? substituirVariaveis(clientConfig.template_sis_auto, variables)
                : defaultMsg

              await despacharLembrete({
                modoManual,
                tipo: 'sis_auto',
                referencia_id: String(sol.codigo_solicitacao),
                data_evento: eventDate,
                paciente_nome: sol.no_usuario,
                telefone: phoneFormatted,
                mensagem,
                assistantName: clientConfig.assistantName
              })

              resultados.sisreg.enviados++
            } catch (e: any) {
              resultados.sisreg.erros++
              console.error(`Erro ao enviar autorização SISREG ${sol.codigo_solicitacao}:`, e.message)
            }
          }
        }
      } catch (e: any) {
        console.warn('[Lembretes] Tabela monitoramento_sisreg indisponível para varredura de autorizações:', e.message)
      }
    }

    // ─── CATEGORIA 5: LEMBRETE DE 5 DIAS DE VÉSPERA (CONFIRMAÇÕES DE GUIA/TFD) ─────────
    if (targetTipo === '5dias') {
      const fiveDaysAheadInTz = new Date(nowInTz)
      fiveDaysAheadInTz.setDate(fiveDaysAheadInTz.getDate() + 5)
      const fiveDaysAheadStr = fiveDaysAheadInTz.toLocaleDateString('sv-SE', { timeZone: timezone })
      const fiveDaysAheadFmt = fiveDaysAheadStr.split('-').reverse().join('/')

      // 1. Especialidades locais daqui a 5 dias (DESATIVADO CONFORME SOLICITAÇÃO DO USUÁRIO)
      /*
      const { data: localAppts5d, error: localErr5d } = await supabase
        .from('especialidades_agendamentos')
        .select('*')
        .eq('status', 'autorizado')
        .or(`data_atendimento.eq.${fiveDaysAheadStr},and(data_atendimento.is.null,data_consulta.eq.${fiveDaysAheadStr})`)

      if (localErr5d) {
        console.error('Erro ao buscar especialidades de 5 dias:', localErr5d.message)
      } else if (localAppts5d) {
        resultados.especialidades.total = localAppts5d.length

        for (const appt of localAppts5d) {
          const key = `esp_5d:${appt.id}:${fiveDaysAheadStr}`
          if (alreadySentSet.has(key)) {
            resultados.especialidades.pulados++
            continue
          }

          const rawPhone = appt.telefone
          const phoneFormatted = formatarNumeroWhatsapp(rawPhone, clientConfig.defaultDDD)

          if (!phoneFormatted) {
            resultados.especialidades.erros++
            continue
          }

          try {
            const esp = appt.especialidade || 'Consulta'
            const tipoExame = appt.tipo_exame || 'consulta'
            const profissional = appt.profissional_nome || 'A definir'
            const periodo = appt.periodo ? `Período: ${appt.periodo}` : 'Horário comercial'

            // Obter CPF do paciente para buscar no TFD
            let cpf: string | null = null
            if (appt.paciente_cns && appt.paciente_cns.replace(/\D/g, '').length === 11) {
              cpf = appt.paciente_cns.replace(/\D/g, '')
            } else {
              const { data: pac } = await supabase
                .from('pacientes')
                .select('cpf_cns')
                .or(`cpf_cns.eq.${appt.paciente_cns || ''},nome.ilike.${appt.paciente_nome}`)
                .maybeSingle()
              if (pac && pac.cpf_cns && pac.cpf_cns.replace(/\D/g, '').length === 11) {
                cpf = pac.cpf_cns.replace(/\D/g, '')
              }
            }

            let jaAgendadoTfd = false
            if (cpf) {
              const variacoes = obterCpfVariacoes(cpf)
              const { data: travelData } = await supabase
                .from('viagens')
                .select('id')
                .eq('data_viagem', fiveDaysAheadStr)
                .or(`paciente_cpf.eq.${variacoes[0]},paciente_cpf.eq.${variacoes[1]}`)

              if (travelData && travelData.length > 0) {
                jaAgendadoTfd = true
              }
            }

            const variables = {
              paciente_nome: appt.paciente_nome,
              especialidade: esp,
              tipo_exame: tipoExame,
              data_evento: fiveDaysAheadFmt,
              profissional: profissional,
              periodo: periodo,
              municipio: clientConfig.municipalityName,
              assistente_nome: clientConfig.assistantName
            }

            let mensagem = ''
            let botoes: Array<{ id: string, label: string }> | undefined = undefined

            if (jaAgendadoTfd) {
              const defaultMsg = `Olá, *${appt.paciente_nome}*! 👋\n\n` +
                `Lembramos que falta pouco para o seu agendamento de *${esp.toUpperCase()}* (${tipoExame}) marcado para daqui a 5 dias (*${fiveDaysAheadFmt}*):\n\n` +
                `👨‍⚕️ Profissional: ${profissional}\n` +
                `⏰ ${periodo}\n\n` +
                `🚗 *Transporte Confirmado:* Identificamos que sua viagem de TFD já está agendada para esta data. Por favor, lembre-se de retirar a sua guia de autorização física na Secretaria Municipal de Saúde de ${clientConfig.municipalityName} caso ainda não o tenha feito. Obrigado!`

              mensagem = clientConfig.template_esp_5d_confirmado
                ? substituirVariaveis(clientConfig.template_esp_5d_confirmado, variables)
                : defaultMsg
            } else {
              const defaultMsg = `Olá, *${appt.paciente_nome}*! 👋\n\n` +
                `Lembramos que falta pouco para o seu agendamento de *${esp.toUpperCase()}* (${tipoExame}) marcado para daqui a 5 dias (*${fiveDaysAheadFmt}*):\n\n` +
                `👨‍⚕️ Profissional: ${profissional}\n` +
                `⏰ ${periodo}\n\n` +
                `⚠️ *Atenção:* Não identificamos agendamento de transporte (TFD) para esta data. Se você precisar do transporte da prefeitura, por favor realize a retirada da sua autorização e agende a viagem o mais rápido possível.\n\n` +
                `Como podemos ajudar? Escolha uma das opções abaixo:`

              mensagem = clientConfig.template_esp_5d
                ? substituirVariaveis(clientConfig.template_esp_5d, variables)
                : defaultMsg

              botoes = [
                { id: 'Quero agendar viagem de TFD', label: 'Quero agendar viagem' },
                { id: 'Vou de transporte próprio', label: 'Vou de carro próprio' },
                { id: 'Como retirar a guia', label: 'Como retirar a guia' }
              ]
            }

            await despacharLembrete({
              modoManual,
              tipo: 'esp_5d',
              referencia_id: String(appt.id),
              data_evento: fiveDaysAheadStr,
              paciente_nome: appt.paciente_nome,
              telefone: phoneFormatted,
              mensagem,
              botoes,
              assistantName: clientConfig.assistantName
            })

            resultados.especialidades.enviados++
          } catch (e: any) {
            resultados.especialidades.erros++
            console.error(`Erro ao enviar lembrete de 5 dias especialidade ${appt.id}:`, e.message)
          }
        }
      }
      */

      // 2. SISREG daqui a 5 dias
      try {
        const startOfDay = `${fiveDaysAheadStr}T00:00:00`
        const endOfDay = `${fiveDaysAheadStr}T23:59:59`

        const { data: sisregAppts5d, error: sisregErr5d } = await supabase
          .from('monitoramento_sisreg')
          .select('*')
          .gte('data_marcacao', startOfDay)
          .lte('data_marcacao', endOfDay)
          .not('status_solicitacao', 'ilike', '%cancelado%')
          .not('status_solicitacao', 'ilike', '%excluido%')
          .not('status_solicitacao', 'ilike', '%executado%')
          .not('status_solicitacao', 'ilike', '%concluido%')
          .not('status_solicitacao', 'ilike', '%atendido%')

        if (sisregErr5d) {
          console.error('Erro ao buscar SISREG de 5 dias:', sisregErr5d.message)
        } else if (sisregAppts5d) {
          resultados.sisreg.total = sisregAppts5d.length

          const cpfsSemTelefone = sisregAppts5d
            .filter(s => !s.telefone || s.telefone.replace(/\D/g, '').length < 8)
            .map(s => s.cpf_usuario)
            .filter(Boolean)

          let phoneMap = new Map<string, string>()
          if (cpfsSemTelefone.length > 0) {
            const variacoesCpfs = cpfsSemTelefone.flatMap(cpf => obterCpfVariacoes(cpf))
            const { data: pacs } = await supabase
              .from('pacientes')
              .select('cpf_cns, telefone')
              .in('cpf_cns', variacoesCpfs)
            
            if (pacs) {
              pacs.forEach(p => {
                if (p.telefone) {
                  phoneMap.set(p.cpf_cns, p.telefone)
                  const clean = p.cpf_cns.replace(/\D/g, '')
                  phoneMap.set(clean, p.telefone)
                  if (clean.length === 11) {
                    const formatted = `${clean.substring(0, 3)}.${clean.substring(3, 6)}.${clean.substring(6, 9)}-${clean.substring(9)}`
                    phoneMap.set(formatted, p.telefone)
                  }
                }
              })
            }
          }

          for (const sol of sisregAppts5d) {
            const key = `sis_5d:${sol.codigo_solicitacao}:${fiveDaysAheadStr}`
            if (alreadySentSet.has(key)) {
              resultados.sisreg.pulados++
              continue
            }

            let rawPhone = sol.telefone
            if (!rawPhone || rawPhone.replace(/\D/g, '').length < 8) {
              rawPhone = phoneMap.get(sol.cpf_usuario) || null
            }

            const phoneFormatted = formatarNumeroWhatsapp(rawPhone, clientConfig.defaultDDD)

            if (!phoneFormatted) {
              resultados.sisreg.erros++
              continue
            }

            try {
              const dataObj = parseTimestampToTz(sol.data_marcacao)
              if (!dataObj) continue
              const hora = dataObj.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: timezone })
              const procedimento = sol.descricao_interna_procedimento || 'Procedimento regulado'
              const local = sol.nome_unidade_executante || sol.nome_unidade_solicitante || 'Local regulado'

              // Obter CPF do paciente para buscar no TFD
              let cpf: string | null = sol.cpf_usuario ? sol.cpf_usuario.replace(/\D/g, '') : null

              let jaAgendadoTfd = false
              if (cpf) {
                const variacoes = obterCpfVariacoes(cpf)
                const { data: travelData } = await supabase
                  .from('viagens')
                  .select('id')
                  .eq('data_viagem', fiveDaysAheadStr)
                  .or(`paciente_cpf.eq.${variacoes[0]},paciente_cpf.eq.${variacoes[1]}`)

                if (travelData && travelData.length > 0) {
                  jaAgendadoTfd = true
                }
              }

              const variables = {
                paciente_nome: sol.no_usuario,
                procedimento: procedimento,
                data_evento: fiveDaysAheadFmt,
                horario: hora,
                local: local,
                municipio: clientConfig.municipalityName,
                assistente_nome: clientConfig.assistantName
              }

              let mensagem = ''
              let botoes: Array<{ id: string, label: string }> | undefined = undefined

              if (jaAgendadoTfd) {
                const defaultMsg = `Olá, *${sol.no_usuario}*! 👋\n\n` +
                  `Lembramos que falta pouco para o seu procedimento pelo *SISREG*! Seu agendamento de *${procedimento.toUpperCase()}* está marcado para o dia *${fiveDaysAheadFmt}* às *${hora}*:\n\n` +
                  `📍 Local: ${local}\n\n` +
                  `🚗 *Transporte Confirmado:* Identificamos que sua viagem de TFD já está agendada para esta data. Por favor, lembre-se de retirar a sua guia de autorização física na Secretaria Municipal de Saúde de ${clientConfig.municipalityName} caso ainda não o tenha feito. Obrigado!`

                mensagem = clientConfig.template_sis_5d_confirmado
                  ? substituirVariaveis(clientConfig.template_sis_5d_confirmado, variables)
                  : defaultMsg
              } else {
                const defaultMsg = `Olá, *${sol.no_usuario}*! 👋\n\n` +
                  `Lembramos que falta pouco para o seu procedimento pelo *SISREG*! Seu agendamento de *${procedimento.toUpperCase()}* está marcado para o dia *${fiveDaysAheadFmt}* às *${hora}*:\n\n` +
                  `📍 Local: ${local}\n\n` +
                  `⚠️ *Atenção:* Não identificamos agendamento de transporte (TFD) para esta data. Se você precisar do transporte da prefeitura, por favor realize a retirada da sua autorização e agende a viagem o mais rápido possível.\n\n` +
                  `Como podemos ajudar? Escolha uma das opções abaixo:`

                mensagem = clientConfig.template_sis_5d
                  ? substituirVariaveis(clientConfig.template_sis_5d, variables)
                  : defaultMsg

                botoes = [
                  { id: 'Quero agendar viagem de TFD', label: 'Quero agendar viagem' },
                  { id: 'Vou de transporte próprio', label: 'Vou de carro próprio' },
                  { id: 'Como retirar a guia', label: 'Como retirar a guia' }
                ]
              }

              await despacharLembrete({
                modoManual,
                tipo: 'sis_5d',
                referencia_id: String(sol.codigo_solicitacao),
                data_evento: fiveDaysAheadStr,
                paciente_nome: sol.no_usuario,
                telefone: phoneFormatted,
                mensagem,
                botoes,
                assistantName: clientConfig.assistantName
              })

              resultados.sisreg.enviados++
            } catch (e: any) {
              resultados.sisreg.erros++
              console.error(`Erro ao enviar lembrete de 5 dias SISREG ${sol.codigo_solicitacao}:`, e.message)
            }
          }
        }
      } catch (e: any) {
        console.warn('[Lembretes] Tabela monitoramento_sisreg indisponível para varredura de 5 dias:', e.message)
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
