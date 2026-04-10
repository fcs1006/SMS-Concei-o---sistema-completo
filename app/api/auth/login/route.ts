import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
)

export async function POST(request: NextRequest) {
  try {
    const { usuario, senha } = await request.json()
    if (!usuario || !senha) {
      return NextResponse.json({ ok: false, error: 'Usuário e senha obrigatórios' }, { status: 400 })
    }

    const { data, error } = await supabase.rpc('fazer_login', {
      p_usuario: usuario,
      p_senha: senha
    })

    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
    if (!data?.ok) return NextResponse.json({ ok: false, error: data?.error || 'Usuário ou senha incorretos.' }, { status: 401 })

    return NextResponse.json(data)
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 })
  }
}
