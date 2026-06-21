import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServer } from '@/lib/supabaseServer'

// GET /api/cnes/profissionais?cnes=5193273
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const cnes = searchParams.get('cnes')?.trim()

    if (!cnes) {
      return NextResponse.json({ ok: false, error: 'CNES é obrigatório.' }, { status: 400 })
    }

    const supabase = getSupabaseServer()
    const uniqueDocsMap = new Map<string, any>()

    // 1. Carrega profissionais da tabela local especialidades_profissionais para batimento de nomes (obter CRM)
    const especialidadesMap = new Map<string, any>()
    const { data: profsDB } = await supabase
      .from('especialidades_profissionais')
      .select('nome, conselho_tipo, conselho_numero')
      .eq('ativo', true)

    if (profsDB) {
      profsDB.forEach((p: any) => {
        const pNomeNorm = String(p.nome || '').trim().toUpperCase()
          .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        especialidadesMap.set(pNomeNorm, p)
      })
    }

    // 2. Tenta buscar no SCNES oficial (https://cnes.datasus.gov.br) em tempo real
    let resolvedCoUnidade = ''
    let SCNESProfessionals: any[] = []

    try {
      console.log(`[CNES Profissionais API] Buscando no SCNES para o CNES: ${cnes}`)
      const searchUrl = `https://cnes.datasus.gov.br/services/estabelecimentos?cnes=${cnes}`
      const searchRes = await fetch(searchUrl, {
        headers: {
          'Accept': 'application/json, text/plain, */*',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Referer': 'https://cnes.datasus.gov.br/pages/estabelecimentos/',
          'Origin': 'https://cnes.datasus.gov.br'
        }
      })

      if (searchRes.ok) {
        const ests = await searchRes.json()
        if (ests && ests.length > 0) {
          resolvedCoUnidade = ests[0].coUnidade || ests[0].id
          console.log(`[CNES Profissionais API] CNES resolvido para coUnidade: ${resolvedCoUnidade}`)
        }
      }

      if (resolvedCoUnidade) {
        const profsUrl = `https://cnes.datasus.gov.br/services/estabelecimentos-profissionais/${resolvedCoUnidade}`
        const profsRes = await fetch(profsUrl, {
          headers: {
            'Accept': 'application/json, text/plain, */*',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Referer': `https://cnes.datasus.gov.br/pages/estabelecimentos/ficha/index.jsp?coUnidade=${resolvedCoUnidade}`,
            'Origin': 'https://cnes.datasus.gov.br'
          }
        })
        if (profsRes.ok) {
          SCNESProfessionals = await profsRes.json()
          console.log(`[CNES Profissionais API] Encontrados ${SCNESProfessionals.length} profissionais no SCNES.`)
        }
      }
    } catch (e: any) {
      console.warn('[CNES Profissionais API] Erro ao consultar portal SCNES, usando fallback local:', e.message)
    }

    // 3. Processa profissionais obtidos do SCNES
    if (SCNESProfessionals && SCNESProfessionals.length > 0) {
      SCNESProfessionals.forEach((p: any) => {
        const nome = String(p.nome || '').trim().toUpperCase()
        if (!nome) return

        let cns = String(p.cns || '').trim()
        let crm = ''

        // Tenta encontrar o CRM do médico batendo o nome com a tabela geral
        const nomeNorm = nome.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        let match = especialidadesMap.get(nomeNorm)
        if (!match) {
          // Correspondência parcial
          for (const [key, value] of especialidadesMap.entries()) {
            if (nomeNorm.includes(key) || key.includes(nomeNorm)) {
              match = value
              break
            }
          }
        }

        if (match && match.conselho_numero) {
          const tipo = match.conselho_tipo || 'CRM'
          crm = `${tipo} ${match.conselho_numero}`
        }

        // Limpa CNS indefinido
        cns = (cns && cns.toLowerCase() !== 'undefined' && cns.toLowerCase() !== 'null') ? cns : ''

        const key = `${nome}_${crm}`
        if (!uniqueDocsMap.has(key)) {
          uniqueDocsMap.set(key, {
            nome,
            crm,
            cpf: '',
            cns
          })
        }
      })
    }

    // 4. Se a busca no SCNES falhou ou retornou vazia, faz o fallback para a base de dados local
    if (uniqueDocsMap.size === 0) {
      console.log(`[CNES Profissionais API] Sem resultados do SCNES. Buscando fallback local para CNES: ${cnes}`)
      let localData: any[] | null = null
      let queryError: any = null

      try {
        const response = await supabase
          .from('monitoramento_sisreg')
          .select('nome_medico_solicitante, numero_crm, cpf_profissional_solicitante')
          .eq('codigo_unidade_solicitante', cnes)
          .not('nome_medico_solicitante', 'is', null)

        if (response.error) {
          queryError = response.error
        } else {
          localData = response.data
        }
      } catch (e: any) {
        queryError = e
      }

      if (queryError) {
        console.warn(`[CNES Profissionais API] Fallback local colunas estendidas falhou: ${queryError.message}`)
        const fallbackResponse = await supabase
          .from('monitoramento_sisreg')
          .select('nome_medico_solicitante')
          .eq('codigo_unidade_solicitante', cnes)
          .not('nome_medico_solicitante', 'is', null)

        if (!fallbackResponse.error) {
          localData = fallbackResponse.data
        }
      }

      localData?.forEach((row: any) => {
        const nome = String(row.nome_medico_solicitante || '').trim().toUpperCase()
        if (!nome) return

        let crm = String(row.numero_crm || '').trim()
        let cpf = String(row.cpf_profissional_solicitante || '').trim()

        if (!crm || crm.toUpperCase() === 'NULL' || crm === 'undefined') {
          const nomeNorm = nome.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
          let match = especialidadesMap.get(nomeNorm)
          if (!match) {
            for (const [key, value] of especialidadesMap.entries()) {
              if (nomeNorm.includes(key) || key.includes(nomeNorm)) {
                match = value
                break
              }
            }
          }
          if (match && match.conselho_numero) {
            const tipo = match.conselho_tipo || 'CRM'
            crm = `${tipo} ${match.conselho_numero}`
          }
        }

        crm = (crm && crm.toLowerCase() !== 'undefined' && crm.toLowerCase() !== 'null') ? crm : ''
        cpf = (cpf && cpf.toLowerCase() !== 'undefined' && cpf.toLowerCase() !== 'null') ? cpf : ''

        const key = `${nome}_${crm}`
        if (!uniqueDocsMap.has(key)) {
          uniqueDocsMap.set(key, {
            nome,
            crm,
            cpf,
            cns: ''
          })
        }
      })
    }

    const profissionais = Array.from(uniqueDocsMap.values())
    profissionais.sort((a, b) => a.nome.localeCompare(b.nome))

    return NextResponse.json({ ok: true, resultados: profissionais })
  } catch (error: any) {
    console.error('[CNES Profissionais API] Erro fatal:', error)
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }
}

