import { NextRequest, NextResponse } from 'next/server'
import {
  SisregConfigError,
  SisregRequestError,
  buscarSolicitacoesSisreg,
} from '@/lib/sisreg'

export async function POST(request: NextRequest) {
  try {
    const { busca } = await request.json()
    if (!busca) return NextResponse.json({ ok: false, error: 'Busca vazia' }, { status: 400 })

    const data = await buscarSolicitacoesSisreg(busca, 'ambos')
    return NextResponse.json({ ok: true, data })
  } catch (e: unknown) {
    if (e instanceof SisregConfigError) {
      return NextResponse.json({ ok: false, error: e.message }, { status: 500 })
    }

    if (e instanceof SisregRequestError) {
      return NextResponse.json(
        { ok: false, error: 'Erro no SISREG', details: e.details },
        { status: e.status }
      )
    }

    const message = e instanceof Error ? e.message : 'Erro interno ao consultar o SISREG'
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
