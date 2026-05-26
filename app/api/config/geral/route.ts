import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const CHAVES_CONFIG = [
  'client_config',
  'contatos_suporte',
  'horario_atendimento',
  'servicos_municipio',
  'lista_ubs',
  'lista_acs',
  'tfd_destinos'
]

export async function GET() {
  try {
    const { data, error } = await supabase
      .from('configuracoes')
      .select('chave, valor')
      .in('chave', CHAVES_CONFIG)

    if (error) throw error

    const configs: Record<string, any> = {}
    ;(data || []).forEach(r => {
      configs[r.chave] = r.valor
    })

    return NextResponse.json({ ok: true, configs })
  } catch (err: any) {
    console.error('[Config Geral API GET] Erro:', err.message)
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { adminCpf, configs } = body

    if (!adminCpf) {
      return NextResponse.json({ ok: false, error: 'Usuário não autenticado.' }, { status: 401 })
    }

    // Valida permissão administrativa
    const { data: adm, error: admError } = await supabase
      .from('usuarios')
      .select('perfil')
      .eq('usuario', adminCpf)
      .eq('ativo', true)
      .maybeSingle()

    if (admError || adm?.perfil !== 'admin') {
      return NextResponse.json({ ok: false, error: 'Acesso negado. Apenas administradores podem alterar configurações.' }, { status: 403 })
    }

    if (!configs || typeof configs !== 'object') {
      return NextResponse.json({ ok: false, error: 'Parâmetro configs inválido.' }, { status: 400 })
    }

    const entries = Object.entries(configs).filter(([k]) => CHAVES_CONFIG.includes(k))

    for (const [chave, valor] of entries) {
      const { error } = await supabase
        .from('configuracoes')
        .upsert({
          chave,
          valor,
          atualizado_em: new Date().toISOString()
        }, { onConflict: 'chave' })

      if (error) throw error
    }

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    console.error('[Config Geral API POST] Erro:', err.message)
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 })
  }
}
