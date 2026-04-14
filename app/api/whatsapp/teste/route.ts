import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// GET — busca última mensagem do Francisco para o telefone de teste
export async function GET(request: NextRequest) {
  const telefone = new URL(request.url).searchParams.get('telefone')
  if (!telefone) return NextResponse.json({ ok: false, error: 'telefone obrigatório' })

  const { data } = await supabase
    .from('whatsapp_conversas')
    .select('papel, mensagem, criado_em')
    .eq('telefone', telefone)
    .in('papel', ['assistant', 'sistema'])
    .order('criado_em', { ascending: false })
    .limit(1)

  return NextResponse.json({ ok: true, ultima: data?.[0] || null })
}

// DELETE — limpa histórico do telefone de teste
export async function DELETE(request: NextRequest) {
  const telefone = new URL(request.url).searchParams.get('telefone')
  if (!telefone) return NextResponse.json({ ok: false, error: 'telefone obrigatório' })

  await supabase.from('whatsapp_conversas').delete().eq('telefone', telefone)
  return NextResponse.json({ ok: true })
}
