import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
)

// GET /api/config/periodos
export async function GET() {
  try {
    const { data, error } = await supabase
      .from('especialidades_periodos')
      .select('*')
      .order('created_at', { ascending: true })
    if (error) throw error
    return NextResponse.json({ ok: true, data: data || [] })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 })
  }
}

// POST /api/config/periodos
export async function POST(request: NextRequest) {
  try {
    const { nome, horario } = await request.json()
    if (!nome?.trim()) return NextResponse.json({ ok: false, error: 'Nome obrigatório' }, { status: 400 })
    const { data, error } = await supabase
      .from('especialidades_periodos')
      .insert([{ nome: nome.trim(), horario: horario?.trim() || null }])
      .select().single()
    if (error) throw error
    return NextResponse.json({ ok: true, data })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 })
  }
}

// PATCH /api/config/periodos  — toggle ativo
export async function PATCH(request: NextRequest) {
  try {
    const { id, ativo } = await request.json()
    if (!id) return NextResponse.json({ ok: false, error: 'ID obrigatório' }, { status: 400 })
    const { data, error } = await supabase
      .from('especialidades_periodos')
      .update({ ativo })
      .eq('id', id)
      .select().single()
    if (error) throw error
    return NextResponse.json({ ok: true, data })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 })
  }
}

// DELETE /api/config/periodos?id=uuid
export async function DELETE(request: NextRequest) {
  try {
    const id = new URL(request.url).searchParams.get('id')
    if (!id) return NextResponse.json({ ok: false, error: 'ID não informado' }, { status: 400 })
    const { error } = await supabase.from('especialidades_periodos').delete().eq('id', id)
    if (error) throw error
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 })
  }
}
