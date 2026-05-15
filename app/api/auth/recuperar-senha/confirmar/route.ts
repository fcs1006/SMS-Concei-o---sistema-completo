import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: NextRequest) {
  try {
    const { cpf, codigo, novaSenha } = await request.json()
    const cpfLimpo = cpf.replace(/\D/g, '')
    const cpfFormatado = cpfLimpo.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')

    if (!cpf || !codigo || !novaSenha) {
      return NextResponse.json({ ok: false, error: 'Dados incompletos.' }, { status: 400 })
    }

    // 1. Busca o usuário
    const { data: usuario, error: errU } = await supabase
      .from('usuarios')
      .select('id')
      .or(`usuario.ilike.%${cpfLimpo}%,usuario.eq.${cpfFormatado}`)
      .maybeSingle()

    if (errU || !usuario) {
      return NextResponse.json({ ok: false, error: 'Usuário não encontrado.' }, { status: 404 })
    }

    // 2. Valida o código
    const { data: rec, error: errR } = await supabase
      .from('recuperacao_senhas')
      .select('id')
      .eq('usuario_id', usuario.id)
      .eq('codigo', codigo)
      .eq('usado', false)
      .gt('expira_em', new Date().toISOString())
      .order('criado_em', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (errR || !rec) {
      return NextResponse.json({ ok: false, error: 'Código inválido ou expirado.' }, { status: 400 })
    }

    // 3. Tudo certo! Atualiza a senha e marca o código como usado
    const { data: resp, error: errAuth } = await supabase.rpc('redefinir_senha', {
      p_cpf: cpf, // O RPC já lida com a formatação agora
      p_nova_senha: novaSenha
    })

    if (errAuth || !resp?.ok) {
      return NextResponse.json({ ok: false, error: resp?.error || 'Erro ao redefinir senha.' }, { status: 500 })
    }

    // Marca o código como usado
    await supabase.from('recuperacao_senhas').update({ usado: true }).eq('id', rec.id)

    return NextResponse.json({ ok: true, message: 'Senha alterada com sucesso!' })

  } catch (e: any) {
    console.error('Erro confirmar-codigo:', e)
    return NextResponse.json({ ok: false, error: 'Erro interno ao redefinir senha.' }, { status: 500 })
  }
}
