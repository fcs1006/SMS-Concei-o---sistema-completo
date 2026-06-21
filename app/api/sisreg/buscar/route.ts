import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServer } from '@/lib/supabaseServer'

const DEFAULT_SISREG_URL = 'https://sisreg-es.saude.gov.br'
const INDEX_MARCACAO = 'marcacao-ambulatorial-to-conceicao-do-tocantins'
const INDEX_SOLICITACAO = 'solicitacao-ambulatorial-to-conceicao-do-tocantins'

async function buscarExterno(codigoNum: number): Promise<any | null> {
  const sisregUser = process.env.SISREG_USER
  const sisregPassword = process.env.SISREG_PASSWORD
  const url = process.env.SISREG_URL || DEFAULT_SISREG_URL

  if (!sisregUser || !sisregPassword) {
    console.warn('[SISREG Buscar Externo] Credenciais do SISREG não configuradas no servidor para consulta em tempo real.')
    return null
  }

  const auth = Buffer.from(`${sisregUser}:${sisregPassword}`).toString('base64')
  
  // Lista de índices para verificar em ordem
  const indices = [INDEX_MARCACAO, INDEX_SOLICITACAO]

  for (const index of indices) {
    try {
      console.log(`[SISREG Buscar Externo] Consultando índice ${index} para solicitação: ${codigoNum}`)
      const response = await fetch(`${url.replace(/\/$/, '')}/${index}/_search`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Basic ${auth}`,
        },
        body: JSON.stringify({
          query: {
            bool: {
              should: [
                { term: { codigo_solicitacao: codigoNum } },
                { term: { co_solicitacao: codigoNum } }
              ]
            }
          },
          size: 1
        }),
      })

      if (response.ok) {
        const data = await response.json()
        const hits = data.hits?.hits || []
        if (hits.length > 0) {
          const s = hits[0]._source || {}
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
            codigo_solicitacao: s.codigo_solicitacao || s.co_solicitacao || codigoNum,
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
            uf_paciente_residencia: s.uf_paciente_residencia || s.sigla_uf_paciente_residencia || s.sg_uf_paciente_residencia || null,
            cep_paciente_residencia: s.cep_paciente_residencia || s.cep_paciente || s.nu_cep || null,
            endereco_paciente_residencia: s.logradouro_paciente_residencia || s.endereco_paciente_residencia || null,
            bairro_paciente_residencia: s.bairro_paciente_residencia || null,
            numero_paciente_residencia: s.numero_paciente_residencia || null,
            raca_usuario: s.raca_usuario || s.no_raca || s.cor_usuario || null,
            codigo_unidade_solicitante: s.codigo_unidade_solicitante || s.co_unidade_solicitante || null,
            nome_unidade_solicitante: s.nome_unidade_solicitante || s.no_unidade_solicitante || null,
            nome_medico_solicitante: s.nome_medico_solicitante || s.no_profissional_solicitante || null,
            numero_crm: s.numero_crm || null,
            cpf_profissional_solicitante: s.cpf_profissional_solicitante || null,
            sigla_uf_solicitante: s.sigla_uf_solicitante || null,
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
        }
      } else {
        const errText = await response.text()
        console.error(`[SISREG Buscar Externo] Erro na API externa do SISREG no índice ${index}:`, response.status, errText)
      }
    } catch (e: any) {
      console.error(`[SISREG Buscar Externo] Exceção ao buscar no índice ${index}:`, e.message)
    }
  }

  return null
}

const MUNICIPALES_IBGE: Record<string, string> = {
  'CONCEICAO DO TOCANTINS': '1705607',
  'PALMAS': '1721000',
  'PORTO NACIONAL': '1718204',
  'DIANOPOLIS': '1707001',
  'ARRAIAS': '1702406',
  'PARANA': '1716109',
  'TAGUATINGA': '1720903',
  'NATIVIDADE': '1714302',
  'ALMAS': '1700402',
  'PONTE ALTA DO BOM JESUS': '1718006',
  'AURORA DO TOCANTINS': '1702901',
  'GURUPI': '1709502'
}

function obterIbgeMunicipio(nome: string): string | null {
  if (!nome) return null
  
  // Normaliza e limpa sufixos de estado (ex: - TO, /TO, etc.)
  let norm = nome.toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
  norm = norm.replace(/\s*[-/]\s*[A-Z]{2}$/, '').trim()
  norm = norm.replace(/\s+[A-Z]{2}$/, '').trim()

  return MUNICIPALES_IBGE[norm] || null
}

async function buscarIbgeExterno(nomeMunicipio: string): Promise<string | null> {
  try {
    let norm = nomeMunicipio.toUpperCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
    norm = norm.replace(/\s*[-/]\s*[A-Z]{2}$/, '').trim()
    norm = norm.replace(/\s+[A-Z]{2}$/, '').trim()
    
    if (!norm) return null

    // Busca na API pública do IBGE para obter o ID de 7 dígitos do município
    const res = await fetch('https://servicodados.ibge.gov.br/api/v1/localidades/municipios')
    if (res.ok) {
      const list = await res.json()
      const found = list.find((m: any) => {
        const mNorm = m.nome.toUpperCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .trim()
        return mNorm === norm
      })
      if (found) {
        return String(found.id)
      }
    }
  } catch (e: any) {
    console.error('[SISREG Buscar GET] Erro ao consultar IBGE externo:', e.message)
  }
  return null
}

export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabaseServer()
    const { searchParams } = new URL(request.url)
    const codigo = searchParams.get('codigo')

    if (!codigo) {
      return NextResponse.json({ ok: false, error: 'Parâmetro codigo é obrigatório.' }, { status: 400 })
    }

    const codigoNum = Number(codigo)
    if (isNaN(codigoNum)) {
      return NextResponse.json({ ok: false, error: 'O código fornecido deve ser numérico.' }, { status: 400 })
    }

    // 1. Tenta buscar no banco de dados local primeiro (como cache)
    const { data: solicitacaoLocal, error } = await supabase
      .from('monitoramento_sisreg')
      .select('*')
      .eq('codigo_solicitacao', codigoNum)
      .maybeSingle()

    if (error) {
      console.error('[SISREG Buscar GET] Erro ao pesquisar no banco local:', error.message)
    }

    let resultData: any = null

    // 2. Sempre tenta buscar em tempo real na API externa do SISREG (para ter dados completos e atualizados como CID e SIGTAP)
    console.log(`[SISREG Buscar GET] Consultando API externa para a solicitação ${codigoNum}...`)
    const solicitacaoExterna = await buscarExterno(codigoNum)

    if (solicitacaoExterna) {
      // Separa os campos que não vão pro banco de dados
      const { 
        cpf_profissional_solicitante, 
        sigla_uf_solicitante, 
        uf_paciente_residencia,
        cep_paciente_residencia,
        endereco_paciente_residencia,
        bairro_paciente_residencia,
        numero_paciente_residencia,
        raca_usuario,
        ...dadosParaSalvar 
      } = solicitacaoExterna

      // Salva no banco local para consultas futuras rápidas
      let { error: insertErr } = await supabase
        .from('monitoramento_sisreg')
        .upsert(dadosParaSalvar, { onConflict: 'codigo_solicitacao' })

      if (insertErr && insertErr.message.includes('column')) {
        console.warn('[SISREG Buscar GET] Falha ao salvar com novas colunas (migração pendente). Salvando apenas colunas padrão.')
        // Fallback: remove colunas adicionais e salva apenas o padrão
        const { codigo_cid, descricao_cid, codigo_sigtap_procedimento, justificativa_clinica, numero_crm, ...standardFields } = dadosParaSalvar
        const { error: fallbackErr } = await supabase
          .from('monitoramento_sisreg')
          .upsert(standardFields, { onConflict: 'codigo_solicitacao' })
        insertErr = fallbackErr
      }

      if (insertErr) {
        console.error('[SISREG Buscar GET] Erro ao salvar solicitação importada no banco local:', insertErr.message)
      }

      resultData = solicitacaoExterna
    } else if (solicitacaoLocal) {
      // Se a busca externa falhar, usamos o cache local
      console.log(`[SISREG Buscar GET] Busca externa falhou ou não retornou dados. Usando dados locais para ${codigoNum}.`)
      resultData = solicitacaoLocal
    }

    if (resultData) {
      // 3. Cruzamento de dados com a tabela de pacientes para Endereço, Bairro e CEP
      const cpfLimpo = resultData.cpf_usuario ? resultData.cpf_usuario.replace(/\D/g, '') : ''
      const cnsLimpo = resultData.cns_usuario ? resultData.cns_usuario.replace(/\D/g, '') : ''
      
      let endereco = ''
      let cep = ''
      
      if (cpfLimpo || cnsLimpo) {
        const queryDocs = []
        if (cpfLimpo) queryDocs.push(cpfLimpo)
        if (cnsLimpo) queryDocs.push(cnsLimpo)
        
        const { data: pacData } = await supabase
          .from('pacientes')
          .select('endereco, bairro, cep')
          .in('cpf_cns', queryDocs)
          .limit(1)
          .maybeSingle()
          
        if (pacData) {
          const partesEndereco = [pacData.endereco, pacData.bairro].filter(Boolean)
          endereco = partesEndereco.join(', ')
          cep = pacData.cep ? pacData.cep.replace(/\D/g, '') : ''
        }
      }

      if (!endereco && resultData.endereco_paciente_residencia) {
        const partes = [resultData.endereco_paciente_residencia, resultData.numero_paciente_residencia, resultData.bairro_paciente_residencia].filter(Boolean)
        endereco = partes.join(', ')
      }
      if (!cep && resultData.cep_paciente_residencia) {
        cep = resultData.cep_paciente_residencia.replace(/\D/g, '')
      }
      
      // 3.5. Resolução do Conselho / CRM / Registro do profissional
      let crmResolvido = resultData.numero_crm
      const nomeMedico = resultData.nome_medico_solicitante
      
      const crmLimpo = crmResolvido ? String(crmResolvido).trim() : ''
      const isApenasNumerico = crmLimpo && /^\d+$/.test(crmLimpo)
      
      if (!crmLimpo || crmLimpo.toUpperCase() === 'NULL' || isApenasNumerico) {
        let encontrouLocal = false
        if (nomeMedico) {
          const nomeNorm = nomeMedico.toUpperCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .trim()
            
          if (nomeNorm) {
            // Busca na tabela especialidades_profissionais
            const { data: profs } = await supabase
              .from('especialidades_profissionais')
              .select('conselho_tipo, conselho_numero, nome')
              .eq('ativo', true)
              
            if (profs && profs.length > 0) {
              const match = profs.find((p: any) => {
                const pNomeNorm = p.nome.toUpperCase()
                  .normalize('NFD')
                  .replace(/[\u0300-\u036f]/g, '')
                  .trim()
                return pNomeNorm.includes(nomeNorm) || nomeNorm.includes(pNomeNorm)
              })
              
              if (match && match.conselho_numero) {
                const tipo = match.conselho_tipo || 'CRM'
                crmResolvido = `${tipo} ${match.conselho_numero}`
                encontrouLocal = true
              }
            }
          }
        }
        
        // Se não encontrou no banco local, mas temos um número de CRM original do SISREG
        if (!encontrouLocal && crmLimpo && crmLimpo.toUpperCase() !== 'NULL') {
          const uf = resultData.sigla_uf_solicitante || 'TO'
          crmResolvido = `CRM-${uf} ${crmLimpo}`
        }
      } else {
        // Se já tem letras, mas é apenas o número ex: "5903", formatamos como "CRM-TO 5903"
        if (/^\d+$/.test(crmLimpo)) {
          const uf = resultData.sigla_uf_solicitante || 'TO'
          crmResolvido = `CRM-${uf} ${crmLimpo}`
        }
      }
      
      if (crmResolvido && crmResolvido.toUpperCase() === 'NULL') {
        crmResolvido = null
      }

      // 4. Resolução do código IBGE do município de residência do paciente
      let ibgeCode = obterIbgeMunicipio(resultData.municipio_paciente_residencia)
      if (!ibgeCode && resultData.municipio_paciente_residencia) {
        ibgeCode = await buscarIbgeExterno(resultData.municipio_paciente_residencia)
      }
      
      // Se não encontrou de forma alguma, deixa como default de Conceição do Tocantins (1705607)
      if (!ibgeCode && (!resultData.municipio_paciente_residencia || resultData.municipio_paciente_residencia.toUpperCase().includes('CONCEICAO'))) {
        ibgeCode = '1705607'
      }

      return NextResponse.json({ 
        ok: true, 
        data: {
          ...resultData,
          numero_crm: crmResolvido || null,
          cpf_profissional_solicitante: resultData.cpf_profissional_solicitante || null,
          endereco_paciente: endereco || null,
          cep_paciente: cep || null,
          codigo_ibge_paciente: ibgeCode || null,
          uf_paciente: resultData.uf_paciente_residencia || null,
          raca_usuario: resultData.raca_usuario || null
        } 
      })
    }

    return NextResponse.json({ ok: false, error: 'Solicitação não encontrada no banco local nem no sistema SISREG.' }, { status: 404 })
  } catch (error: any) {
    console.error('[SISREG Buscar GET] Erro geral:', error.message)
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }
}
