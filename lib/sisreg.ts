export type SisregSolicitacao = {
  codigo_procedimento: string | null
  procedimento: string
  data_solicitacao: string | null
  data_marcacao: string | null
  status: string
  unidade_executante: string | null
  classificacao_risco: string | null
  nascimento: string | null
  tipo: 'Consulta' | 'Exame' | 'Indefinido'
}

export type SisregSolicitacaoComFila = SisregSolicitacao & {
  posicao_fila?: number
}

type SisregSearchHit = {
  _source?: Partial<Record<string, any>>
}

export class SisregConfigError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'SisregConfigError'
  }
}

export class SisregRequestError extends Error {
  status: number
  details: string

  constructor(status: number, details: string) {
    super('Erro no SISREG')
    this.name = 'SisregRequestError'
    this.status = status
    this.details = details
  }
}

const DEFAULT_SISREG_URL = 'https://sisreg-es.saude.gov.br'
const DEFAULT_SISREG_INDEX = 'solicitacao-ambulatorial-to-conceicao-do-tocantins'

function getSisregConfig() {
  const user = process.env.SISREG_USER
  const password = process.env.SISREG_PASSWORD
  const url = process.env.SISREG_URL || DEFAULT_SISREG_URL
  const index = process.env.SISREG_INDEX || DEFAULT_SISREG_INDEX

  if (!user || !password) {
    throw new SisregConfigError('Configure SISREG_USER e SISREG_PASSWORD no ambiente.')
  }

  return { user, password, url: url.replace(/\/$/, ''), index }
}

function montarQueryBase(busca: string) {
  const soDigitos = busca.replace(/\D/g, '')
  let userQuery: any = {}

  if (soDigitos.length === 11) {
    userQuery = { match: { cpf_usuario: soDigitos } }
  } else if (soDigitos.length === 15) {
    userQuery = { match: { cns_usuario: soDigitos } }
  } else {
    // Busca por nome removida. Apenas CPF ou CNS são permitidos.
    userQuery = { match_none: {} }
  }

  return {
    query: {
      bool: {
        must: [userQuery]
      }
    }
  }
}

