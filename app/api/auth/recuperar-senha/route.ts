import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
)

export async function POST(request: NextRequest) {
  try {
    const { cpf, contato, novaSenha } = await request.json()

    if (!cpf || !contato || !novaSenha) {
      return NextResponse.json({ ok: false, error: 'Todos os campos são obrigatórios.' }, { status: 400 })
    }
    if (cpf.length !== 11) {
      return NextResponse.json({ ok: false, error: 'CPF inválido.' }, { status: 400 })
    }
    if (novaSenha.length < 6) {
      return NextResponse.json({ ok: false, error: 'Senha muito curta.' }, { status: 400 })
    }

    const { data, error } = await supabase.rpc('recuperar_senha', {
      p_cpf: cpf,
      p_contato: contato.trim(),
      p_nova_senha: novaSenha
    })

    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })

    return NextResponse.json(data)
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 })
  }
}
