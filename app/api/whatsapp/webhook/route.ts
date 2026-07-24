import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI, FunctionDeclaration, SchemaType } from '@google/generative-ai'
import { createClient } from '@supabase/supabase-js'
import { buscarSolicitacoesSisreg, SisregSolicitacaoComFila } from '../../../../lib/sisreg'
import { clientConfig, getDbConfigsMulti, getActiveClientConfig } from '../../../../lib/config'
import { accentInsensitivePattern } from '../../../../lib/supabase'

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

// ── Verifica horário de funcionamento (configuração dinâmica) ────────────────
function dentroDoHorario(config: any): boolean {
  if (process.env.DISABLE_WORKING_HOURS === 'true') return true
  
  const timezone = process.env.NEXT_PUBLIC_TIMEZONE || 'America/Araguaina'
  const agoraStr = new Date().toLocaleString('en-US', { timeZone: timezone })
  const agora = new Date(agoraStr)
  
  const diaSemana = agora.getDay() // 0=dom, 6=sáb
  if (!config || !config.dias || !config.dias.includes(diaSemana)) return false

  const h = agora.getHours()
  const m = agora.getMinutes()
  const minutosAgora = h * 60 + m

  for (const p of config.periodos || []) {
    const [hIni, mIni] = p.inicio.split(':').map(Number)
    const [hFim, mFim] = p.fim.split(':').map(Number)
    const minutosIni = hIni * 60 + mIni
    const minutosFim = hFim * 60 + mFim

    if (minutosAgora >= minutosIni && minutosAgora < minutosFim) {
      return true
    }
  }

  return false
}

// ── Funções de Mascaramento de Dados (LGPD) ──────────────────────────────────
function mascararNome(nome: string): string {
  if (!nome) return ''
  const partes = nome.trim().split(/\s+/)
  
  const formatarParte = (p: string) => {
    if (!p) return ''
    if (p.length <= 2 && p.endsWith('.')) return p.toUpperCase()
    return p.charAt(0).toUpperCase() + p.slice(1).toLowerCase()
  }

  if (partes.length === 1) return formatarParte(partes[0])
  
  return partes.map((p, idx) => {
    if (idx === 0 || idx === partes.length - 1) return formatarParte(p)
    const pLimpa = p.replace(/\./g, '')
    if (pLimpa.length === 0) return ''
    return pLimpa[0].toUpperCase() + '.'
  }).filter(Boolean).join(' ')
}

function mascararCPF(cpf: string | null): string {
  if (!cpf) return 'Não informado'
  const clean = cpf.replace(/\D/g, '')
  if (clean.length !== 11) return cpf
  return `${clean.substring(0, 3)}.***.***-${clean.substring(9)}`
}

function mascararCNS(cns: string | null): string {
  if (!cns) return 'Não informado'
  const clean = cns.replace(/\D/g, '')
  if (clean.length !== 15) return cns
  return `${clean.substring(0, 3)} **** **** ${clean.substring(11)}`
}

function mascararEndereco(end: string | null): string {
  if (!end) return 'Não informado'
  const partes = end.split(',')
  return partes[0] + ', ***'
}

function mascararTelefone(tel: string | null): string {
  if (!tel) return 'Não informado'
  const clean = tel.replace(/\D/g, '')
  if (clean.length < 8) return tel
  return `(***) ****-${clean.substring(clean.length - 4)}`
}

// ── Validação de Acesso a Dados do Paciente (LGPD) ───────────────────────────
async function validarAcessoPaciente(telefone: string, busca: string, dataNascimentoInput?: string): Promise<{ autorizado: boolean, erro?: string, pacienteId?: string, pacienteNome?: string, pacienteCpfCns?: string }> {
  const soDigitos = busca.replace(/\D/g, '')
  let query = supabase.from('pacientes').select('id, nome, cpf_cns, dt_nasc, telefone')
  
  if (soDigitos.length >= 6) {
    query = query.ilike('cpf_cns', `%${soDigitos}%`)
  } else {
    query = query.filter('nome', 'imatch', accentInsensitivePattern(busca))
  }
  
  const { data: pacienteData, error } = await query
  if (error || !pacienteData || pacienteData.length === 0) {
    return { autorizado: false, erro: 'Paciente não cadastrado na base da secretaria.' }
  }

  if (pacienteData.length > 1 && soDigitos.length < 6) {
    return { autorizado: false, erro: 'Foram encontrados múltiplos pacientes com este nome. Por favor, realize a busca informando o CPF ou CNS completo.' }
  }

  const paciente = pacienteData[0]
  const pacienteTelefoneClean = (paciente.telefone || '').replace(/\D/g, '')
  const telefoneRemetenteClean = telefone.replace(/\D/g, '')

  // Regra 1: Se o telefone cadastrado bater com o telefone do remetente, autoriza automaticamente
  if (pacienteTelefoneClean && (pacienteTelefoneClean.includes(telefoneRemetenteClean) || telefoneRemetenteClean.includes(pacienteTelefoneClean))) {
    return { autorizado: true, pacienteId: paciente.id, pacienteNome: paciente.nome, pacienteCpfCns: paciente.cpf_cns }
  }

  // Regra 2: Se foi fornecida a data de nascimento e ela bater com o cadastro, autoriza
  if (dataNascimentoInput) {
    const dataNascFmt = dataNascimentoInput.replace(/\D/g, '')
    const dbNascFmt = paciente.dt_nasc ? paciente.dt_nasc.split('-').reverse().join('') : ''
    const dbNascFmtUs = paciente.dt_nasc ? paciente.dt_nasc.replace(/\D/g, '') : ''
    
    if (dataNascFmt === dbNascFmt || dataNascFmt === dbNascFmtUs) {
      return { autorizado: true, pacienteId: paciente.id, pacienteNome: paciente.nome, pacienteCpfCns: paciente.cpf_cns }
    }
    return { autorizado: false, erro: 'ERRO_AUTORIZACAO: A data de nascimento fornecida não confere com o cadastro do paciente.' }
  }

  // Regra 3: Caso contrário, exige a validação da data de nascimento
  const nomeMascarado = mascararNome(paciente.nome)
  return { 
    autorizado: false, 
    erro: `REQUER_VALIDACAO_NASCIMENTO: Por favor, confirme a data de nascimento de ${nomeMascarado} (DD/MM/AAAA):` 
  }
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
    description: 'Busca agendamentos de consultas e exames de especialidades do paciente pelo nome ou CPF/CNS. Retorna especialidade, tipo de exame, data, status e profissional. IMPORTANTE: Para LGPD, se a busca for por CPF/CNS diferente do próprio usuário ou se o telefone não estiver vinculado, você DEVE solicitar e fornecer a data_nascimento (no formato DD/MM/AAAA) para autorizar a consulta.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        busca: { type: SchemaType.STRING, description: 'Nome do paciente ou CPF/CNS (com ou sem máscara)' },
        data_nascimento: { type: SchemaType.STRING, description: 'Data de nascimento do paciente (DD/MM/AAAA). Obrigatório se consultando dados de terceiros ou se o telefone não estiver cadastrado.' }
      },
      required: ['busca']
    }
  },
  {
    name: 'buscar_paciente',
    description: 'Busca dados cadastrais do paciente (nome, CPF/CNS, data de nascimento, telefone, endereço) na base da secretaria. Retorna dados mascarados por segurança. IMPORTANTE: Para LGPD, se a busca for por CPF/CNS diferente do próprio usuário ou se o telefone não estiver vinculado, você DEVE solicitar e fornecer a data_nascimento (no formato DD/MM/AAAA) para autorizar a consulta.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        busca: { type: SchemaType.STRING, description: 'Nome do paciente ou CPF/CNS' },
        data_nascimento: { type: SchemaType.STRING, description: 'Data de nascimento do paciente (DD/MM/AAAA). Obrigatório se consultando dados de terceiros ou se o telefone não estiver cadastrado.' }
      },
      required: ['busca']
    }
  },
  {
    name: 'buscar_tfd',
    description: 'Busca viagens de TFD (Tratamento Fora do Domicílio) do paciente. Retorna destino, data e horário da viagem. IMPORTANTE: Para LGPD, se a busca for por CPF/CNS diferente do próprio usuário ou se o telefone não estiver vinculado, você DEVE solicitar e fornecer a data_nascimento (no formato DD/MM/AAAA) para autorizar a consulta.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        busca: { type: SchemaType.STRING, description: 'Nome do paciente ou CPF' },
        data: { type: SchemaType.STRING, description: 'Data no formato YYYY-MM-DD (opcional, para filtrar por data)' },
        data_nascimento: { type: SchemaType.STRING, description: 'Data de nascimento do paciente (DD/MM/AAAA). Obrigatório se consultando dados de terceiros ou se o telefone não estiver cadastrado.' }
      },
      required: ['busca']
    }
  },
  {
    name: 'informacoes_secretaria',
    description: `Retorna informações gerais sobre a Secretaria Municipal de Saúde de ${clientConfig.municipalityName}.`,
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
    description: 'Consulta o sistema estadual SISREG para verificar o status de solicitações de consultas e exames de média e alta complexidade. IMPORTANTE: Para LGPD, se a busca for por CPF/CNS diferente do próprio usuário ou se o telefone não estiver vinculado, você DEVE solicitar e fornecer a data_nascimento (no formato DD/MM/AAAA) para autorizar a consulta.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        busca: { type: SchemaType.STRING, description: 'CPF ou Nome do paciente' },
        tipo: { type: SchemaType.STRING, description: 'Filtro por tipo: consulta | exame | ambos (opcional)' },
        data_nascimento: { type: SchemaType.STRING, description: 'Data de nascimento do paciente (DD/MM/AAAA). Obrigatório se consultando dados de terceiros ou se o telefone não estiver cadastrado.' }
      },
      required: ['busca']
    }
  }
]

