import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
)

// Requer a função no Supabase:
// CREATE OR REPLACE FUNCTION criar_usuario(p_nome text, p_cpf text, p_senha text)
// RETURNS json LANGUAGE plpgsql SECURITY DEFINER AS $$
// DECLARE v_existe int;
// BEGIN
//   SELECT count(*) INTO v_existe FROM servidores WHERE cpf = p_cpf AND ativo = true;
//   IF v_existe > 0 THEN RETURN json_build_object('ok', false, 'error', 'CPF já cadastrado.'); END IF;
//   INSERT INTO servidores (nome, cpf, senha_hash, ativo)
//   VALUES (p_nome, p_cpf, crypt(p_senha, gen_salt('bf')), true);
//   RETURN json_build_object('ok', true);
// END; $$;

export async function POST(request: NextRequest) {
  try {
    const { nome, cpf, senha, telefone, email } = await request.json()

    if (!nome || !cpf || !senha || !telefone || !email) {
      return NextResponse.json({ ok: false, error: 'Todos os campos são obrigatórios.' }, { status: 400 })
    }
    if (cpf.length !== 11) {
      return NextResponse.json({ ok: false, error: 'CPF inválido.' }, { status: 400 })
    }
    if (senha.length < 6) {
      return NextResponse.json({ ok: false, error: 'Senha muito curta.' }, { status: 400 })
    }

    const { data, error } = await supabase.rpc('criar_usuario', {
      p_nome: nome,
      p_cpf: cpf,
      p_senha: senha,
      p_telefone: telefone,
      p_email: email
    })

    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })

    return NextResponse.json(data)
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 })
  }
}