export async function buscarSolicitacoesSisreg(busca: string, tipo: 'consulta' | 'exame' | 'ambos'): Promise<SisregSolicitacaoComFila[]> {
  const termo = busca?.trim()
  if (!termo) return []

  const config = getSisregConfig()
  const auth = Buffer.from(`${config.user}:${config.password}`).toString('base64')

  const response = await fetch(`${config.url}/${config.index}/_search`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Basic ${auth}`,
    },
    body: JSON.stringify({
      ...montarQueryBase(termo),
      size: 30, // Traz até 30 registros recentes para filtrar
      sort: [{ data_solicitacao: { order: 'desc' } }],
    }),
  })

  if (!response.ok) {
    throw new SisregRequestError(response.status, await response.text())
  }

  const data = await response.json()
  const resultados: SisregSearchHit[] = data.hits?.hits || []

  const solicitacoes: SisregSolicitacao[] = resultados.map((hit) => {
    const s = hit._source || {}
    const codigo_procedimento = s.procedimentos?.[0]?.codigo_sigtap || s.codigo_interno_procedimento || s.co_procedimento || null
    const startsWith03 = codigo_procedimento?.startsWith('03')
    const procedTipo = startsWith03 ? 'Consulta' : 'Exame'

    return {
      codigo_procedimento,
      procedimento:
        s.procedimentos?.[0]?.descricao_interna?.trim() ||
        s.procedimentos?.[0]?.descricao_sigtap?.trim() ||
        s.descricao_interna_procedimento ||
        s.no_procedimento ||
        'Procedimento não identificado',
      data_solicitacao: s.data_solicitacao || null,
      data_marcacao: s.data_marcacao || null,
      status: s.status_solicitacao || s.no_situacao_solicitacao || 'Pendente',
      unidade_executante: s.nome_unidade_solicitante || s.no_unidade_executante || null,
      classificacao_risco: s.codigo_classificacao_risco || s.classificacao_risco || null,
      nascimento: s.dt_nascimento_usuario || null,
      tipo: procedTipo
    }
  })

  // Filtra por Consulta ou Exame e aplica regras inteligentes para ocultar cancelados e históricos antigos
  const solicitacoesFiltradas = solicitacoes.filter(sol => {
    // 1. Filtro por tipo (Consulta vs Exame)
    const cod = sol.codigo_procedimento || ''
    if (tipo === 'consulta' && !cod.startsWith('03')) return false
    if (tipo === 'exame' && !cod.startsWith('02')) return false

    // 2. Filtro inteligente de status e datas
    const statusUpper = (sol.status || '').toUpperCase()

    // Ocultar cancelados/excluídos/devolvidos
    if (
      statusUpper.includes('CANCELADO') || 
      statusUpper.includes('EXCLUIDO') || 
      statusUpper.includes('REJEITADO') || 
      statusUpper.includes('DEVOLVIDO')
    ) {
      return false
    }

    // Ocultar concluídos/executados/atendidos/confirmados antigos
    if (
      statusUpper.includes('EXECUTADO') || 
      statusUpper.includes('CONCLUIDO') || 
      statusUpper.includes('ATENDIDO') ||
      statusUpper.includes('EXECUTANTE')
    ) {
      return false
    }

    // Verifica se a solicitação está ativamente na fila de espera/regulação
    const isFilaRegulacao = 
      statusUpper.includes('PENDENTE') || 
      statusUpper.includes('SOLICITADO') || 
      statusUpper.includes('REGULACAO') || 
      statusUpper.includes('FILA')

    if (!isFilaRegulacao) {
      // Se não estiver ativamente na fila (ou seja, já foi confirmada/agendada/finalizada)
      // Se a data de marcação já passou, ou se a solicitação foi feita há mais de 90 dias sem marcação ativa, consideramos concluída/histórica
      const hoje = new Date()
      hoje.setHours(0, 0, 0, 0)

      if (sol.data_marcacao) {
        const dataMarcacao = new Date(sol.data_marcacao)
        dataMarcacao.setHours(0, 0, 0, 0)
        if (dataMarcacao < hoje) {
          return false
        }
      } else if (sol.data_solicitacao) {
        const dataSol = new Date(sol.data_solicitacao)
        const diffTempo = Math.abs(hoje.getTime() - dataSol.getTime())
        const diffDias = Math.ceil(diffTempo / (1000 * 60 * 60 * 24))
        // Confirmados com mais de 90 dias sem data de marcação ativa são considerados históricos/concluídos
        if (diffDias > 90) {
          return false
        }
      }
    }

    return true
  })

  // Se o paciente foi encontrado no SISREG, mas nenhuma de suas solicitações está ativa
  if (solicitacoesFiltradas.length === 0 && resultados.length > 0) {
    return [{
      codigo_procedimento: 'NENHUM_ATIVO',
      procedimento: 'Nenhuma solicitação ativa',
      data_solicitacao: null,
      data_marcacao: null,
      status: 'SEM_ATIVOS',
      unidade_executante: null,
      classificacao_risco: null,
      nascimento: null,
      tipo: tipo === 'consulta' ? 'Consulta' : 'Exame'
    }]
  }

  // Calcula a fila para as pendentes
  const solicitacoesComFila = await Promise.all(solicitacoesFiltradas.map(async (sol) => {
    if (sol.status.toUpperCase().includes('PENDENTE') && sol.codigo_procedimento && sol.data_solicitacao) {
      try {
        const countResponse = await fetch(`${config.url}/${config.index}/_count`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Basic ${auth}`,
          },
          body: JSON.stringify({
            query: {
              bool: {
                must: [
                  {
                    bool: {
                      should: [
                        { match: { "codigo_interno_procedimento": sol.codigo_procedimento } },
                        { match: { "co_procedimento": sol.codigo_procedimento } },
                        { match: { "procedimentos.codigo_sigtap": sol.codigo_procedimento } },
                        { match: { "procedimentos.codigo_interno": sol.codigo_procedimento } }
                      ],
                      minimum_should_match: 1
                    }
                  },
                  { wildcard: { "status_solicitacao": "*PENDENTE*" } },
                  { range: { "data_solicitacao": { "lt": sol.data_solicitacao } } }
                ]
              }
            }
          })
        })
        if (countResponse.ok) {
          const countData = await countResponse.json()
          return { ...sol, posicao_fila: (countData.count || 0) + 1 }
        }
      } catch (e) {
        console.error('Erro ao calcular fila', e)
      }
    }
    return sol
  }))

  return solicitacoesComFila
}
