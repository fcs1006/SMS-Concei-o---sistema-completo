import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// GET /api/whatsapp/conversas - Busca conversas ou mensagens individuais de forma segura no server-side
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const telefone = searchParams.get('telefone')

    if (telefone) {
      // Retorna mensagens de uma conversa específica
      const { data: mensagens, error } = await supabase
        .from('whatsapp_conversas')
        .select('papel, mensagem, criado_em')
        .eq('telefone', telefone)
        .order('criado_em', { ascending: true })

      if (error) throw error
      return NextResponse.json({ ok: true, mensagens: mensagens || [] })
    }

    // Parse do mapa de vistos do cliente para calcular naoLidas no servidor
    const vistosParam = searchParams.get('vistos')
    const vistosMap: Record<string, string> = vistosParam ? JSON.parse(vistosParam) : {}

    // Busca todas as conversas recentes de whatsapp_conversas
    const { data: mensagensDb, error: errConv } = await supabase
      .from('whatsapp_conversas')
      .select('telefone, nome, mensagem, papel, criado_em')
      .order('criado_em', { ascending: false })

    if (errConv) throw errConv

    // Busca todos os estados ativos de whatsapp_estados
    const { data: estadosDb, error: errEst } = await supabase
      .from('whatsapp_estados')
      .select('telefone, estado, atualizado_em')

    if (errEst) throw errEst

    const mapaEstados: Record<string, { estado: string; atualizado_em: string | null }> = {}
    if (estadosDb) {
      estadosDb.forEach(e => {
        mapaEstados[e.telefone] = { estado: e.estado, atualizado_em: e.atualizado_em }
      })
    }

    // Busca os nomes dos pacientes correspondentes na base de pacientes
    const telefones = [...new Set(mensagensDb.map(m => m.telefone))]
    const mapaNomes: Record<string, string> = {}
    
    if (telefones.length > 0) {
      const soDigitos = telefones.map(t => String(t).replace(/\D/g, ''))
      const { data: pacs } = await supabase
        .from('pacientes')
        .select('nome, telefone')
        .in('telefone', soDigitos)

      if (pacs) {
        pacs.forEach(p => {
          const t = String(p.telefone || '').replace(/\D/g, '')
          mapaNomes[t] = p.nome
        })
      }
    }

    // Agrupa e compila as conversas por telefone
    const mapaConversas: Record<string, any> = {}
    mensagensDb.forEach(m => {
      const telDigitos = String(m.telefone || '').replace(/\D/g, '')
      if (!mapaConversas[m.telefone]) {
        const estInfo = mapaEstados[m.telefone] || { estado: 'menu', atualizado_em: null }
        mapaConversas[m.telefone] = {
          telefone: m.telefone,
          nome: mapaNomes[telDigitos] || m.nome || null,
          ultima: m.mensagem,
          ultimaPapel: m.papel,
          hora: m.criado_em,
          total: 0,
          estado: estInfo.estado,
          atualizado_em: estInfo.atualizado_em,
          naoLidas: 0
        }
      }
      mapaConversas[m.telefone].total++

      // Incrementa naoLidas se for mensagem do usuário e criada após o último visto do atendente
      if (m.papel === 'user') {
        const ultimoVisto = vistosMap[m.telefone]
        if (!ultimoVisto || new Date(m.criado_em) > new Date(ultimoVisto)) {
          mapaConversas[m.telefone].naoLidas++
        }
      }
    })

    const lista = Object.values(mapaConversas).sort((a: any, b: any) => new Date(b.hora).getTime() - new Date(a.hora).getTime())
    return NextResponse.json({ ok: true, conversas: lista })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 })
  }
}

// DELETE /api/whatsapp/conversas - Limpa histórico de conversas e estado associado
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const telefone = searchParams.get('telefone')

    if (!telefone) {
      return NextResponse.json({ ok: false, error: 'telefone é obrigatório' }, { status: 400 })
    }

    await supabase.from('whatsapp_conversas').delete().eq('telefone', telefone)
    await supabase.from('whatsapp_estados').delete().eq('telefone', telefone)

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 })
  }
}

// PUT /api/whatsapp/conversas - Permite atualizar manualmente o estado da conversa (ex: alternar bot/humano)
export async function PUT(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const telefone = searchParams.get('telefone')
    const { estado } = await request.json()

    if (!telefone || !estado) {
      return NextResponse.json({ ok: false, error: 'telefone e estado são obrigatórios' }, { status: 400 })
    }

    await supabase.from('whatsapp_estados').upsert(
      { telefone, estado, atualizado_em: new Date().toISOString() },
      { onConflict: 'telefone' }
    )

    // Grava uma mensagem do sistema no histórico informando a alteração
    let msgSistema = ''
    if (estado === 'menu') {
      msgSistema = '🤖 Francisco foi reativado.'
    } else if (estado === 'aguardando_humano') {
      msgSistema = '👤 Atendimento assumido por um atendente humano.'
    }

    if (msgSistema) {
      await supabase.from('whatsapp_conversas').insert([{
        telefone,
        papel: 'sistema',
        mensagem: msgSistema
      }])
    }

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 })
  }
}
