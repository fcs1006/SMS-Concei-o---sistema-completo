import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServer } from '@/lib/supabaseServer'

export async function POST(request: NextRequest) {
  try {
    const supabase = getSupabaseServer()
    const { usuario, senha } = await request.json()

    if (!usuario || !senha) {
      return NextResponse.json({ ok: false, error: 'Usuário e senha são obrigatórios.' }, { status: 400 })
    }

    const { data, error } = await supabase.rpc('fazer_login', {
      p_usuario: String(usuario).trim(),
      p_senha: String(senha).trim()
    })

    if (error) {
      console.error('[POST /api/auth/login] Erro Supabase RPC:', error)
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
    }

    if (!data?.ok) {
      return NextResponse.json({ ok: false, error: data?.error || 'Usuário ou senha incorretos.' }, { status: 401 })
    }

    return NextResponse.json(data)
  } catch (e: any) {
    console.error('[POST /api/auth/login] Exceção:', e)
    return NextResponse.json({ ok: false, error: e.message || 'Erro interno no servidor de autenticação.' }, { status: 500 })
  }
}
