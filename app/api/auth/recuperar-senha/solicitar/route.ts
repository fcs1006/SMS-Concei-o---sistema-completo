import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const EVOLUTION_URL = process.env.EVOLUTION_API_URL!
const EVOLUTION_KEY = process.env.EVOLUTION_API_KEY!
const EVOLUTION_INSTANCE = process.env.EVOLUTION_INSTANCE!

export async function POST(request: NextRequest) {
  try {
    const { cpf } = await request.json()
    const cpfLimpo = cpf.replace(/\D/g, '')
    const cpfFormatado = cpfLimpo.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')

    // 1. Busca o usuário pelo CPF (tenta com e sem máscara)
    const { data: usuario, error: errU } = await supabase
      .from('usuarios')
      .select('id, nome, telefone, email')
      .or(`usuario.ilike.%${cpfLimpo}%,usuario.eq.${cpfFormatado}`)
      .maybeSingle()

    if (errU || !usuario) {
      return NextResponse.json({ ok: false, error: 'CPF não encontrado no cadastro.' }, { status: 404 })
    }

    if (!usuario.telefone) {
      return NextResponse.json({ ok: false, error: 'Usuário não possui telefone cadastrado para recuperação.' }, { status: 400 })
    }

    // 2. Gera código de 6 dígitos
    const codigo = Math.floor(100000 + Math.random() * 900000).toString()
    const expiraEm = new Date(Date.now() + 15 * 60 * 1000).toISOString() // 15 minutos

    // 3. Salva no banco
    const { error: errIns } = await supabase
      .from('recuperacao_senhas')
      .insert([{
        usuario_id: usuario.id,
        codigo,
        expira_em: expiraEm
      }])

    if (errIns) {
      console.error('Erro ao inserir na tabela recuperacao_senhas:', errIns)
      return NextResponse.json({ ok: false, error: `Erro no banco: ${errIns.message}. Verifique se a tabela 'recuperacao_senhas' foi criada.` }, { status: 500 })
    }

    // 4. Envia via E-mail (Resend)
    const RESEND_KEY = process.env.RESEND_API_KEY
    const emailUsuario = usuario.email

    if (!emailUsuario) {
      return NextResponse.json({ ok: false, error: 'Usuário não possui e-mail cadastrado. Entre em contato com o suporte.' }, { status: 400 })
    }

    try {
      if (!RESEND_KEY) {
        console.warn('RESEND_API_KEY não configurada. O código gerado foi:', codigo)
        return NextResponse.json({ ok: true, message: 'Código gerado (Modo Desenvolvimento). Verifique os logs do servidor.' })
      }
      
      const resEmail = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${RESEND_KEY}`
        },
        body: JSON.stringify({
          from: 'SMS Conceição <onboarding@resend.dev>',
          to: [emailUsuario],
          subject: 'Código de Recuperação — SMS Conceição',
          html: `
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
              <h2 style="color: #1e293b;">Olá, ${usuario.nome.split(' ')[0]}!</h2>
              <p style="color: #475569; font-size: 16px;">Recebemos uma solicitação para redefinir sua senha no sistema SMS Conceição.</p>
              <div style="background-color: #f8fafc; padding: 20px; text-align: center; border-radius: 6px; margin: 20px 0;">
                <span style="font-size: 32px; font-weight: bold; letter-spacing: 5px; color: #2563eb;">${codigo}</span>
              </div>
              <p style="color: #64748b; font-size: 14px;">Este código é válido por 15 minutos. Se você não solicitou esta alteração, pode ignorar este e-mail com segurança.</p>
              <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 20px 0;">
              <p style="color: #94a3b8; font-size: 12px; text-align: center;">© 2026 SMS Conceição — Secretaria Municipal de Saúde</p>
            </div>
          `
        })
      })

      if (!resEmail.ok) {
        const errorData = await resEmail.json()
        console.error('Erro Resend API:', errorData)
      }
    } catch (errEnvio: any) {
      console.error('Erro ao enviar e-mail:', errEnvio)
    }

    return NextResponse.json({ ok: true, message: 'Código enviado para o seu e-mail!' })

  } catch (e: any) {
    console.error('Erro solicitar-codigo:', e)
    return NextResponse.json({ ok: false, error: `Erro interno: ${e.message}` }, { status: 500 })
  }
}