// ── Execução das ferramentas ─────────────────────────────────────────────────
async function executarFerramenta(nome: string, input: any, telefone: string, ctx: any): Promise<string> {
  try {
    if (nome === 'escalar_para_humano') {
      await setEstado(telefone, 'aguardando_humano')
      await supabase.from('whatsapp_conversas').insert([{
        telefone,
        papel: 'sistema',
        mensagem: `🔴 ESCALONADO: ${input.motivo}`
      }])
      
      const assistant = ctx?.clientConfig?.assistantName || 'Francisco'
      const avisoAtendente = `🚨 *[SUPORTE HUMANO SOLICITADO]* 🚨\n\n👤 *Paciente:* +${telefone}\n⚠️ *Motivo:* ${input.motivo}\n\n👉 *Atendentes:* Por favor, assumam a conversa diretamente por aqui. Ao finalizar, digitem *#fim* ou *#bot* para reativar o ${assistant}.`
      await enviarMensagem(telefone, avisoAtendente)
      return 'ESCALONADO'
    }

    if (nome === 'buscar_agendamentos') {
      const authCheck = await validarAcessoPaciente(telefone, input.busca, input.data_nascimento)
      if (!authCheck.autorizado) {
        return authCheck.erro || 'Não autorizado.'
      }

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

      const formatter = new Intl.DateTimeFormat('fr-CA', { timeZone: 'America/Araguaina', year: 'numeric', month: '2-digit', day: '2-digit' })
      const hojeStr = formatter.format(new Date())

      const agendamentosAtuais = data.filter(a => !a.data_consulta || a.data_consulta >= hojeStr)
      const agendamentosPassados = data.filter(a => a.data_consulta && a.data_consulta < hojeStr)

      let output = ''
      
      if (agendamentosAtuais.length > 0) {
        output += `📅 *AGENDAMENTOS ATUAIS E FUTUROS:*\n\n` + agendamentosAtuais.map(a => {
          const data_fmt = a.data_consulta ? a.data_consulta.split('-').reverse().join('/') : 'não informada'
          const status_pt: Record<string, string> = { pendente: 'Pendente ⏳', autorizado: 'Autorizado ✅', negado: 'Negado ❌' }
          return `• *${a.especialidade?.toUpperCase()}* (${a.tipo_exame || 'consulta'})\n  *Data:* ${data_fmt}\n  *Profissional:* ${a.profissional_nome || 'a definir'}\n  *Status:* ${status_pt[a.status] || a.status}`
        }).join('\n\n')
      }

      if (agendamentosPassados.length > 0) {
        if (output) output += '\n\n═══════════════════════\n\n'
        output += `⏳ *HISTÓRICO DE AGENDAMENTOS (PASSADOS):*\n\n` + agendamentosPassados.map(a => {
          const data_fmt = a.data_consulta ? a.data_consulta.split('-').reverse().join('/') : 'não informada'
          const status_pt: Record<string, string> = { pendente: 'Pendente', autorizado: 'Realizado ✅', negado: 'Não realizado ❌' }
          return `• *${a.especialidade?.toUpperCase()}* (${a.tipo_exame || 'consulta'})\n  *Data:* ${data_fmt}\n  *Profissional:* ${a.profissional_nome || 'a definir'}\n  *Status:* ${status_pt[a.status] || a.status}`
        }).join('\n\n')
      }

      return output
    }

    if (nome === 'buscar_paciente') {
      const authCheck = await validarAcessoPaciente(telefone, input.busca, input.data_nascimento)
      if (!authCheck.autorizado) {
        return authCheck.erro || 'Não autorizado.'
      }

      const soDigitos = input.busca.replace(/\D/g, '')
      let query = supabase
        .from('pacientes')
        .select('nome, cpf_cns, dt_nasc, telefone, endereco, bairro, cep')
        .limit(5)

      if (soDigitos.length >= 6) {
        query = query.ilike('cpf_cns', `%${soDigitos}%`)
      } else {
        query = query.filter('nome', 'imatch', accentInsensitivePattern(input.busca))
      }

      const { data, error } = await query
      if (error) return `Erro ao buscar: ${error.message}`
      if (!data || data.length === 0) return 'Paciente não encontrado na base da secretaria.'

      return data.map(p => {
        const nasc = p.dt_nasc ? p.dt_nasc.split('-').reverse().join('/') : 'não informada'
        const nomeMasc = mascararNome(p.nome)
        const cpfMasc = mascararCPF(p.cpf_cns)
        const telMasc = mascararTelefone(p.telefone)
        const endMasc = mascararEndereco(p.endereco)
        return `• ${nomeMasc}\n  CPF/CNS: ${cpfMasc}\n  Nascimento: ${nasc}\n  Telefone: ${telMasc}\n  Endereço: ${endMasc}, ${p.bairro || '—'}`
      }).join('\n\n')
    }

    if (nome === 'buscar_tfd') {
      const authCheck = await validarAcessoPaciente(telefone, input.busca, input.data_nascimento)
      if (!authCheck.autorizado) {
        return authCheck.erro || 'Não autorizado.'
      }

      const soDigitos = input.busca.replace(/\D/g, '')
      let query = supabase
        .from('viagens')
        .select('paciente_nome, paciente_cpf, destino, data_viagem, hora')
        .order('data_viagem', { ascending: false })
        .limit(50)

      if (soDigitos.length >= 6) {
        query = query.ilike('paciente_cpf', `%${soDigitos}%`)
      } else {
        query = query.ilike('paciente_nome', `%${input.busca.toUpperCase()}%`)
      }

      if (input.data) query = query.eq('data_viagem', input.data)

      const { data, error } = await query
      if (error) return `Erro ao buscar: ${error.message}`
      if (!data || data.length === 0) return 'Nenhuma viagem TFD encontrada para este paciente.'

      const formatter = new Intl.DateTimeFormat('fr-CA', { timeZone: 'America/Araguaina', year: 'numeric', month: '2-digit', day: '2-digit' })
      const hojeStr = formatter.format(new Date())

      const viagensAtuais = data.filter(v => !v.data_viagem || v.data_viagem >= hojeStr)
      const viagensPassadas = data.filter(v => v.data_viagem && v.data_viagem < hojeStr).slice(0, 3)

      let output = ''

      if (viagensAtuais.length > 0) {
        output += `🚗 *PRÓXIMAS VIAGENS (TFD):*\n\n` + viagensAtuais.map(v => {
          const data_fmt = v.data_viagem ? v.data_viagem.split('-').reverse().join('/') : '—'
          return `• *${data_fmt}* às *${v.hora || '—'}*\n  *Destino:* ${v.destino || '—'}\n  *Paciente:* ${mascararNome(v.paciente_nome)}`
        }).join('\n\n')
        output += `\n\n💬 *Nota:* No dia anterior à viagem, nossa equipe ou uma mensagem do sistema entrará em contato com você para confirmar o horário exato da partida.`
      }

      if (viagensPassadas.length > 0) {
        if (output) output += '\n\n═══════════════════════\n\n'
        output += `⏳ *HISTÓRICO DE VIAGENS (PASSADAS):*\n\n` + viagensPassadas.map(v => {
          const data_fmt = v.data_viagem ? v.data_viagem.split('-').reverse().join('/') : '—'
          return `• *${data_fmt}* às *${v.hora || '—'}*\n  *Destino:* ${v.destino || '—'}\n  *Paciente:* ${mascararNome(v.paciente_nome)}`
        }).join('\n\n')
      }

      return output
    }

    if (nome === 'informacoes_secretaria') {
      const { clientConfig: cfg, contatosSuporte: support, listaUbs: ubs, servicosMunicipio: servs } = ctx || {}
      
      const ubsInfoText = (ubs || []).map((u: any) => `🏨 *${u.nome}* (${u.descricao}) — 📞 ${u.telefone}\nServiços: ${u.servicos.join(', ')}`).join('\n\n')
      const tfdText = servs?.tfd
        ? `O TFD (Tratamento Fora do Domicílio) oferece transporte para pacientes que necessitam de atendimento em outros municípios parceiros.`
        : `Serviço de TFD não habilitado para este município.`

      const infos: Record<string, string> = {
        horario: 'A Secretaria Municipal de Saúde funciona nos horários registrados de atendimento ao público.',
        endereco: `A SMS fica localizada na sede do município de ${cfg?.municipalityName || 'Conceição do Tocantins'} - ${cfg?.municipalityUF || 'TO'}.`,
        servicos: `Oferecemos: agendamento de consultas e exames especializados, ${servs?.tfd ? 'TFD (Tratamento Fora do Domicílio), ' : ''}BPA, cadastro de pacientes, almoxarifado de medicamentos e insumos.`,
        tfd: tfdText,
        agendamento: 'Para agendar consultas em especialidades, procure a SMS com encaminhamento médico do PSF.',
        contato: `📞 *Contatos da Saúde — ${cfg?.municipalityName || 'Conceição do Tocantins'}*\n\n🏥 *Secretaria Municipal de Saúde (urgências):*\n${support?.urgencia || '(63) 99130-6916'}\n\n${ubsInfoText}\n\n🔬 *Laboratório:*\n${support?.laboratorio || '(63) 99132-7974'}\n\n🛡️ *Vigilância Sanitária:*\n${support?.vigilancia || '(63) 99131-4490'}`,
      }

      const assunto = input.assunto.toLowerCase()
      for (const [chave, texto] of Object.entries(infos)) {
        if (assunto.includes(chave)) return texto
      }
      return `Serviços da SMS ${cfg?.municipalityName || 'Conceição do Tocantins'}:\n• Agendamento de especialidades\n${servs?.tfd ? '• TFD — transporte para municípios de referência\n' : ''}• Cadastro de pacientes\n• Almoxarifado de medicamentos`
    }

    if (nome === 'buscar_sisreg') {
      try {
        const authCheck = await validarAcessoPaciente(telefone, input.busca, input.data_nascimento)
        if (!authCheck.autorizado) {
          return authCheck.erro || 'Não autorizado.'
        }

        const solicitacoes = await buscarSolicitacoesSisreg(input.busca, input.tipo || 'ambos')
        if (solicitacoes.length === 0) return `Nenhuma solicitação encontrada para este paciente.`

        if (solicitacoes.length === 1 && solicitacoes[0].codigo_procedimento === 'NENHUM_ATIVO') {
          return `Paciente identificado no SISREG, mas não possui nenhuma solicitação activa ou pendente de *${input.tipo || 'consultas/exames'}* no momento.`
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
        const formatadasAtivas = ativas.map((s: SisregSolicitacaoComFila) => {
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

        // Constrói o texto das com problemas (devolvidos/negados)
        const formatadasProblemas = problemas.map((s: SisregSolicitacaoComFila) => {
          const procedimento = s.procedimento
          const dataSolicitacao = s.data_solicitacao ? s.data_solicitacao.split('T')[0].split('-').reverse().join('/') : '—'
          return `• *${procedimento.toUpperCase()}*\n  Situação: ❌ *${s.status}*\n  Data de inserção: ${dataSolicitacao}`
        })

        const outputParts: string[] = []

        if (formatadasAtivas.length > 0) {
          outputParts.push(formatadasAtivas.join('\n\n'))
        }

        if (formatadasProblemas.length > 0) {
          const avisoProblema = `⚠️ *Pendente de Correção / Recusado:*\n\n${formatadasProblemas.join('\n\n')}\n\n*Por favor, entre em contato imediatamente com a Secretaria de Saúde para regularizar seu pedido:* \n📞 Telefone/WhatsApp: *${ctx?.contatosSuporte?.urgencia || '(63) 99130-6916'}*\n\nOu digite *#humano* para que eu te transfira para um atendente agora mesmo.`
          outputParts.push(avisoProblema)
        }

        return outputParts.join('\n\n═══════════════════════\n\n')
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
    console.warn(`[Evolution API MOCK] Enviar mensagem para ${numero}: ${texto}`)
    return
  }

  try {
    const res = await fetch(`${EVOLUTION_URL}/message/sendText/${EVOLUTION_INSTANCE}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': EVOLUTION_KEY },
      body: JSON.stringify({ number: numero, text: texto })
    })
    if (!res.ok) {
      console.error(`[Evolution API Error ${res.status}] ao enviar para ${numero}: ${res.statusText}`)
    }
  } catch (err: any) {
    console.error(`[Evolution API Network Error] ao enviar mensagem para ${numero}:`, err.message)
  }
}

// ── Envia botões via Evolution API com fallback ─────────────────────────────
async function enviarBotoes(numero: string, title: string, description: string, buttons: Array<{ id: string, label: string }>) {
  const fallbackText = `*${title}*\n\n${description}\n\n` + buttons.map(b => `${b.id}️⃣ *${b.label}*`).join('\n')
  await salvarMensagem(numero, 'assistant', fallbackText)

  if (numero === TELEFONE_TESTE) return

  if (!EVOLUTION_URL || !EVOLUTION_KEY || !EVOLUTION_INSTANCE) {
    console.warn(`[Evolution API MOCK sendButtons] para ${numero}: ${fallbackText}`)
    return
  }

  try {
    const formattedButtons = buttons.map(b => ({
      type: 'reply',
      displayText: b.label,
      id: b.id
    }))

    const res = await fetch(`${EVOLUTION_URL}/message/sendButtons/${EVOLUTION_INSTANCE}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': EVOLUTION_KEY },
      body: JSON.stringify({
        number: numero,
        title,
        description,
        footer: clientConfig.assistantName,
        buttons: formattedButtons
      })
    })

    if (!res.ok) {
      throw new Error(`Erro API: ${res.statusText}`)
    }
  } catch (err: any) {
    console.warn('[Evolution API sendButtons] Falhou, enviando fallback em texto:', err.message)
    await enviarMensagem(numero, fallbackText)
  }
}

// ── Envia menu de lista via Evolution API com fallback ───────────────────────
async function enviarLista(
  numero: string,
  title: string,
  description: string,
  buttonText: string,
  sections: Array<{ title: string, rows: Array<{ id: string, title: string, description?: string }> }>
) {
  let fallbackText = `*${title}*\n\n${description}\n\n`
  sections.forEach(s => {
    fallbackText += `*${s.title}*\n`
    s.rows.forEach(r => {
      fallbackText += `${r.id}️⃣ *${r.title}*${r.description ? ` - ${r.description}` : ''}\n`
    })
    fallbackText += '\n'
  })
  fallbackText = fallbackText.trim()
  await salvarMensagem(numero, 'assistant', fallbackText)

  if (numero === TELEFONE_TESTE) return

  if (!EVOLUTION_URL || !EVOLUTION_KEY || !EVOLUTION_INSTANCE) {
    console.warn(`[Evolution API MOCK sendList] para ${numero}: ${fallbackText}`)
    return
  }

  try {
    const formattedSections = sections.map(s => ({
      title: s.title,
      rows: s.rows.map(r => ({
        title: r.title,
        description: r.description || '',
        rowId: r.id
      }))
    }))

    const res = await fetch(`${EVOLUTION_URL}/message/sendList/${EVOLUTION_INSTANCE}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': EVOLUTION_KEY },
      body: JSON.stringify({
        number: numero,
        title,
        description,
        buttonText,
        footerText: clientConfig.assistantName,
        sections: formattedSections
      })
    })

    if (!res.ok) {
      throw new Error(`Erro API: ${res.statusText}`)
    }
  } catch (err: any) {
    console.warn('[Evolution API sendList] Falhou, enviando fallback em texto:', err.message)
    await enviarMensagem(numero, fallbackText)
  }
}

// ── Envia o Menu Principal interativo do WhatsApp ────────────────────────────
async function enviarMenu(numero: string, servicos: any) {
  const title = `📋 Menu Principal`
  const description = `Olá! Como posso ajudar você hoje? Escolha uma das opções abaixo:`
  
  const rows = [
    { id: '1', title: '🏥 Marcar Consulta ou Exame', description: 'Agendamentos na rede municipal' },
    { id: '2', title: '🔍 Meus agendamentos', description: 'Consultas e exames marcados' },
    { id: '3', title: '🩺 Consultar SISREG', description: 'Status no sistema do Estado' }
  ]

  if (servicos?.tfd) {
    rows.push({ id: '4', title: '🚗 TFD — Minhas viagens', description: 'Agendamentos de viagens' })
  }
  if (servicos?.farmacia) {
    rows.push({ id: '5', title: '💊 Remédios e Farmácia', description: 'Orientação de medicamentos' })
  }
  if (servicos?.laboratorio) {
    rows.push({ id: '6', title: '🩸 Resultados de Exames', description: 'Resultados de laboratório' })
  }
  
  rows.push({ id: '7', title: '📞 Telefones e Endereços', description: 'Telefones e contatos úteis' })
  rows.push({ id: '8', title: '🗣️ Falar com Atendente', description: 'Falar com atendente humano' })

  await enviarLista(numero, title, description, 'Ver Opções', [
    {
      title: 'Serviços Disponíveis',
      rows
    }
  ])
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

    // Carrega a configuração ativa do cliente (DB + fallback do env)
    const clientConfig = await getActiveClientConfig()

    // Carrega configurações gerais do banco de dados (SaaS White-Label)
    const configs = await getDbConfigsMulti([
      'client_config',
      'contatos_suporte',
      'horario_atendimento',
      'lista_ubs',
      'lista_acs',
      'servicos_municipio'
    ])

    const rawContatos = configs['contatos_suporte'] || {}
    
    // Função auxiliar para pesquisar chave de contato de forma flexível e case-insensitive (removendo acentos)
    const obterContatoFlexivel = (alvos: string[], padrao: string) => {
      for (const k of Object.keys(rawContatos)) {
        const kLimpa = k.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        if (alvos.some(target => kLimpa.includes(target) || target.includes(kLimpa))) {
          return rawContatos[k]
        }
      }
      return padrao
    }

    const contatosSuporte = {
      ...rawContatos,
      urgencia: obterContatoFlexivel(['urgencia', 'emergencia', 'rural'], "(63) 99130-6916"),
      ubs_urbana: obterContatoFlexivel(['urbana', 'posto', 'ubs urbana'], "(63) 99130-2450"),
      laboratorio: obterContatoFlexivel(['laboratorio', 'exame', 'analise'], "(63) 99132-7974"),
      vigilancia: obterContatoFlexivel(['vigilancia', 'sanitaria', 'visa'], "(63) 99131-4490")
    }

    const horarioConfig = configs['horario_atendimento'] || {
      dias: [1, 2, 3, 4, 5],
      periodos: [
        { inicio: "07:00", fim: "11:00" },
        { inicio: "13:00", fim: "17:00" }
      ],
      mensagem_fechado: `Olá! 👋 Sou o {nome_assistente}, assistente virtual da SMS {nome_municipio}.\n\n⏰ No momento a secretaria está *fechada*.\n\n🕐 Horário de atendimento:\nSegunda a sexta: 7h–11h e 13h–17h\n\n🚨 Em caso de urgência ou emergência, entre em contato *imediatamente*:\n📞 {telefone_urgencia}`
    }

    const listaUbs = configs['lista_ubs'] || []
    const listaAcs = configs['lista_acs'] || { rural: [], urbana: [] }
    const servicosMunicipio = configs['servicos_municipio'] || { tfd: true, farmacia: true, laboratorio: true, vigilancia: true }

    const ctx = { clientConfig, contatosSuporte, listaUbs, listaAcs, servicosMunicipio }
 
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
    
    // Extrai botão / clique em lista dos vários formatos possíveis da Evolution API/WhatsApp
    const buttonId = msgObj?.buttonsResponseMessage?.selectedButtonId
    const templateButtonId = msgObj?.templateButtonReplyMessage?.selectedId
    const listRowId = msgObj?.listResponseMessage?.singleSelectReply?.selectedRowId
    const interactiveButtonId = msgObj?.interactiveResponseMessage?.nativeFlowResponseMessage?.selectedButtonId
    const interactiveRowId = msgObj?.interactiveResponseMessage?.singleSelectReply?.selectedRowId
    
    let interactiveParamsId = ''
    if (msgObj?.interactiveResponseMessage?.nativeFlowResponseMessage?.paramsJson) {
      try {
        const parsed = JSON.parse(msgObj.interactiveResponseMessage.nativeFlowResponseMessage.paramsJson)
        interactiveParamsId = parsed.id || ''
      } catch (e) {
        // ignore
      }
    }

    const isAudio = Boolean(msgObj?.audioMessage)
    const isMediaOnly = Boolean(
      msgObj?.audioMessage ||
      (msgObj?.imageMessage && !msgObj?.imageMessage?.caption) ||
      msgObj?.stickerMessage ||
      msgObj?.documentMessage ||
      msgObj?.videoMessage
    )

    const texto: string =
      buttonId ||
      templateButtonId ||
      listRowId ||
      interactiveButtonId ||
      interactiveRowId ||
      interactiveParamsId ||
      msgObj?.conversation ||
      msgObj?.extendedTextMessage?.text ||
      msgObj?.listResponseMessage?.title ||
      msgObj?.buttonsResponseMessage?.selectedDisplayText ||
      msgObj?.imageMessage?.caption || ''

    // Se for mensagem de áudio ou mídia avulsa fora dos fluxos de foto do pedido
    if (isAudio || (isMediaOnly && !texto.trim())) {
      const { estado: estadoAtualCheck } = await getEstadoInfo(telefone)
      if (!['opcao_marcar_particular_foto', 'opcao_marcar_particular_consulta_foto', 'aguardando_humano'].includes(estadoAtualCheck)) {
        const respMidia = isAudio
          ? `🎙️ *Mensagem de Áudio recebida*\n\nOlá! No momento ainda não consigo ouvir áudios. Por favor, envie sua dúvida em mensagem de texto ou digite *0* para ver as opções do menu principal.`
          : `📸 *Arquivo de Mídia recebido*\n\nOlá! No momento não consigo interpretar imagens ou documentos avulsos. Por favor, descreva sua dúvida por texto ou digite *0* para ver o menu principal.`

        await salvarMensagem(telefone, 'user', isAudio ? '[Áudio enviado]' : '[Mídia/Imagem enviada]')
        await salvarMensagem(telefone, 'assistant', respMidia)
        await enviarMensagem(telefone, respMidia)
        return NextResponse.json({ ok: true })
      }
    }

    if (!texto.trim()) return NextResponse.json({ ok: true })

    // Intercepta confirmações de viagem TFD (sem IA)
    if (texto.startsWith('TFD_CONFIRMAR_') || texto.startsWith('TFD_DESISTIR_')) {
      const isConfirm = texto.startsWith('TFD_CONFIRMAR_')
      const travelId = texto.split('_').slice(2).join('_')
      
      try {
        const { data: updated, error: dbErr } = await supabase
          .from('viagens')
          .update({ confirmacao: isConfirm ? 'CONFIRMADO' : 'DESISTIU' })
          .eq('id', travelId)
          .select('paciente_nome, data_viagem, destino')
          .maybeSingle()

        if (dbErr) {
          console.error('[Webhook TFD] Erro ao atualizar confirmacao:', dbErr.message)
        }

        const dataFmt = updated?.data_viagem 
          ? (() => { const [a,m,d] = updated.data_viagem.split('-'); return `${d}/${m}/${a}` })()
          : ''

        const respTexto = isConfirm
          ? `Obrigado! Confirmamos que você vai viajar no transporte agendado para o dia ${dataFmt}. Tenha uma boa viagem! 🚗`
          : `Entendido. Registramos que você não vai viajar e liberamos a sua vaga no transporte. Obrigado por nos avisar! 👍`

        // Grava no histórico a ação do usuário (como texto legível)
        await salvarMensagem(telefone, 'user', isConfirm ? '[Botão] Sim, vou viajar' : '[Botão] Não vou viajar')
        await salvarMensagem(telefone, 'assistant', respTexto)
        
        // Envia mensagem pelo whatsapp
        await enviarMensagem(telefone, respTexto)
        return NextResponse.json({ ok: true })
      } catch (err: any) {
        console.error('[Webhook TFD] Erro inesperado:', err.message)
      }
    }

    const historico = await carregarHistorico(telefone)
    await salvarMensagem(telefone, 'user', texto)

    // Busca automática do cadastro pelo telefone do remetente (LGPD)
    const { data: pacienteAtual } = await supabase
      .from('pacientes')
      .select('nome, cpf_cns, dt_nasc')
      .eq('telefone', telefone)
      .maybeSingle()

    let identificacaoUsuarioPrompt = ''
    if (pacienteAtual) {
      const dataNascFmt = pacienteAtual.dt_nasc ? pacienteAtual.dt_nasc.split('-').reverse().join('/') : 'Não cadastrada'
      identificacaoUsuarioPrompt = `\n\n═══════════════════════════════════════\nUSUÁRIO AUTENTICADO DO WHATSAPP\n═══════════════════════════════════════\nO número de telefone de origem (+${telefone}) está cadastrado no sistema municipal para o seguinte paciente:\n- Nome: ${pacienteAtual.nome}\n- CPF/CNS: ${pacienteAtual.cpf_cns}\n- Data de Nascimento: ${dataNascFmt}\n\nVocê deve usar este CPF/CNS para consultas dele. Se ele pedir seus próprios agendamentos, viagens ou SISREG, use estes dados cadastrais automaticamente sem precisar perguntar.`
    } else {
      identificacaoUsuarioPrompt = `\n\n═══════════════════════════════════════\nUSUÁRIO NÃO AUTENTICADO DO WHATSAPP\n═══════════════════════════════════════\nO número de telefone de origem (+${telefone}) não está vinculado a nenhuma ficha cadastral de paciente no sistema municipal.\nSe ele pedir consultas de seus próprios dados, você DEVE solicitar o CPF ou CNS dele. Se ele tentar consultar dados de terceiros ou se o telefone não estiver vinculado, você DEVE solicitar e fornecer a data de nascimento do paciente na ferramenta para validação.`
    }

    // Fora do horário de funcionamento
    if (telefone !== TELEFONE_TESTE && !dentroDoHorario(horarioConfig)) {
      const msgFechadoTemplate = horarioConfig.mensagem_fechado || "Olá! 👋 Sou o {nome_assistente}, assistente virtual da SMS {nome_municipio}.\n\n⏰ No momento a secretaria está *fechada*.\n\n🕐 Horário de atendimento:\nSegunda a sexta: 7h–11h e 13h–17h\n\n🚨 Em caso de urgência ou emergência, entre em contato *imediatamente*:\n📞 {telefone_urgencia}"
      const respFechado = msgFechadoTemplate
        .replace(/{nome_assistente}/g, clientConfig.assistantName)
        .replace(/{nome_municipio}/g, clientConfig.municipalityName)
        .replace(/{telefone_urgencia}/g, contatosSuporte.urgencia)
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
      const respFinalizar = `✨ A Secretaria Municipal de Saúde agradece o seu contato! O seu atendimento foi finalizado e o assistente virtual ${clientConfig.assistantName} foi reativado. 🏥\n\n_Se precisar de mim novamente, basta enviar uma nova mensagem._`
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
          await salvarMensagem(telefone, 'sistema', '⏱️ Atendimento humano finalizado automaticamente por inatividade (2h). Assistente virtual reativado.')
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
      const primeiroNomeRaw = pacienteAtual?.nome ? pacienteAtual.nome.trim().split(/\s+/)[0] : ''
      const primeiroNome = primeiroNomeRaw ? primeiroNomeRaw.charAt(0).toUpperCase() + primeiroNomeRaw.slice(1).toLowerCase() : ''
      const saudacaoNome = primeiroNome ? `Olá, ${primeiroNome}! Tudo bem? 👋` : 'Olá! Tudo bem? 👋'
      const apresentacaoText = `${saudacaoNome} Sou o *${clientConfig.assistantName}*, assistente virtual da *Secretaria Municipal de Saúde de ${clientConfig.municipalityName}*.\n\nEstou aqui para facilitar seu acesso a informações sobre agendamentos, viagens de TFD, status do SISREG e serviços das nossas UBSs.\n\n🚨 *Atenção:* Este canal é exclusivo para informações. Em caso de urgência ou emergência, ligue imediatamente para: 📞 *${contatosSuporte.urgencia}*`
      
      await setEstado(telefone, 'menu')
      await salvarMensagem(telefone, 'assistant', apresentacaoText)
      await enviarMensagem(telefone, apresentacaoText)
      await enviarMenu(telefone, servicosMunicipio)
      return NextResponse.json({ ok: true })
    }

    // ── Palavra-chave para voltar ao menu ────────────────────────────────────
    if (['0', 'menu', 'voltar', 'início', 'inicio'].includes(input.toLowerCase())) {
      await setEstado(telefone, 'menu')
      await enviarMenu(telefone, servicosMunicipio)
      return NextResponse.json({ ok: true })
    }

    // ── Validação de data de nascimento para buscas diretas ──────────────────
    if (estado.startsWith('validar_nasc|')) {
      const [_, estadoOriginal, buscaOriginal] = estado.split('|')
      
      const dataInput = input.trim()
      const dataLimpa = dataInput.replace(/\D/g, '')
      
      if (dataLimpa.length !== 8) {
        const respInvalido = `❌ *Data de nascimento inválida.*\n\nPor favor, informe a data no formato *DD/MM/AAAA* (ex: 01/11/1968).\n\nSe deseja cancelar a busca, digite *0* para voltar ao menu principal.`
        await salvarMensagem(telefone, 'assistant', respInvalido)
        await enviarMensagem(telefone, respInvalido)
        return NextResponse.json({ ok: true })
      }

      let toolName = 'buscar_agendamentos'
      let tipoBusca: string | null = null
      if (estadoOriginal === 'buscar_tfd') {
        toolName = 'buscar_tfd'
      } else if (estadoOriginal === 'buscar_sisreg_consulta') {
        toolName = 'buscar_sisreg'
        tipoBusca = 'consulta'
      } else if (estadoOriginal === 'buscar_sisreg_exame') {
        toolName = 'buscar_sisreg'
        tipoBusca = 'exame'
      }

      const args: any = { busca: buscaOriginal, data_nascimento: dataInput }
      if (tipoBusca) {
        args.tipo = tipoBusca
      }

      const resultado = await executarFerramenta(toolName, args, telefone, ctx)

      if (resultado.startsWith('ERRO_AUTORIZACAO') || resultado.includes('não confere') || resultado.includes('nao confere')) {
        const respErro = `❌ *Data de nascimento incorreta.*\n\nA data de nascimento informada não confere com o cadastro deste paciente. Tente novamente no formato *DD/MM/AAAA* ou digite *0* para cancelar.`
        await salvarMensagem(telefone, 'assistant', respErro)
        await enviarMensagem(telefone, respErro)
        return NextResponse.json({ ok: true })
      }

      let resposta = ''
      if (estadoOriginal === 'buscar_agendamento') {
        resposta = resultado === 'Nenhum agendamento encontrado para este paciente.'
          ? `❌ Nenhum agendamento encontrado para o CPF/CNS *${buscaOriginal}*.\n\nVerifique se os dados estão corretos ou ligue para a SMS: *${contatosSuporte.urgencia}*`
          : `📋 *Seus agendamentos:*\n\n${resultado}`
      } else if (estadoOriginal === 'buscar_tfd') {
        resposta = resultado === 'Nenhuma viagem TFD encontrada para este paciente.'
          ? `❌ Nenhuma viagem encontrada para o CPF/CNS *${buscaOriginal}*.\n\nVerifique se os dados estão corretos, ou entre em contato: *${contatosSuporte.urgencia}*`
          : `🚗 *Suas viagens TFD:*\n\n${resultado}`
      } else {
        if (resultado.includes('Nenhuma solicitação encontrada')) {
          resposta = `❌ *Paciente não encontrado.*\n\nNenhum registro foi localizado no SISREG com este CPF/CNS. Verifique se digitou os números corretos ou ligue para a SMS: *${contatosSuporte.urgencia}*`
        } else if (resultado.includes('não possui nenhuma solicitação ativa') || resultado.includes('não possui nenhuma solicitação activa')) {
          resposta = `ℹ️ *Tudo em dia!*\n\n${resultado}`
        } else {
          resposta = `📋 *Resultado da sua busca:*\n\n${resultado}`
        }
      }

      await setEstado(telefone, 'perguntar_mais_ajuda')
      await salvarMensagem(telefone, 'assistant', resposta)
      await enviarMensagem(telefone, resposta)
      await enviarBotoes(telefone, '❓ Outra Dúvida?', 'Posso te ajudar em algo mais?', [
        { id: '1', label: 'Sim' },
        { id: '2', label: 'Não' }
      ])
      return NextResponse.json({ ok: true })
    }

    if (estado === 'menu' && ['oi', 'ola', 'olá', 'bom dia', 'boa tarde', 'boa noite'].includes(input.toLowerCase())) {
      const primeiroNomeRaw = pacienteAtual?.nome ? pacienteAtual.nome.trim().split(/\s+/)[0] : ''
      const primeiroNome = primeiroNomeRaw ? primeiroNomeRaw.charAt(0).toUpperCase() + primeiroNomeRaw.slice(1).toLowerCase() : ''
      const saudacaoNome = primeiroNome ? `Olá, ${primeiroNome}! Tudo bem? 👋` : 'Olá! Tudo bem? 👋'
      const apresentacaoText = `${saudacaoNome} Sou o *${clientConfig.assistantName}*, assistente virtual da *Secretaria Municipal de Saúde de ${clientConfig.municipalityName}*.\n\nComo posso ajudar você hoje?`
      
      await salvarMensagem(telefone, 'assistant', apresentacaoText)
      await enviarMensagem(telefone, apresentacaoText)
      await enviarMenu(telefone, servicosMunicipio)
      return NextResponse.json({ ok: true })
    }

    if (estado === 'menu' && inputNum) {
      if (inputNum === '1') {
        await setEstado(telefone, 'opcao_marcar_tipo')
        await enviarBotoes(telefone, '🏥 Marcar Consulta ou Exame', 'Você deseja marcar uma consulta ou um exame?', [
          { id: '1', label: 'Consulta' },
          { id: '2', label: 'Exame' }
        ])
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
        await setEstado(telefone, 'menu_sisreg_tipo')
        await enviarBotoes(telefone, '🩺 Consultar SISREG', 'Você deseja consultar o status de uma consulta ou exame no SISREG?', [
          { id: '1', label: 'Consulta' },
          { id: '2', label: 'Exame' }
        ])
        return NextResponse.json({ ok: true })
      }
      if (inputNum === '4') {
        if (!servicosMunicipio.tfd) {
          const resp = `❌ Opção indisponível.\n\nO serviço de TFD não está habilitado para este município.`
          await setEstado(telefone, 'perguntar_mais_ajuda')
          await salvarMensagem(telefone, 'assistant', resp)
          await enviarMensagem(telefone, resp)
          await enviarBotoes(telefone, '❓ Outra Dúvida?', 'Posso te ajudar em algo mais?', [
            { id: '1', label: 'Sim' },
            { id: '2', label: 'Não' }
          ])
          return NextResponse.json({ ok: true })
        }
        const resp = `🚗 *TFD — Minhas viagens*\n\nInforme seu *CPF* ou *CNS* para eu buscar suas viagens agendadas.`
        await setEstado(telefone, 'buscar_tfd')
        await salvarMensagem(telefone, 'assistant', resp)
        await enviarMensagem(telefone, resp)
        return NextResponse.json({ ok: true })
      }
      if (inputNum === '5') {
        if (!servicosMunicipio.farmacia) {
          const resp = `❌ Opção indisponível.\n\nO serviço de farmácia não está configurado via bot para este município.`
          await setEstado(telefone, 'perguntar_mais_ajuda')
          await salvarMensagem(telefone, 'assistant', resp)
          await enviarMensagem(telefone, resp)
          await enviarBotoes(telefone, '❓ Outra Dúvida?', 'Posso te ajudar em algo mais?', [
            { id: '1', label: 'Sim' },
            { id: '2', label: 'Não' }
          ])
          return NextResponse.json({ ok: true })
        }
        const resp = `💊 *Remédios e Farmácia*\n\nA retirada de medicamentos é feita na farmácia municipal da UBS.\n📞 *${contatosSuporte.ubs_urbana}*\n\n_Leve a receita médica atualizada e seu Cartão SUS._`
        await setEstado(telefone, 'perguntar_mais_ajuda')
        await salvarMensagem(telefone, 'assistant', resp)
        await enviarMensagem(telefone, resp)
        await enviarBotoes(telefone, '❓ Outra Dúvida?', 'Posso te ajudar em algo mais?', [
          { id: '1', label: 'Sim' },
          { id: '2', label: 'Não' }
        ])
        return NextResponse.json({ ok: true })
      }
      if (inputNum === '6') {
        if (!servicosMunicipio.laboratorio) {
          const resp = `❌ Opção indisponível.\n\nO laboratório municipal não está ativo neste sistema.`
          await setEstado(telefone, 'perguntar_mais_ajuda')
          await salvarMensagem(telefone, 'assistant', resp)
          await enviarMensagem(telefone, resp)
          await enviarBotoes(telefone, '❓ Outra Dúvida?', 'Posso te ajudar em algo mais?', [
            { id: '1', label: 'Sim' },
            { id: '2', label: 'Não' }
          ])
          return NextResponse.json({ ok: true })
        }
        const resp = `🩸 *Resultados de Exames (Laboratório)*\n\nO laboratório realiza exames e entrega resultados nos dias úteis.\n📞 *${contatosSuporte.laboratorio}*`
        await setEstado(telefone, 'perguntar_mais_ajuda')
        await salvarMensagem(telefone, 'assistant', resp)
        await enviarMensagem(telefone, resp)
        await enviarBotoes(telefone, '❓ Outra Dúvida?', 'Posso te ajudar em algo mais?', [
          { id: '1', label: 'Sim' },
          { id: '2', label: 'Não' }
        ])
        return NextResponse.json({ ok: true })
      }
      if (inputNum === '7') {
        const labelMap: Record<string, string> = {
          urgencia: '🚨 Urgência/Emergência',
          ubs_urbana: '🏨 UBS Urbana',
          laboratorio: '🔬 Laboratório Municipal',
          vigilancia: '🛡️ Vigilância Sanitária'
        }
        const activeContacts = Object.keys(rawContatos).length > 0 ? rawContatos : {
          urgencia: "(63) 99130-6916",
          ubs_urbana: "(63) 99130-2450",
          laboratorio: "(63) 99132-7974",
          vigilancia: "(63) 99131-4490"
        }
        const lines = Object.entries(activeContacts)
          .filter(([_, val]) => !!val)
          .map(([k, v]) => {
            const label = labelMap[k] || k
            return `📞 *${label}*: ${v}`
          })
        const resp = `📞 *Telefones e Endereços úteis*\n\n` + (lines.length > 0 ? lines.join('\n') : 'Nenhum telefone cadastrado no momento.')
        await setEstado(telefone, 'perguntar_mais_ajuda')
        await salvarMensagem(telefone, 'assistant', resp)
        await enviarMensagem(telefone, resp)
        await enviarBotoes(telefone, '❓ Outra Dúvida?', 'Posso te ajudar em algo mais?', [
          { id: '1', label: 'Sim' },
          { id: '2', label: 'Não' }
        ])
        return NextResponse.json({ ok: true })
      }
      if (inputNum === '8') {
        const resp = `🗣️ Transferindo para um atendente humano... Por favor, aguarde.`
        await executarFerramenta('escalar_para_humano', { motivo: 'Opção do menu selecionada' }, telefone, ctx)
        await salvarMensagem(telefone, 'assistant', resp)
        await enviarMensagem(telefone, resp)
        await setEstado(telefone, 'aguardando_humano')
        return NextResponse.json({ ok: true })
      }
    }

    if (estado === 'opcao_marcar_tipo' && inputNum) {
      if (inputNum === '1') {
        await setEstado(telefone, 'opcao_marcar_consulta_local')
        await enviarBotoes(telefone, '🩺 Marcar Consulta', 'Onde você deseja realizar a consulta?', [
          { id: '1', label: 'Na UBS de referência' },
          { id: '2', label: 'Com Especialista' },
          { id: '3', label: 'Consulta Particular' }
        ])
        return NextResponse.json({ ok: true })
      }
      if (inputNum === '2') {
        await setEstado(telefone, 'opcao_marcar_exame_tipo')
        await enviarLista(telefone, '🔬 Marcar Exame', 'Qual tipo de exame você deseja marcar?', 'Escolher Exame', [
          {
            title: 'Tipos de Exame',
            rows: [
              { id: '1', title: '🩸 Exame de Sangue' },
              { id: '2', title: '🌸 Prevenção (PCCU)' },
              { id: '3', title: '🤰 Ultrassonografia (USG)' },
              { id: '4', title: '💓 Eletrocardiograma' },
              { id: '5', title: '🔍 Exame Particular' }
            ]
          }
        ])
        return NextResponse.json({ ok: true })
      }

      const resp = `❌ Opção inválida.`
      await salvarMensagem(telefone, 'assistant', resp)
      await enviarMensagem(telefone, resp)
      await enviarBotoes(telefone, '🏥 Marcar Consulta ou Exame', 'Você deseja marcar uma consulta ou um exame?', [
        { id: '1', label: 'Consulta' },
        { id: '2', label: 'Exame' }
      ])
      return NextResponse.json({ ok: true })
    }

    if (estado === 'opcao_marcar_consulta_local' && inputNum) {
      if (inputNum === '1') {
        const ubsInfoList = listaUbs.map((u: any) => `• *${u.nome}* (${u.descricao}):\n  📞 ${u.telefone}`).join('\n\n')
        const ubsHospital = listaUbs.find((u: any) => u.nome.toLowerCase().includes('rural') || u.descricao.toLowerCase().includes('hospital'))
        const hospitalHighlight = ubsHospital 
          ? `\n\n• *${ubsHospital.nome}* (${ubsHospital.descricao}):\n  📞 ${ubsHospital.telefone}` 
          : `\n\n• *UBS Rural* (UBS Luiz Francisco de Miranda (Hospital)):\n  📞 ${contatosSuporte.urgencia}`

        const resp = `🏥 *Consulta na UBS (Postinho ou Unidade Básica)*\n\n• Para atendimento médico, com dentista ou atualização de vacinas, vá ou ligue na sua UBS:\n\n${ubsInfoList}\n\n🚨 *Casos de Urgência:*\nCompareça à unidade de urgência mais próxima.${hospitalHighlight}`
        await setEstado(telefone, 'perguntar_mais_ajuda')
        await salvarMensagem(telefone, 'assistant', resp)
        await enviarMensagem(telefone, resp)
        await enviarBotoes(telefone, '❓ Outra Dúvida?', 'Posso te ajudar em algo mais?', [
          { id: '1', label: 'Sim' },
          { id: '2', label: 'Não' }
        ])
        return NextResponse.json({ ok: true })
      }
      if (inputNum === '2') {
        const resp = `✨ *Consulta com Especialista*\n\n• O atendimento das especialidades acontece de forma programada pelo município.\n• Para conseguir o atendimento, você precisa passar primeiro pela consulta na UBS de referência e entregar a cópia do pedido médico na Secretaria de Saúde.\n• Seguimos a ordem de chegada e urgência dos pedidos.\n\n⚠️ *Informação Importante:*\nMantenha sempre seu telefone de contato atualizado no cadastro municipal para receber os avisos de agendamentos.`
        await setEstado(telefone, 'perguntar_mais_ajuda')
        await salvarMensagem(telefone, 'assistant', resp)
        await enviarMensagem(telefone, resp)
        await enviarBotoes(telefone, '❓ Outra Dúvida?', 'Posso te ajudar em algo mais?', [
          { id: '1', label: 'Sim' },
          { id: '2', label: 'Não' }
        ])
        return NextResponse.json({ ok: true })
      }
      if (inputNum === '3') {
        await setEstado(telefone, 'opcao_marcar_particular_consulta_pedido')
        await enviarBotoes(telefone, '💼 Consulta Particular', 'Você já possui a indicação ou encaminhamento médico para esta consulta?', [
          { id: '1', label: 'Sim' },
          { id: '2', label: 'Não' }
        ])
        return NextResponse.json({ ok: true })
      }

      const resp = `❌ Opção inválida.`
      await salvarMensagem(telefone, 'assistant', resp)
      await enviarMensagem(telefone, resp)
      await enviarBotoes(telefone, '🩺 Marcar Consulta', 'Onde você deseja realizar a consulta?', [
        { id: '1', label: 'Na UBS de referência' },
        { id: '2', label: 'Com Especialista' },
        { id: '3', label: 'Consulta Particular' }
      ])
      return NextResponse.json({ ok: true })
    }

    if (estado === 'opcao_marcar_exame_tipo' && inputNum) {
      if (inputNum === '1') {
        const resp = `🧪 *Exames de Sangue (Laboratório)*\n\nPara agendar ou tirar dúvidas sobre exames de sangue, entre em contato diretamente com o Laboratório Municipal:\n📞 *${contatosSuporte.laboratorio}*\n\n⏰ Horário de atendimento:\nSegunda a sexta-feira, nos horários da UBS.`
        await setEstado(telefone, 'perguntar_mais_ajuda')
        await salvarMensagem(telefone, 'assistant', resp)
        await enviarMensagem(telefone, resp)
        await enviarBotoes(telefone, '❓ Outra Dúvida?', 'Posso te ajudar em algo mais?', [
          { id: '1', label: 'Sim' },
          { id: '2', label: 'Não' }
        ])
        return NextResponse.json({ ok: true })
      }
      if (inputNum === '2') {
        const ubsListText = listaUbs.map((u: any) => `• *${u.nome}*:\n  📞 ${u.telefone}`).join('\n')
        const resp = `🌸 *Prevenção (PCCU)*\n\nPara verificar o agendamento de exames de Prevenção (PCCU), entre em contato com a sua UBS de referência:\n\n${ubsListText}`
        await setEstado(telefone, 'perguntar_mais_ajuda')
        await salvarMensagem(telefone, 'assistant', resp)
        await enviarMensagem(telefone, resp)
        await enviarBotoes(telefone, '❓ Outra Dúvida?', 'Posso te ajudar em algo mais?', [
          { id: '1', label: 'Sim' },
          { id: '2', label: 'Não' }
        ])
        return NextResponse.json({ ok: true })
      }
      if (inputNum === '3') {
        const resp = `✨ *Ultrassonografia (USG)*\n\n• O atendimento de Ultrassonografia (USG) acontece uma vez ao mês de acordo com a programação do município.\n• Para conseguir a USG, você precisa passar pela consulta na UBS e deixar a cópia do pedido médico na Secretaria de Saúde.\n\n⚠️ *Dúvidas ou Informações:*\nEntre em contato diretamente com a Secretaria de Saúde:\n📞 *${contatosSuporte.urgencia}*`
        await setEstado(telefone, 'perguntar_mais_ajuda')
        await salvarMensagem(telefone, 'assistant', resp)
        await enviarMensagem(telefone, resp)
        await enviarBotoes(telefone, '❓ Outra Dúvida?', 'Posso te ajudar em algo mais?', [
          { id: '1', label: 'Sim' },
          { id: '2', label: 'Não' }
        ])
        return NextResponse.json({ ok: true })
      }
      if (inputNum === '4') {
        const ubsListText = listaUbs.map((u: any) => `• *${u.nome}*:\n  📞 ${u.telefone}`).join('\n')
        const resp = `💓 *Eletrocardiograma*\n\nPara agendar ou verificar o agendamento de Eletrocardiograma, entre em contato com a sua UBS de referência:\n\n${ubsListText}`
        await setEstado(telefone, 'perguntar_mais_ajuda')
        await salvarMensagem(telefone, 'assistant', resp)
        await enviarMensagem(telefone, resp)
        await enviarBotoes(telefone, '❓ Outra Dúvida?', 'Posso te ajudar em algo mais?', [
          { id: '1', label: 'Sim' },
          { id: '2', label: 'Não' }
        ])
        return NextResponse.json({ ok: true })
      }
      if (inputNum === '5') {
        await setEstado(telefone, 'opcao_marcar_particular_pedido')
        await enviarBotoes(telefone, '💼 Exame Particular', 'Você já possui o pedido médico para este exame?', [
          { id: '1', label: 'Sim, já tenho o pedido' },
          { id: '2', label: 'Não tenho o pedido' }
        ])
        return NextResponse.json({ ok: true })
      }

      const resp = `❌ Opção inválida.`
      await salvarMensagem(telefone, 'assistant', resp)
      await enviarMensagem(telefone, resp)
      await enviarLista(telefone, '🔬 Marcar Exame', 'Qual tipo de exame você deseja marcar?', 'Escolher Exame', [
        {
          title: 'Tipos de Exame',
          rows: [
            { id: '1', title: '🩸 Exame de Sangue' },
            { id: '2', title: '🌸 Prevenção (PCCU)' },
            { id: '3', title: '🤰 Ultrassonografia (USG)' },
            { id: '4', title: '💓 Eletrocardiograma' },
            { id: '5', title: '🔍 Exame Particular' }
          ]
        }
      ])
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
        const resp = `⚠️ *Atenção:*\nPara agendar exames particulares com nossa ajuda, é obrigatório possuir o pedido médico prévio. Por favor, consulte um médico em sua UBS para obter a indicação do exame.`
        await setEstado(telefone, 'perguntar_mais_ajuda')
        await salvarMensagem(telefone, 'assistant', resp)
        await enviarMensagem(telefone, resp)
        await enviarBotoes(telefone, '❓ Outra Dúvida?', 'Posso te ajudar em algo mais?', [
          { id: '1', label: 'Sim' },
          { id: '2', label: 'Não' }
        ])
        return NextResponse.json({ ok: true })
      }

      const resp = `❌ Opção inválida.`
      await salvarMensagem(telefone, 'assistant', resp)
      await enviarMensagem(telefone, resp)
      await enviarBotoes(telefone, '💼 Exame Particular', 'Você já possui o pedido médico para este exame?', [
        { id: '1', label: 'Sim, já tenho o pedido' },
        { id: '2', label: 'Não tenho o pedido' }
      ])
      return NextResponse.json({ ok: true })
    }

    if (estado === 'opcao_marcar_particular_foto') {
      const resp = `🗣️ *Transferindo para um Atendente...*\n\nEstou encaminhando seu pedido de exame particular para o setor responsável. Por favor, aguarde, em breve você será atendido por um humano.`
      await executarFerramenta('escalar_para_humano', { motivo: 'Pedido de exame particular com foto enviado' }, telefone, ctx)
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
        const resp = `⚠️ *Atenção:*\nPara agendar consultas particulares com nossa ajuda, é necessário possuir a indicação/encaminhamento médico prévio. Por favor, consulte um médico em sua UBS para obter a indicação.`
        await setEstado(telefone, 'perguntar_mais_ajuda')
        await salvarMensagem(telefone, 'assistant', resp)
        await enviarMensagem(telefone, resp)
        await enviarBotoes(telefone, '❓ Outra Dúvida?', 'Posso te ajudar em algo mais?', [
          { id: '1', label: 'Sim' },
          { id: '2', label: 'Não' }
        ])
        return NextResponse.json({ ok: true })
      }

      const resp = `❌ Opção inválida.`
      await salvarMensagem(telefone, 'assistant', resp)
      await enviarMensagem(telefone, resp)
      await enviarBotoes(telefone, '💼 Consulta Particular', 'Você já possui a indicação ou encaminhamento médico para esta consulta?', [
        { id: '1', label: 'Sim' },
        { id: '2', label: 'Não' }
      ])
      return NextResponse.json({ ok: true })
    }

    if (estado === 'opcao_marcar_particular_consulta_foto') {
      const resp = `🗣️ *Transferindo para um Atendente...*\n\nEstou encaminhando seu pedido de consulta particular para o setor responsável. Por favor, aguarde, em breve você será atendido por um humano.`
      await executarFerramenta('escalar_para_humano', { motivo: 'Pedido de consulta particular com foto enviado' }, telefone, ctx)
      await setEstado(telefone, 'aguardando_humano')
      await salvarMensagem(telefone, 'assistant', resp)
      await enviarMensagem(telefone, resp)
      return NextResponse.json({ ok: true })
    }
      
    if (estado === 'perguntar_mais_ajuda' && inputNum) {
      if (inputNum === '1') {
        await setEstado(telefone, 'menu')
        await enviarMenu(telefone, servicosMunicipio)
        return NextResponse.json({ ok: true })
      }
      if (inputNum === '2') {
        const resp = `✨ A Secretaria Municipal de Saúde agradece o seu contato! Tenha um excelente dia. 🏥\n\n_Se precisar de mim novamente, basta enviar uma mensagem._`
        await setEstado(telefone, 'menu')
        await salvarMensagem(telefone, 'assistant', resp)
        await enviarMensagem(telefone, resp)
        return NextResponse.json({ ok: true })
      }

      const resp = `❌ Opção inválida.`
      await salvarMensagem(telefone, 'assistant', resp)
      await enviarMensagem(telefone, resp)
      await enviarBotoes(telefone, '❓ Outra Dúvida?', 'Posso te ajudar em algo mais?', [
        { id: '1', label: 'Sim' },
        { id: '2', label: 'Não' }
      ])
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
      
      const resp = `❌ Opção inválida.`
      await salvarMensagem(telefone, 'assistant', resp)
      await enviarMensagem(telefone, resp)
      await enviarBotoes(telefone, '🩺 Consultar SISREG', 'Você deseja consultar o status de uma consulta ou exame no SISREG?', [
        { id: '1', label: 'Consulta' },
        { id: '2', label: 'Exame' }
      ])
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

      const resultado = await executarFerramenta('buscar_agendamentos', { busca: soDigitos }, telefone, ctx)
      if (resultado.startsWith('REQUER_VALIDACAO_NASCIMENTO')) {
        const msgAmigavel = resultado.replace('REQUER_VALIDACAO_NASCIMENTO: ', '')
        await setEstado(telefone, `validar_nasc|buscar_agendamento|${soDigitos}`)
        await salvarMensagem(telefone, 'assistant', msgAmigavel)
        await enviarMensagem(telefone, msgAmigavel)
        return NextResponse.json({ ok: true })
      }

      const resposta = resultado === 'Nenhum agendamento encontrado para este paciente.'
        ? `❌ Nenhum agendamento encontrado para o CPF/CNS *${soDigitos}*.\n\nVerifique se os dados estão corretos e tente novamente, ou ligue para a SMS:\n📞 *${contatosSuporte.urgencia}*`
        : `📋 *Seus agendamentos:*\n\n${resultado}`
      await setEstado(telefone, 'perguntar_mais_ajuda')
      await salvarMensagem(telefone, 'assistant', resposta)
      await enviarMensagem(telefone, resposta)
      await enviarBotoes(telefone, '❓ Outra Dúvida?', 'Posso te ajudar em algo mais?', [
        { id: '1', label: 'Sim' },
        { id: '2', label: 'Não' }
      ])
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

      const resultado = await executarFerramenta('buscar_tfd', { busca: soDigitos }, telefone, ctx)
      if (resultado.startsWith('REQUER_VALIDACAO_NASCIMENTO')) {
        const msgAmigavel = resultado.replace('REQUER_VALIDACAO_NASCIMENTO: ', '')
        await setEstado(telefone, `validar_nasc|buscar_tfd|${soDigitos}`)
        await salvarMensagem(telefone, 'assistant', msgAmigavel)
        await enviarMensagem(telefone, msgAmigavel)
        return NextResponse.json({ ok: true })
      }

      const resposta = resultado === 'Nenhuma viagem TFD encontrada para este paciente.'
        ? `❌ Nenhuma viagem encontrada para o CPF/CNS *${soDigitos}*.\n\nVerifique se os dados estão corretos, ou entre em contato:\n📞 *${contatosSuporte.urgencia}*`
        : `🚗 *Suas viagens TFD:*\n\n${resultado}`
      await setEstado(telefone, 'perguntar_mais_ajuda')
      await salvarMensagem(telefone, 'assistant', resposta)
      await enviarMensagem(telefone, resposta)
      await enviarBotoes(telefone, '❓ Outra Dúvida?', 'Posso te ajudar em algo mais?', [
        { id: '1', label: 'Sim' },
        { id: '2', label: 'Não' }
      ])
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

      const resultado = await executarFerramenta('buscar_sisreg', { busca: soDigitos, tipo: tipoBusca }, telefone, ctx)
      if (resultado.startsWith('REQUER_VALIDACAO_NASCIMENTO')) {
        const msgAmigavel = resultado.replace('REQUER_VALIDACAO_NASCIMENTO: ', '')
        await setEstado(telefone, `validar_nasc|${estado}|${soDigitos}`)
        await salvarMensagem(telefone, 'assistant', msgAmigavel)
        await enviarMensagem(telefone, msgAmigavel)
        return NextResponse.json({ ok: true })
      }
      
      let resposta = ''
      if (resultado.includes('Nenhuma solicitação encontrada')) {
        resposta = `❌ *Paciente não encontrado.*\n\nNenhum registro foi localizado no SISREG com este CPF/CNS. Verifique se digitou os números corretos ou ligue para a SMS: *${contatosSuporte.urgencia}*`
      } else if (resultado.includes('não possui nenhuma solicitação ativa')) {
        resposta = `ℹ️ *Tudo em dia!*\n\n${resultado}`
      } else {
        resposta = `📋 *Resultado da sua busca:*\n\n${resultado}`
      }
      
      await setEstado(telefone, 'perguntar_mais_ajuda')
      await salvarMensagem(telefone, 'assistant', resposta)
      await enviarMensagem(telefone, resposta)
      await enviarBotoes(telefone, '❓ Outra Dúvida?', 'Posso te ajudar em algo mais?', [
        { id: '1', label: 'Sim' },
        { id: '2', label: 'Não' }
      ])
      return NextResponse.json({ ok: true })
    }

    // ── Fluxos abertos tratados pela IA ──────────────────────────────────────

    // Constrói lista de UBSs e serviços do banco para injetar no Prompt da IA
    const promptUbsText = listaUbs.map((u: any) => `🏨 *${u.nome} (${u.descricao})* — 📞 ${u.telefone}\n- Serviços: ${u.servicos.join('\n- ')}`).join('\n\n')
    
    // Constrói ACS list
    const acsRuralText = listaAcs.rural ? listaAcs.rural.join(', ') : ''
    const acsUrbanaText = listaAcs.urbana ? listaAcs.urbana.join(', ') : ''

    const systemPrompt = `Você é ${clientConfig.assistantName}, o assistente virtual da Secretaria Municipal de Saúde de ${clientConfig.municipalityName} - ${clientConfig.municipalityUF}.
Data e hora atual: ${new Date().toLocaleString('pt-BR', { timeZone: process.env.NEXT_PUBLIC_TIMEZONE || 'America/Araguaina' })}

═══════════════════════════════════════
IDENTIDADE E PAPEL
═══════════════════════════════════════
Você é um ATENDENTE VIRTUAL de saúde pública. Seu papel é:
✅ Informar sobre serviços, horários e contatos da SMS
✅ Consultar agendamentos, ${servicosMunicipio.tfd ? 'viagens TFD e ' : ''}dados cadastrais do sistema municipal
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
   Resposta obrigatória: "Não sou profissional de saúde e não posso avaliar sintomas. 🚨 Em caso de urgência, procure imediatamente a UBS/Hospital: 📞 *${contatosSuporte.urgencia}*. Se não for urgência, marque uma consulta com seu médico."

2. PRESCRIÇÕES / MEDICAMENTOS
   Exemplos: "posso tomar esse remédio?", "qual a dose de paracetamol?", "esse medicamento faz mal?"
   Resposta obrigatória: "Não tenho como orientar sobre medicamentos — isso é responsabilidade do médico ou farmacêutico. 💊 Para dúvidas sobre medicamentos, procure a farmácia da UBS: 📞 *${contatosSuporte.ubs_urbana}*."

3. LAUDOS / RESULTADOS CLÍNICOS
   Exemplos: "meu exame deu X, é grave?", "o que significa esse resultado?"
   Resposta obrigatória: "Não posso interpretar resultados de exames — isso é função do médico. Para retirar ou discutir resultados, procure o laboratório: 📞 *${contatosSuporte.laboratorio}*."

4. SAÚDE MENTAL / SOFRIMENTO EMOCIONAL
   Exemplos: "estou muito triste", "não quero mais viver", "estou desesperado"
   Resposta obrigatória: "Sinto muito que esteja passando por isso. 💙 Vou acionar um atendente para te ajudar." → use imediatamente escalar_para_humano.

5. ASSUNTOS FORA DA SMS
   Exemplos: política, jurídico, financeiro, outros municípios, notícias
   Resposta obrigatória: "Este canal é exclusivo para serviços de saúde de ${clientConfig.municipalityName}. Para essa dúvida, procure o órgão responsável."

REGRA DE OURO: Se tiver dúvida se deve responder, NÃO responda — direcione para o telefone da SMS ou escale para humano. Nunca invente informações.

═══════════════════════════════════════
MAPA DE SERVIÇOS
═══════════════════════════════════════
${promptUbsText}

🔬 *Laboratório* — 📞 ${contatosSuporte.laboratorio}
- Realização e resultado de exames de sangue
- Assistente social

🏛️ *Secretaria Municipal de Saúde* — 📞 ${contatosSuporte.urgencia}
- Especialistas do projeto local de saúde
- Exames de imagem
- Status de pedido de agendamento (usar buscar_sisreg para solicitações do estado)
- Agendar consulta ou exame particular

SISTEMA SISREG:
- Use a ferramenta 'buscar_sisreg' para consultas e exames que são regulados pelo estado (geralmente especialidades e exames complexos).
- Se o usuário perguntar "Como está meu pedido no SISREG?" ou fornecer o CPF para ver exames pendentes, use esta ferramenta.

🏃 *Academia de Saúde*
- Fisioterapeuta e acompanhamento de fisioterapia

🛡️ *Vigilância Sanitária* — 📞 ${contatosSuporte.vigilancia}
- Alvará sanitário, denúncias

═══════════════════════════════════════
TRIAGEM — CONSULTA DE ROTINA
═══════════════════════════════════════
Quando pedir consulta médica geral/rotina, pergunte o ACS:

UBS RURAL: ACS ${acsRuralText}
UBS URBANA: ACS ${acsUrbanaText}

Se não souber o ACS: "Verifique com seu ACS ou compareça à UBS mais próxima."

═══════════════════════════════════════
FERRAMENTAS — REGRAS OBRIGATÓRIAS
═══════════════════════════════════════
- Nome ou CPF/CNS recebido → chame a ferramenta IMEDIATAMENTE, sem perguntar mais nada
- CPF com ou sem máscara são válidos
- NUNCA escreva <function=...> no texto
- Se a ferramenta não retornar resultado → informe e ofereça o telefone da SMS
- Se não tiver certeza de uma informação → diga "Não tenho essa informação. Ligue para a SMS: 📞 *${contatosSuporte.urgencia}*"

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
🚨 Urgências: ${contatosSuporte.urgencia} | UBS Urbana: ${contatosSuporte.ubs_urbana} | Lab: ${contatosSuporte.laboratorio} | VISA: ${contatosSuporte.vigilancia}`

    const model = genAI.getGenerativeModel({
      model: GEMINI_MODEL,
      systemInstruction: systemPrompt + identificacaoUsuarioPrompt,
      tools: [{ functionDeclarations: tools }],
      generationConfig: {
        temperature: 0.1,
      }
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
        const resultado = await executarFerramenta(call.name, call.args, telefone, ctx)
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
    await enviarMenu(telefone, servicosMunicipio)

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    console.error('Webhook Francisco erro:', e)
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 })
  }
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    agente: `${clientConfig.assistantName} — SMS ${clientConfig.municipalityName} (Gemini)`,
    model: GEMINI_MODEL,
    evolutionConfigured: Boolean(EVOLUTION_URL && EVOLUTION_KEY && EVOLUTION_INSTANCE)
  })
}
