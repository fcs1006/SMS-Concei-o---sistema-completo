import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
)

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const busca = searchParams.get('busca') || ''
  const categoria = searchParams.get('categoria') || ''
  const ativo = searchParams.get('ativo')
  const codigo = searchParams.get('codigo') || ''

  let query = supabase
    .from('produtos_estoque')
    .select('*, categorias_estoque(id, nome, cor)')
    .order('nome')

  if (busca) query = query.ilike('nome', `%${busca}%`)
  if (categoria) query = query.eq('categoria_id', categoria)
  if (ativo !== null && ativo !== '') query = query.eq('ativo', ativo === 'true')
  if (codigo) query = query.eq('codigo_barras', codigo)

  const { data, error } = await query
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, data })
}

export async function POST(request: NextRequest) {
  const body = await request.json()
  const { nome, codigo_barras, unidade, quantidade_atual, quantidade_minima, categoria_id, descricao, localizacao } = body

  if (!nome?.trim()) return NextResponse.json({ ok: false, error: 'Nome obrigatório' }, { status: 400 })

  const payload: any = {
    nome: nome.trim(),
    unidade: unidade || 'un',
    quantidade_atual: Number(quantidade_atual) || 0,
    quantidade_minima: Number(quantidade_minima) || 0,
    descricao: descricao || '',
    localizacao: localizacao || '',
    ativo: true,
  }
  if (codigo_barras?.trim()) payload.codigo_barras = codigo_barras.trim()
  if (categoria_id) payload.categoria_id = categoria_id
  payload.data_validade = body.data_validade || null

  const { data, error } = await supabase
    .from('produtos_estoque')
    .insert(payload)
    .select('*, categorias_estoque(id, nome, cor)')
    .single()
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, data })
}

export async function PUT(request: NextRequest) {
  const body = await request.json()
  const { id, nome, codigo_barras, unidade, quantidade_minima, categoria_id, descricao, localizacao, ativo } = body

  if (!id) return NextResponse.json({ ok: false, error: 'ID obrigatório' }, { status: 400 })

  const payload: any = {
    nome: nome?.trim(),
    unidade: unidade || 'un',
    quantidade_minima: Number(quantidade_minima) || 0,
    descricao: descricao || '',
    localizacao: localizacao || '',
    updated_at: new Date().toISOString(),
  }
  if (typeof ativo === 'boolean') payload.ativo = ativo
  payload.codigo_barras = codigo_barras?.trim() || null
  payload.categoria_id = categoria_id || null
  payload.data_validade = body.data_validade || null

  const { data, error } = await supabase
    .from('produtos_estoque')
    .update(payload)
    .eq('id', id)
    .select('*, categorias_estoque(id, nome, cor)')
    .single()
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, data })
}

export async function DELETE(request: NextRequest) {
  const { id } = await request.json()
  if (!id) return NextResponse.json({ ok: false, error: 'ID obrigatório' }, { status: 400 })

  // Soft delete
  const { error } = await supabase
    .from('produtos_estoque')
    .update({ ativo: false, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
