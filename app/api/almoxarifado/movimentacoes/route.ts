import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
)

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const produto_id = searchParams.get('produto_id') || ''
  const tipo = searchParams.get('tipo') || ''
  const de = searchParams.get('de') || ''
  const ate = searchParams.get('ate') || ''
  const limit = parseInt(searchParams.get('limit') || '100')

  let query = supabase
    .from('movimentacoes_estoque')
    .select('*, produtos_estoque(id, nome, unidade, codigo_barras)')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (produto_id) query = query.eq('produto_id', produto_id)
  if (tipo) query = query.eq('tipo', tipo)
  if (de) query = query.gte('created_at', de)
  if (ate) query = query.lte('created_at', ate + 'T23:59:59')

  const { data, error } = await query
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, data })
}

export async function POST(request: NextRequest) {
  const body = await request.json()
  const { produto_id, tipo, quantidade, motivo, usuario_nome } = body

  if (!produto_id) return NextResponse.json({ ok: false, error: 'Produto obrigatório' }, { status: 400 })
  if (!tipo || !['entrada', 'saida', 'ajuste'].includes(tipo))
    return NextResponse.json({ ok: false, error: 'Tipo inválido' }, { status: 400 })
  if (!quantidade || Number(quantidade) <= 0)
    return NextResponse.json({ ok: false, error: 'Quantidade deve ser maior que zero' }, { status: 400 })

  const { data, error } = await supabase.rpc('registrar_movimentacao_estoque', {
    p_produto_id: produto_id,
    p_tipo: tipo,
    p_quantidade: Number(quantidade),
    p_motivo: motivo || '',
    p_usuario: usuario_nome || '',
    p_destino: body.destino || '',
    p_observacao: body.observacao || '',
  })

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  if (!data?.ok) return NextResponse.json({ ok: false, error: data?.error || 'Erro ao registrar' }, { status: 422 })
  return NextResponse.json({ ok: true, ...data })
}
