import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

// Carrega as variáveis de ambiente
dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const DEFAULT_SISREG_URL = 'https://sisreg-es.saude.gov.br'
const DEFAULT_SISREG_INDEX = 'marcacao-ambulatorial-to-conceicao-do-tocantins'

async function syncSisreg() {
  console.log('Iniciando sincronização com SISREG...')
  const sanitize = (val: string | undefined, prefix: string): string => {
    if (!val) return ''
    let clean = val.trim()
    if (clean.startsWith(`${prefix}=`)) {
      clean = clean.substring(prefix.length + 1).trim()
    }
    if ((clean.startsWith('"') && clean.endsWith('"')) || (clean.startsWith("'") && clean.endsWith("'"))) {
      clean = clean.substring(1, clean.length - 1).trim()
    }
    return clean
  }

  const user = sanitize(process.env.SISREG_USER, 'SISREG_USER')
  const password = sanitize(process.env.SISREG_PASSWORD, 'SISREG_PASSWORD')
  let url = process.env.SISREG_URL || DEFAULT_SISREG_URL
  const index = process.env.SISREG_INDEX || DEFAULT_SISREG_INDEX

  url = url.replace(/\/$/, '')
  const indicesToRemove = [
    'solicitacao-ambulatorial-to-conceicao-do-tocantins',
    'marcacao-ambulatorial-to-conceicao-do-tocantins'
  ]
  for (const idxName of indicesToRemove) {
    if (url.endsWith(idxName)) {
      url = url.slice(0, -idxName.length).replace(/\/$/, '')
    }
  }

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
    }).filter((s: any) => s.codigo_solicitacao !== null) // Garantir que tem ID

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
      console.log('Nenhum dado válido para sincronizar.')
      process.exit(0)
    }

    console.log(`Iniciando envio para o Supabase (tabela: monitoramento_sisreg) - ${solicitacoesDeduplicadas.length} registros pós-deduplicados...`)
    
    // Inserção em lotes de 1000 para não estourar payload
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
        console.error(`Erro ao inserir lote ${i / batchSize + 1}:`, error.message)
      } else {
        console.log(`Lote ${i / batchSize + 1} (registros ${i + 1} a ${Math.min(i + batchSize, solicitacoesDeduplicadas.length)}) sincronizado com sucesso.`)
      }
    }

    console.log('✅ Sincronização finalizada com sucesso!')

    // Disparar a varredura de novas autorizações imediatamente após a sincronização
    try {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
      const cronSecret = process.env.CRON_SECRET || 'sms-conceicao-cron-secret-12345'
      console.log(`Disparando varredura de autorizações em: ${appUrl}/api/whatsapp/lembretes?tipo=autorizacoes...`)
      
      const resp = await fetch(`${appUrl.replace(/\/$/, '')}/api/whatsapp/lembretes?tipo=autorizacoes`, {
        headers: {
          Authorization: `Bearer ${cronSecret}`
        }
      })
      
      if (resp.ok) {
        console.log('✅ Varredura de autorizações disparada com sucesso.')
      } else {
        const errTxt = await resp.text()
        console.warn(`⚠️ Varredura de autorizações retornou status ${resp.status}: ${errTxt}`)
      }
    } catch (e: any) {
      console.warn('⚠️ Não foi possível disparar a varredura de autorizações automaticamente:', e.message)
    }

    process.exit(0)
  } catch (err: any) {
    console.error('Erro geral durante a sincronização:', err.message)
    process.exit(1)
  }
}

syncSisreg()
