import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServer } from '@/lib/supabaseServer'

export async function POST(request: NextRequest) {
  try {
    const supabase = getSupabaseServer()
    const { cpf, novaSenha } = await request.json()

    if (!cpf || !novaSenha) {
      return NextResponse.json({ ok: false, error: 'CPF e nova senha são obrigatórios.' }, { status: 400 })
    }
    const cleanCpf = String(cpf).replace(/\D/g, '')
    if (cleanCpf.length !== 11) {
      return NextResponse.json({ ok: false, error: 'CPF inválido.' }, { status: 400 })
    }
    if (String(novaSenha).length < 6) {
      return NextResponse.json({ ok: false, error: 'A senha deve ter pelo menos 6 caracteres.' }, { status: 400 })
    }

    const { data, error } = await supabase.rpc('redefinir_senha', {
      p_cpf: String(cpf).trim(),
      p_nova_senha: String(novaSenha).trim()
    })

    if (error) {
      console.error('[POST /api/auth/redefinir-senha] Erro:', error)
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch (e: any) {
    console.error('[POST /api/auth/redefinir-senha] Exceção:', e)
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 })
  }
}
