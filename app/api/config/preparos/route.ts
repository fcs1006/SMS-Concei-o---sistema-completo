import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
)

// GET /api/config/preparos?especialidade=usg — lista preparos
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const esp = searchParams.get('especialidade')
  let query = supabase.from('preparos_exame').select('*').order('tipo_exame')
  if (esp) query = query.eq('especialidade_slug', esp)
  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// POST /api/config/preparos — cadastra ou substitui preparo
export async function POST(req: NextRequest) {
  const body = await req.json()
  const { especialidade_slug, tipo_exame, instrucoes } = body
  if (!especialidade_slug || !tipo_exame || !instrucoes)
    return NextResponse.json({ error: 'especialidade_slug, tipo_exame e instrucoes são obrigatórios' }, { status: 400 })
  const { data, error } = await supabase
    .from('preparos_exame')
    .upsert({ especialidade_slug, tipo_exame: tipo_exame.trim().toUpperCase(), instrucoes: instrucoes.trim() },
             { onConflict: 'especialidade_slug,tipo_exame' })
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// DELETE /api/config/preparos?id=uuid — remove preparo
export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id obrigatório' }, { status: 400 })
  const { error } = await supabase.from('preparos_exame').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
