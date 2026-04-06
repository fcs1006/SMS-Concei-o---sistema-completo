import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
)

// GET /api/sigtap/buscar?q=consulta&competencia=202604&limit=20
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const q = searchParams.get('q')?.trim() || ''
    const competencia = searchParams.get('competencia')?.trim() || ''
    const limit = Math.min(parseInt(searchParams.get('limit') || '30'), 100)

    if (!q && !competencia) {
      return NextResponse.json({ ok: false, error: 'Informe um termo de busca ou competência.' }, { status: 400 })
    }

    // Busca a competência mais recente se não informada
    let comp = competencia
    if (!comp) {
      const { data: ultima } = await supabase
        .from('sigtap_procedimentos')
        .select('competencia')
        .order('competencia', { ascending: false })
        .limit(1)
        .maybeSingle()
      comp = ultima?.competencia || ''
    }

    let query = supabase
      .from('sigtap_procedimentos')
      .select('co_procedimento, no_procedimento, competencia, co_complexidade, co_sexo, vl_sh, vl_sa, vl_sp')
      .eq('competencia', comp)
      .limit(limit)

    if (q) {
      // Busca por código ou nome
      const soDigitos = q.replace(/\D/g, '')
      if (soDigitos.length >= 4) {
        query = query.ilike('co_procedimento', `%${soDigitos}%`)
      } else {
        query = query.ilike('no_procedimento', `%${q.toUpperCase()}%`)
      }
    }

    query = query.order('no_procedimento')

    const { data, error } = await query
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })

    return NextResponse.json({ ok: true, competencia: comp, resultados: data || [] })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 })
  }
}

// GET /api/sigtap/buscar/competencias → lista competências disponíveis
