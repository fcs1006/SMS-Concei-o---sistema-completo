import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
)

// GET /api/config/especialidades — lista todas (ativas e inativas)
export async function GET() {
  const { data, error } = await supabase
    .from('especialidades_config')
    .select('*')
    .order('label')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// POST /api/config/especialidades — cadastra nova especialidade
export async function POST(req: NextRequest) {
  const body = await req.json()
  const { slug, label, icon, cota } = body
  if (!slug || !label) return NextResponse.json({ error: 'slug e label são obrigatórios' }, { status: 400 })
  const slugNorm = slug.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')
  const { data, error } = await supabase
    .from('especialidades_config')
    .insert({ slug: slugNorm, label: label.trim(), icon: icon || '🏥', cota: Number(cota) || 30 })
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// PATCH /api/config/especialidades — atualiza (label, icon, cota, ativo)
export async function PATCH(req: NextRequest) {
  const body = await req.json()
  const { slug, ...campos } = body
  if (!slug) return NextResponse.json({ error: 'slug obrigatório' }, { status: 400 })
  const { data, error } = await supabase
    .from('especialidades_config')
    .update(campos)
    .eq('slug', slug)
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
