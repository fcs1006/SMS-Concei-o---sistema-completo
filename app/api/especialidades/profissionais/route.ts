import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
)

// GET /api/especialidades/profissionais?especialidade=ortopedia
export async function GET(request: NextRequest) {
  try {
    const esp = new URL(request.url).searchParams.get('especialidade')
    let query = supabase
      .from('especialidades_profissionais')
      .select('*')
      .eq('ativo', true)
      .order('nome')
    if (esp) query = query.eq('especialidade', esp)
    const { data, error } = await query
    if (error) throw error
    return NextResponse.json({ ok: true, data: data || [] })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 })
  }
}

// POST /api/especialidades/profissionais
// Body: { especialidade, nome, conselho_tipo, conselho_numero }
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { especialidade, nome, conselho_tipo, conselho_numero } = body
    if (!especialidade || !nome) {
      return NextResponse.json({ ok: false, error: 'Especialidade e nome obrigatórios' }, { status: 400 })
    }
    const { data, error } = await supabase
      .from('especialidades_profissionais')
      .insert([{ especialidade, nome: nome.toUpperCase().trim(), conselho_tipo: conselho_tipo || 'CRM', conselho_numero: conselho_numero || null }])
      .select().single()
    if (error) throw error
    return NextResponse.json({ ok: true, data })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 })
  }
}

// DELETE /api/especialidades/profissionais?id=uuid
export async function DELETE(request: NextRequest) {
  try {
    const id = new URL(request.url).searchParams.get('id')
    if (!id) return NextResponse.json({ ok: false, error: 'ID não informado' }, { status: 400 })
    const { error } = await supabase
      .from('especialidades_profissionais')
      .delete()
      .eq('id', id)
    if (error) throw error
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 })
  }
}
