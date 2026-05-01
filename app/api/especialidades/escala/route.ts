import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
)

// GET /api/especialidades/escala?especialidade=ortopedia&mes=04&ano=2026
export async function GET(request: NextRequest) {
  try {
    const p = new URL(request.url).searchParams
    const esp = p.get('especialidade')
    const mes = p.get('mes')
    const ano = p.get('ano')
    let query = supabase.from('especialidades_escala').select('*').order('data_atendimento', { ascending: true }).order('profissional_nome')
    if (esp) query = query.eq('especialidade', esp)
    if (mes && ano) {
      // Filtra pela data_atendimento no mês/ano selecionado
      const dataInicio = `${ano}-${mes}-01`
      const proximoMes = Number(mes) === 12 ? '01' : String(Number(mes) + 1).padStart(2, '0')
      const anoProximo = Number(mes) === 12 ? String(Number(ano) + 1) : ano
      const dataFim = `${anoProximo}-${proximoMes}-01`
      query = query.gte('data_atendimento', dataInicio).lt('data_atendimento', dataFim)
    }
    const { data, error } = await query
    if (error) throw error
    return NextResponse.json({ ok: true, data: data || [] })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 })
  }
}

// POST /api/especialidades/escala
// Body: { especialidade, profissional_id, profissional_nome, mes, ano, data_atendimento }
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { especialidade, profissional_id, profissional_nome, mes, ano, data_atendimento, periodo } = body
    if (!especialidade || !profissional_id || !mes || !ano || !data_atendimento) {
      return NextResponse.json({ ok: false, error: 'Campos obrigatórios ausentes (incluindo data de atendimento)' }, { status: 400 })
    }
    const { data, error } = await supabase
      .from('especialidades_escala')
      .insert([{ especialidade, profissional_id, profissional_nome, mes, ano, data_atendimento, periodo: periodo || null }])
      .select().single()
    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ ok: false, error: 'Profissional já está escalado nesta data neste período' }, { status: 409 })
      }
      throw error
    }
    return NextResponse.json({ ok: true, data })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 })
  }
}

// DELETE /api/especialidades/escala?id=uuid
export async function DELETE(request: NextRequest) {
  try {
    const id = new URL(request.url).searchParams.get('id')
    if (!id) return NextResponse.json({ ok: false, error: 'ID não informado' }, { status: 400 })
    const { error } = await supabase.from('especialidades_escala').delete().eq('id', id)
    if (error) throw error
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 })
  }
}
