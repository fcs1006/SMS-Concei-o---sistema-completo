import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServer } from '@/lib/supabaseServer'

const DEFAULT_SISREG_URL = 'https://sisreg-es.saude.gov.br'
const DEFAULT_SISREG_INDEX = 'marcacao-ambulatorial-to-conceicao-do-tocantins'

export async function POST(request: NextRequest) {
  try {
    const supabase = getSupabaseServer()
    const { searchParams } = new URL(request.url)
    const userCpf = searchParams.get('userCpf')

    if (!userCpf) {
      return NextResponse.json({ ok: false, error: 'Parâmetro userCpf é obrigatório.' }, { status: 401 })
    }

    // Valida permissão do usuário
    const { data: user, error: userErr } = await supabase
      .from('usuarios')
      .select('ativo')
      .eq('usuario', userCpf)
      .eq('ativo', true)
      .maybeSingle()

    if (userErr || !user) {
      return NextResponse.json({ ok: false, error: 'Acesso negado. Usuário inválido ou inativo.' }, { status: 403 })
    }

    // Executa a sincronização do SISREG
    const sisregUser = process.env.SISREG_USER
    const sisregPassword = process.env.SISREG_PASSWORD
    const url = process.env.SISREG_URL || DEFAULT_SISREG_URL
    const index = process.env.SISREG_INDEX || DEFAULT_SISREG_INDEX

    if (!sisregUser || !sisregPassword) {
      return NextResponse.json({ ok: false, error: 'Credenciais do SISREG não configuradas no servidor.' }, { status: 500 })
    }

    const auth = Buffer.from(`${sisregUser}:${sisregPassword}`).toString('base64')

    const response = await fetch(`${url.replace(/\/$/, '')}/${index}/_search`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${auth}`,
      },
      body: JSON.stringify({
        query: { match_all: {} },
        size: 10000,
        sort: [{ data_solicitacao: { order: 'desc' } }],
      }),
    })

    if (!response.ok) {
      const errText = await response.text()
      return NextResponse.json({ ok: false, error: `Erro na API do SISREG: ${response.status}`, details: errText }, { status: 502 })
    }

    const data = await response.json()
    const hits = data.hits?.hits || []

    const todasSolicitacoes = hits.map((hit: any) => {
      const s = hit._source || {}

      let observacaoSolicitante = null
      if (Array.isArray(s.laudo)) {
        const entry = s.laudo.find((l: any) => 
          l.tipo_perfil?.toLowerCase() === 'solicitante' || 
          l.tipo_descricao?.toLowerCase()?.includes('observac')
        )
        if (entry) {
          observacaoSolicitante = entry.observacao
        }
      }

      return {
        codigo_solicitacao: s.codigo_solicitacao || s.co_solicitacao || null,
        data_solicitacao: s.data_solicitacao || null,
        data_aprovacao: s.data_aprovacao || s.data_autorizacao || null,
        data_marcacao: s.data_marcacao || null,
        data_confirmacao: s.data_confirmacao || null,
        no_usuario: s.no_usuario || null,
        cns_usuario: s.cns_usuario || null,
        cpf_usuario: s.cpf_usuario || null,
        no_mae_usuario: s.no_mae_usuario || null,
        dt_nascimento_usuario: s.dt_nascimento_usuario || null,
        telefone: s.telefone || s.nu_telefone || s.telefone_usuario || null,
        sexo_usuario: s.sexo_usuario || s.sg_sexo || null,
        municipio_paciente_residencia: s.municipio_paciente_residencia || s.no_municipio_residencia || null,
        codigo_unidade_solicitante: s.codigo_unidade_solicitante || s.co_unidade_solicitante || null,
        nome_unidade_solicitante: s.nome_unidade_solicitante || s.no_unidade_solicitante || null,
        nome_medico_solicitante: s.nome_medico_solicitante || s.no_profissional_solicitante || null,
        numero_crm: s.numero_crm || null,
        codigo_interno_procedimento: s.codigo_interno_procedimento || s.co_procedimento_interno || s.co_procedimento || null,
        codigo_sigtap_procedimento: s.codigo_sigtap_procedimento || s.codigo_sigtap || (s.procedimentos?.[0]?.codigo_sigtap) || null,
        codigo_cid: s.codigo_cid_solicitado || s.codigo_cid_agendado || s.co_cid || null,
        descricao_cid: s.descricao_cid_solicitado || s.descricao_cid_agendado || s.no_cid || null,
        descricao_interna_procedimento: s.descricao_interna_procedimento || s.no_procedimento || null,
        codigo_classificacao_risco: s.codigo_classificacao_risco || s.classificacao_risco || null,
        codigo_tipo_regulacao: s.codigo_tipo_regulacao || s.tipo_regulacao || null,
        status_solicitacao: s.status_solicitacao || s.no_situacao_solicitacao || null,
        nome_unidade_executante: s.nome_unidade_executante || null,
        logradouro_unidade_executante: s.logradouro_unidade_executante || null,
        telefone_unidade_executante: s.telefone_unidade_executante || null,
        justificativa_clinica: observacaoSolicitante || null,
        atualizado_em: new Date().toISOString()
      }
    }).filter((s: any) => s.codigo_solicitacao !== null)

    // Dedup por codigo_solicitacao (evita conflito de chaves duplicadas no mesmo lote no Postgres)
    const map = new Map<number, any>()
    todasSolicitacoes.forEach((s: any) => {
      const existing = map.get(s.codigo_solicitacao)
      if (!existing) {
        map.set(s.codigo_solicitacao, s)
      } else {
        // Mantém o registro com data de marcação ou solicitação mais recente
        const existingDate = existing.data_marcacao || existing.data_solicitacao || ''
        const currentDate = s.data_marcacao || s.data_solicitacao || ''
        if (currentDate > existingDate) {
          map.set(s.codigo_solicitacao, s)
        }
      }
    })
    const solicitacoesDeduplicadas = Array.from(map.values())

    if (solicitacoesDeduplicadas.length === 0) {
      return NextResponse.json({ ok: true, total: 0, mensagem: 'Nenhum registro encontrado para sincronizar.' })
    }

    // Inserção em lotes de 1000 no banco de dados local
    const batchSize = 1000
    for (let i = 0; i < solicitacoesDeduplicadas.length; i += batchSize) {
      const batch = solicitacoesDeduplicadas.slice(i, i + batchSize)
      let { error } = await supabase
        .from('monitoramento_sisreg')
        .upsert(batch, { onConflict: 'codigo_solicitacao' })

      if (error && error.message.includes('column')) {
        console.warn(`Lote ${i / batchSize + 1}: Falha ao salvar com novas colunas (migração pendente). Salvando apenas colunas padrão.`)
        // Fallback: remove colunas adicionais e salva apenas o padrão
        const standardBatch = batch.map(({ codigo_cid, descricao_cid, codigo_sigtap_procedimento, justificativa_clinica, numero_crm, ...rest }: any) => rest)
        const { error: fallbackErr } = await supabase
          .from('monitoramento_sisreg')
          .upsert(standardBatch, { onConflict: 'codigo_solicitacao' })
        error = fallbackErr
      }

      if (error) {
        console.error(`Erro ao inserir lote no Supabase:`, error.message)
        if (error.code === '42P01' || error.message.includes('relation "monitoramento_sisreg" does not exist')) {
          return NextResponse.json({ 
            ok: false, 
            error: 'Tabela monitoramento_sisreg não encontrada no banco. Por favor, execute a migração SQL no seu Supabase.' 
          }, { status: 404 })
        }
        throw error
      }
    }

    return NextResponse.json({ ok: true, total: solicitacoesDeduplicadas.length, mensagem: 'Sincronização com o SISREG realizada com sucesso.' })
  } catch (error: any) {
    console.error('[SISREG Sync POST] Erro geral:', error.message)
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  return POST(request)
}
