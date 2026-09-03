import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServer } from '@/lib/supabaseServer'

export async function POST(request: NextRequest) {
  try {
    const supabase = getSupabaseServer()
    const { nome, cpf, senha, telefone, email } = await request.json()

    if (!nome || !cpf || !senha || !telefone || !email) {
      return NextResponse.json({ ok: false, error: 'Todos os campos são obrigatórios.' }, { status: 400 })
    }
    if (String(cpf).replace(/\D/g, '').length !== 11) {
      return NextResponse.json({ ok: false, error: 'CPF inválido.' }, { status: 400 })
    }
    if (String(senha).length < 6) {
      return NextResponse.json({ ok: false, error: 'A senha deve ter pelo menos 6 caracteres.' }, { status: 400 })
    }

    const { data, error } = await supabase.rpc('criar_usuario', {
      p_nome: String(nome).trim(),
      p_cpf: String(cpf).trim(),
      p_senha: String(senha).trim(),
      p_telefone: String(telefone).trim(),
      p_email: String(email).trim()
    })

    if (error) {
      console.error('[POST /api/auth/cadastro] Erro Supabase RPC:', error)
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch (e: any) {
    console.error('[POST /api/auth/cadastro] Exceção:', e)
    return NextResponse.json({ ok: false, error: e.message || 'Erro interno no cadastro.' }, { status: 500 })
  }
}
