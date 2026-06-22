import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

const DEFAULT_SISREG_URL = 'https://sisreg-es.saude.gov.br'

export async function GET(request: NextRequest) {
  try {
    const sisregUser = process.env.SISREG_USER
    const sisregPassword = process.env.SISREG_PASSWORD
    let url = process.env.SISREG_URL || DEFAULT_SISREG_URL

    url = url.replace(/\/$/, '')
    const indicesToRemove = [
      'solicitacao-ambulatorial-to-conceicao-do-tocantins',
      'marcacao-ambulatorial-to-conceicao-do-tocantins'
    ]
    for (const idxName of indicesToRemove) {
      if (url.endsWith(idxName)) {
        url = url.slice(0, -idxName.length).replace(/\/$/, '')
      }
    }

    const hasUser = !!sisregUser
    const hasPassword = !!sisregPassword
    const userLength = sisregUser ? sisregUser.length : 0

    if (!sisregUser || !sisregPassword) {
      return NextResponse.json({
        ok: false,
        status: 'config_error',
        message: 'Credenciais do SISREG não configuradas nas variáveis de ambiente do servidor.',
        details: {
          hasUser,
          hasPassword,
          userLength,
          url
        }
      })
    }

    const auth = Buffer.from(`${sisregUser}:${sisregPassword}`).toString('base64')
    const testIndex = 'marcacao-ambulatorial-to-conceicao-do-tocantins'
    const testUrl = `${url.replace(/\/$/, '')}/${testIndex}/_search`

    console.log('[SISREG Diagnóstico] Iniciando teste de conexão:', testUrl)

    const startTime = Date.now()
    let responseStatus = null
    let responseText = null
    let connectionSuccess = false
    let errorMessage = null

    try {
      const response = await fetch(testUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          Authorization: `Basic ${auth}`,
        },
        body: JSON.stringify({
          query: {
            match_all: {}
          },
          size: 1
        }),
        // Define timeout de 5 segundos
        signal: AbortSignal.timeout(5000)
      })

      responseStatus = response.status
      connectionSuccess = response.ok
      responseText = await response.text()
    } catch (e: any) {
      errorMessage = e.message
    }

    const durationMs = Date.now() - startTime

    return NextResponse.json({
      ok: connectionSuccess,
      status: connectionSuccess ? 'success' : 'network_error',
      durationMs,
      details: {
        hasUser,
        hasPassword,
        userLength,
        url,
        testUrl,
        responseStatus,
        errorMessage,
        // Mostra os primeiros 200 caracteres da resposta para diagnóstico
        responseSnippet: responseText ? responseText.substring(0, 200) : null
      }
    })
  } catch (error: any) {
    return NextResponse.json({ ok: false, status: 'error', error: error.message }, { status: 500 })
  }
}
