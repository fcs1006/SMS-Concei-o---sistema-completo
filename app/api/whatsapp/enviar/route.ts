import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const EVOLUTION_URL = process.env.EVOLUTION_API_URL!
const EVOLUTION_KEY = process.env.EVOLUTION_API_KEY!
const EVOLUTION_INSTANCE = process.env.EVOLUTION_INSTANCE!

// POST — envia mensagem manual pelo atendente humano via Evolution API
export async function POST(request: NextRequest) {
  try {
    const { numero, texto } = await request.json()
    if (!numero || !texto) {
      return NextResponse.json({ ok: false, error: 'numero e texto são obrigatórios' }, { status: 400 })
    }

    if (!EVOLUTION_URL || !EVOLUTION_KEY || !EVOLUTION_INSTANCE) {
      return NextResponse.json(
        { ok: false, error: 'Evolution API nao configurada. Configure EVOLUTION_API_URL, EVOLUTION_API_KEY e EVOLUTION_INSTANCE.' },
        { status: 500 }
      )
    }

    const resp = await fetch(`${EVOLUTION_URL}/message/sendText/${EVOLUTION_INSTANCE}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': EVOLUTION_KEY },
      body: JSON.stringify({ number: numero, text: texto })
    })

    if (!resp.ok) {
      const err = await resp.text()
      return NextResponse.json({ ok: false, error: err }, { status: 500 })
    }

    // Ao enviar uma mensagem manual do atendente, silencia o robô definindo o estado como 'aguardando_humano'.
    // Porém, se for um comando de reativação (#fim, #bot, etc.), define o estado como 'menu' para reativar o bot.
    const textoLimpo = texto.trim().toLowerCase()
    const ehComandoReativar = ['#fim', '#bot', '#voltarbot', '#encerrar'].includes(textoLimpo)
    const novoEstado = ehComandoReativar ? 'menu' : 'aguardando_humano'

    await supabase.from('whatsapp_estados').upsert(
      { telefone: numero, estado: novoEstado, atualizado_em: new Date().toISOString() },
      { onConflict: 'telefone' }
    )

    return NextResponse.json({ ok: true })
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Erro interno ao enviar mensagem'
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
