import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServer } from '@/lib/supabaseServer'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const ibge = searchParams.get('ibge')?.trim()

    if (!ibge) {
      return NextResponse.json({ ok: false, error: 'Código IBGE é obrigatório.' }, { status: 400 })
    }

    const codigoNum = Number(ibge)
    if (isNaN(codigoNum)) {
      return NextResponse.json({ ok: false, error: 'O código IBGE deve ser numérico.' }, { status: 400 })
    }

    // A API do DATASUS utiliza o código IBGE de 6 dígitos (sem o dígito verificador final)
    let ibgeFiltro = ibge
    if (ibgeFiltro.length === 7) {
      ibgeFiltro = ibgeFiltro.substring(0, 6)
    }

    let cnesList: Array<{ cnes: string; nome: string }> = []
    let externalSuccess = false

    // 1. Tentativa de buscar na API Pública do Ministério da Saúde
    try {
      console.log(`[CNES Buscar] Consultando API pública para o IBGE: ${ibgeFiltro}`)
      const res = await fetch(`https://apidadosabertos.saude.gov.br/cnes/estabelecimentos?codigo_municipio=${ibgeFiltro}&limit=100`, {
        headers: { 'Accept': 'application/json' },
        next: { revalidate: 86400 } // Cache por 1 dia
      })

      if (res.ok) {
        const payload = await res.json()
        
        // A API de Dados Abertos do DATASUS retorna a lista sob a chave "estabelecimentos"
        const items = payload.estabelecimentos || payload.resultados || payload.data || (Array.isArray(payload) ? payload : null)
        
        if (items && Array.isArray(items)) {
          cnesList = items.map((item: any) => ({
            cnes: String(item.codigo_cnes || item.cnes || item.co_cnes || '').trim(),
            nome: String(item.nome_fantasia || item.no_fantasia || item.nome || '').trim().toUpperCase()
          })).filter(item => item.cnes && item.nome)
          externalSuccess = true
          console.log(`[CNES Buscar] Sucesso na API externa. Encontrados: ${cnesList.length}`)
        }
      }
    } catch (e: any) {
      console.warn('[CNES Buscar] Erro ao consultar API pública do DATASUS (usando fallback local):', e.message)
    }

    // 2. Fallback / Mesclagem com os dados locais do SISREG
    try {
      const supabase = getSupabaseServer()
      // Buscamos os estabelecimentos que já estão cadastrados na tabela monitoramento_sisreg
      const { data: rows, error: localErr } = await supabase
        .from('monitoramento_sisreg')
        .select('codigo_unidade_solicitante, nome_unidade_solicitante')

      if (!localErr && rows) {
        const localMap = new Map<string, string>()
        rows.forEach((r: any) => {
          const cnes = String(r.codigo_unidade_solicitante || '').trim()
          const nome = String(r.nome_unidade_solicitante || '').trim().toUpperCase()
          if (cnes && nome) {
            localMap.set(cnes, nome)
          }
        })

        // Se a API externa falhou, usamos apenas a lista local
        if (!externalSuccess) {
          cnesList = Array.from(localMap.entries()).map(([cnes, nome]) => ({ cnes, nome }))
          console.log(`[CNES Buscar] Usando dados locais do SISREG como fallback. Encontrados: ${cnesList.length}`)
        } else {
          // Se a API externa funcionou, mesclamos para não perder nenhuma unidade local
          const existingCnes = new Set(cnesList.map(item => item.cnes))
          localMap.forEach((nome, cnes) => {
            if (!existingCnes.has(cnes)) {
              cnesList.push({ cnes, nome })
            }
          })
          console.log(`[CNES Buscar] Mesclagem concluída. Total final: ${cnesList.length}`)
        }
      }
    } catch (localErr: any) {
      console.error('[CNES Buscar] Erro ao processar fallback local:', localErr.message)
    }

    // Ordena por nome
    cnesList.sort((a, b) => a.nome.localeCompare(b.nome))

    return NextResponse.json({ ok: true, resultados: cnesList })
  } catch (error: any) {
    console.error('[CNES Buscar GET] Erro geral:', error.message)
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }
}
