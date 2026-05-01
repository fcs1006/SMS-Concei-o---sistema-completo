import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
)

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    
    const perfil = searchParams.get('perfil') || 'laboratorio'
    const competencia = searchParams.get('competencia') || ''
    const pesquisa = searchParams.get('pesquisa') || '' // Pode ser nome, CPF ou procedimento
    
    let query = supabase
      .from('historico_bpa')
      .select('*')
      .eq('perfil', perfil)

    if (competencia) {
      query = query.eq('competencia', competencia)
    }

    if (pesquisa) {
      // Se for apenas números, pode ser CPF ou código do procedimento
      const isNum = /^\d+$/.test(pesquisa.replace(/\D/g, ''))
      if (isNum && pesquisa.length <= 10) {
        // Provavelmente um procedimento
         query = query.or(`procedimento.ilike.%${pesquisa}%,nome_paciente.ilike.%${pesquisa}%,cpf_cns.ilike.%${pesquisa}%`)
      } else {
         query = query.or(`nome_paciente.ilike.%${pesquisa}%,cpf_cns.ilike.%${pesquisa.replace(/\D/g, '')}%,procedimento.ilike.%${pesquisa}%`)
      }
    }

    query = query.order('data_atendimento', { ascending: false }).limit(500)

    const { data, error } = await query

    if (error) throw new Error(error.message)

    return NextResponse.json({ ok: true, data })

  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }
}
