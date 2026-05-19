import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

// Carrega as variáveis de ambiente
dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const DEFAULT_SISREG_URL = 'https://sisreg-es.saude.gov.br'
const DEFAULT_SISREG_INDEX = 'solicitacao-ambulatorial-to-conceicao-do-tocantins'

async function syncSisreg() {
  console.log('Iniciando sincronização com SISREG...')
  const user = process.env.SISREG_USER
  const password = process.env.SISREG_PASSWORD
  const url = process.env.SISREG_URL || DEFAULT_SISREG_URL
  const index = process.env.SISREG_INDEX || DEFAULT_SISREG_INDEX

  if (!user || !password) {
    console.error('ERRO: Configure SISREG_USER e SISREG_PASSWORD no .env.local.')
    process.exit(1)
  }

  const auth = Buffer.from(`${user}:${password}`).toString('base64')
  
  // Fazer paginação com a API do ElasticSearch (scroll ou pagination simples se < 10000)
  // Vamos buscar até 10000 registros para garantir que traz a fila completa do município.
  let todasSolicitacoes: any[] = []
  
  try {
    console.log(`Buscando dados no ElasticSearch (${url}/${index})...`)
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
      console.error(`Erro na requisição SISREG: Status ${response.status}`)
      console.error(await response.text())
      process.exit(1)
    }

    const data = await response.json()
    const hits = data.hits?.hits || []
    
    console.log(`Encontrados ${hits.length} registros no SISREG.`)

    // Mapear os campos para o formato do banco de dados local
    todasSolicitacoes = hits.map((hit: any) => {
      const s = hit._source || {}
      
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
        codigo_interno_procedimento: s.procedimentos?.[0]?.codigo_sigtap || s.codigo_interno_procedimento || s.co_procedimento || null,
        descricao_interna_procedimento: s.procedimentos?.[0]?.descricao_interna?.trim() || s.procedimentos?.[0]?.descricao_sigtap?.trim() || s.descricao_interna_procedimento || s.no_procedimento || null,
        codigo_classificacao_risco: s.codigo_classificacao_risco || s.classificacao_risco || null,
        codigo_tipo_regulacao: s.codigo_tipo_regulacao || s.tipo_regulacao || null,
        status_solicitacao: s.status_solicitacao || s.no_situacao_solicitacao || null,
        atualizado_em: new Date().toISOString()
      }
    }).filter((s: any) => s.codigo_solicitacao !== null) // Garantir que tem ID

    if (todasSolicitacoes.length === 0) {
      console.log('Nenhum dado válido para sincronizar.')
      process.exit(0)
    }

    console.log('Iniciando envio para o Supabase (tabela: monitoramento_sisreg)...')
    
    // Inserção em lotes de 1000 para não estourar payload
    const batchSize = 1000
    for (let i = 0; i < todasSolicitacoes.length; i += batchSize) {
      const batch = todasSolicitacoes.slice(i, i + batchSize)
      const { error } = await supabase
        .from('monitoramento_sisreg')
        .upsert(batch, { onConflict: 'codigo_solicitacao' })
      
      if (error) {
        console.error(`Erro ao inserir lote ${i / batchSize + 1}:`, error.message)
      } else {
        console.log(`Lote ${i / batchSize + 1} (registros ${i + 1} a ${Math.min(i + batchSize, todasSolicitacoes.length)}) sincronizado com sucesso.`)
      }
    }

    console.log('✅ Sincronização finalizada com sucesso!')
    process.exit(0)
  } catch (err: any) {
    console.error('Erro geral durante a sincronização:', err.message)
    process.exit(1)
  }
}

syncSisreg()
