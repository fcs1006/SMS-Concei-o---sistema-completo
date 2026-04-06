import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
)

// Requer a função no Supabase:
// CREATE OR REPLACE FUNCTION redefinir_senha(p_cpf text, p_nova_senha text)
// RETURNS json LANGUAGE plpgsql SECURITY DEFINER AS $$
// DECLARE v_existe int;
// BEGIN
//   SELECT count(*) INTO v_existe FROM servidores WHERE cpf = p_cpf AND ativo = true;
//   IF v_existe = 0 THEN RETURN json_build_object('ok', false, 'error', 'CPF não encontrado.'); END IF;
//   UPDATE servidores SET senha_hash = crypt(p_nova_senha, gen_salt('bf')) WHERE cpf = p_cpf AND ativo = true;
//   RETURN json_build_object('ok', true);
// END; $$;

export async function POST(request: NextRequest) {
  try {
    const { cpf, novaSenha } = await request.json()

    if (!cpf || !novaSenha) {
      return NextResponse.json({ ok: false, error: 'CPF e nova senha são obrigatórios.' }, { status: 400 })
    }
    if (cpf.length !== 11) {
      return NextResponse.json({ ok: false, error: 'CPF inválido.' }, { status: 400 })
    }
    if (novaSenha.length < 6) {
      return NextResponse.json({ ok: false, error: 'Senha muito curta.' }, { status: 400 })
    }

    const { data, error } = await supabase.rpc('redefinir_senha', {
      p_cpf: cpf,
      p_nova_senha: novaSenha
    })

    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })

    return NextResponse.json(data)
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 })
  }
}
