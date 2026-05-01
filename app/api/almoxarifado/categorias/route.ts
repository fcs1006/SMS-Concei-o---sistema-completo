import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
)

export async function GET() {
  const { data, error } = await supabase
    .from('categorias_estoque')
    .select('*')
    .order('nome')
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, data })
}

export async function POST(request: NextRequest) {
  const body = await request.json()
  const { nome, cor } = body
  if (!nome?.trim()) return NextResponse.json({ ok: false, error: 'Nome obrigatório' }, { status: 400 })

  const { data, error } = await supabase
    .from('categorias_estoque')
    .insert({ nome: nome.trim(), cor: cor || '#6366f1' })
    .select()
    .single()
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, data })
}

export async function PUT(request: NextRequest) {
  const body = await request.json()
  const { id, nome, cor } = body
  if (!id) return NextResponse.json({ ok: false, error: 'ID obrigatório' }, { status: 400 })

  const { data, error } = await supabase
    .from('categorias_estoque')
    .update({ nome: nome.trim(), cor })
    .eq('id', id)
    .select()
    .single()
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, data })
}

export async function DELETE(request: NextRequest) {
  const { id } = await request.json()
  if (!id) return NextResponse.json({ ok: false, error: 'ID obrigatório' }, { status: 400 })

  const { error } = await supabase.from('categorias_estoque').delete().eq('id', id)
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
