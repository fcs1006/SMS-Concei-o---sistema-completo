import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const CHAVES = ['login_fundo_id', 'login_fundo_bgSize', 'login_fundo_bgPos', 'login_fundo_ajX', 'login_fundo_ajY', 'login_fundo_zoom', 'login_fundo_url', 'login_fundo_modoAj']

export async function GET() {
  const { data } = await supabase
    .from('configuracoes_app')
    .select('chave, valor')
    .in('chave', CHAVES)

  const cfg: Record<string, string> = {}
  ;(data || []).forEach(r => { cfg[r.chave] = r.valor })

  return NextResponse.json({ ok: true, cfg })
}

export async function POST(req: Request) {
  const body = await req.json()
  const { adminCpf, ...campos } = body

  const { data: adm } = await supabase
    .from('usuarios')
    .select('perfil')
    .eq('usuario', adminCpf)
    .eq('ativo', true)
    .single()

  if (adm?.perfil !== 'admin') {
    return NextResponse.json({ ok: false, error: 'Acesso negado.' }, { status: 403 })
  }

  const updates = Object.entries(campos)
    .filter(([k]) => CHAVES.includes(k))
    .map(([chave, valor]) => ({ chave, valor: String(valor), updated_at: new Date().toISOString() }))

  for (const u of updates) {
    await supabase.from('configuracoes_app').update({ valor: u.valor, updated_at: u.updated_at }).eq('chave', u.chave)
  }

  return NextResponse.json({ ok: true })
}
