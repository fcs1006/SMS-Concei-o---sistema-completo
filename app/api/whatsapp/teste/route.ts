import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// GET - busca mensagens e estado do Francisco para o telefone de teste.
export async function GET(request: NextRequest) {
  const params = new URL(request.url).searchParams
  const telefone = params.get('telefone')
  const afterId = Number(params.get('after_id') || 0)

  if (!telefone) {
    return NextResponse.json({ ok: false, error: 'telefone obrigatorio' })
  }

  // Busca o estado atual no banco de dados
  const { data: estadoData } = await supabase
    .from('whatsapp_estados')
    .select('estado, dados')
    .eq('telefone', telefone)
    .maybeSingle()

  if (afterId > 0) {
    const { data } = await supabase
      .from('whatsapp_conversas')
      .select('id, papel, mensagem, criado_em')
      .eq('telefone', telefone)
      .in('papel', ['assistant', 'sistema'])
      .gt('id', afterId)
      .order('id', { ascending: true })
      .limit(10)

    return NextResponse.json({
      ok: true,
      mensagens: data || [],
      ultima: data?.at(-1) || null,
      estado: estadoData?.estado || 'menu',
      dadosEstado: estadoData?.dados || {}
    })
  }

  const { data } = await supabase
    .from('whatsapp_conversas')
    .select('id, papel, mensagem, criado_em')
    .eq('telefone', telefone)
    .in('papel', ['assistant', 'sistema'])
    .order('id', { ascending: false })
    .limit(1)

  return NextResponse.json({
    ok: true,
    mensagens: data || [],
    ultima: data?.[0] || null,
    estado: estadoData?.estado || 'menu',
    dadosEstado: estadoData?.dados || {}
  })
}

// DELETE - limpa historico e reseta estado do telefone de teste.
export async function DELETE(request: NextRequest) {
  const telefone = new URL(request.url).searchParams.get('telefone')
  if (!telefone) return NextResponse.json({ ok: false, error: 'telefone obrigatorio' })

  await supabase.from('whatsapp_conversas').delete().eq('telefone', telefone)
  await supabase.from('whatsapp_estados').delete().eq('telefone', telefone)
  return NextResponse.json({ ok: true })
}
