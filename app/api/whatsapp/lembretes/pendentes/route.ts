import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServer } from '@/lib/supabaseServer'
import { formatarNumeroWhatsapp, enviarMensagemLembrete, enviarBotoesLembrete } from '@/lib/whatsapp'
import { getActiveClientConfig } from '@/lib/config'

// GET /api/whatsapp/lembretes/pendentes — Lista todos os lembretes pendentes
export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabaseServer()
    const { searchParams } = new URL(request.url)
    const userCpf = searchParams.get('userCpf')

    if (!userCpf) {
      return NextResponse.json({ ok: false, error: 'Parâmetro userCpf é obrigatório.' }, { status: 401 })
    }

    // Valida permissão do usuário
    const { data: user, error: userErr } = await supabase
      .from('usuarios')
      .select('ativo')
      .eq('usuario', userCpf)
      .eq('ativo', true)
      .maybeSingle()

    if (userErr || !user) {
      return NextResponse.json({ ok: false, error: 'Acesso negado. Usuário inválido ou inativo.' }, { status: 403 })
    }

    const { data, error } = await supabase
      .from('lembretes_pendentes')
      .select('*')
      .order('criado_em', { ascending: false })

    if (error) {
      console.error('[Lembretes Pendentes GET] Erro de banco:', error)
      if (error.code === '42P01' || error.message.includes('relation "lembretes_pendentes" does not exist') || error.code === 'PGRST205') {
        return NextResponse.json({ ok: false, error: 'Tabela lembretes_pendentes não encontrada no banco. Por favor, execute a migração SQL.' }, { status: 404 })
      }
      throw error
    }

    return NextResponse.json({ ok: true, lembretes: data || [] })
  } catch (error: any) {
    console.error('[Lembretes Pendentes GET] Erro:', error.message)
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }
}

// POST /api/whatsapp/lembretes/pendentes — Dispara ou deleta lembretes selecionados
export async function POST(request: NextRequest) {
  try {
    const supabase = getSupabaseServer()
    const body = await request.json()
    const { ids, action, userCpf } = body

    if (!userCpf) {
      return NextResponse.json({ ok: false, error: 'Usuário não autenticado.' }, { status: 401 })
    }

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ ok: false, error: 'Parâmetro ids inválido ou vazio.' }, { status: 400 })
    }

    if (!['enviar', 'excluir', 'editar'].includes(action)) {
      return NextResponse.json({ ok: false, error: 'Ação inválida.' }, { status: 400 })
    }

    // Valida permissão do usuário
    const { data: user, error: userErr } = await supabase
      .from('usuarios')
      .select('ativo')
      .eq('usuario', userCpf)
      .eq('ativo', true)
      .maybeSingle()

    if (userErr || !user) {
      return NextResponse.json({ ok: false, error: 'Acesso negado. Usuário inválido ou inativo.' }, { status: 403 })
    }

    const activeConfig = await getActiveClientConfig()

    if (action === 'excluir') {
      const { error: delErr } = await supabase
        .from('lembretes_pendentes')
        .delete()
        .in('id', ids)

      if (delErr) throw delErr
      return NextResponse.json({ ok: true, mensagem: `${ids.length} lembretes removidos com sucesso.` })
    }

    if (action === 'editar') {
      const { mensagem } = body
      if (typeof mensagem !== 'string') {
        return NextResponse.json({ ok: false, error: 'Mensagem inválida ou ausente para edição.' }, { status: 400 })
      }

      const { error: editErr } = await supabase
        .from('lembretes_pendentes')
        .update({ mensagem })
        .in('id', ids)

      if (editErr) throw editErr
      return NextResponse.json({ ok: true, mensagem: `Mensagem de ${ids.length} lembretes atualizada com sucesso.` })
    }

    // Ação: enviar
    // Busca os registros pendentes correspondentes
    const { data: pendentes, error: queryErr } = await supabase
      .from('lembretes_pendentes')
      .select('*')
      .in('id', ids)

    if (queryErr) throw queryErr
    if (!pendentes || pendentes.length === 0) {
      return NextResponse.json({ ok: false, error: 'Nenhum lembrete correspondente encontrado.' }, { status: 404 })
    }

    let enviados = 0
    let erros = 0

    for (const lemb of pendentes) {
      try {
        const phoneFormatted = formatarNumeroWhatsapp(lemb.telefone, activeConfig.defaultDDD)
        if (!phoneFormatted) {
          throw new Error('Telefone inválido para envio.')
        }

        // Se contiver botões, envia como botões interativos
        if (lemb.botoes && Array.isArray(lemb.botoes) && lemb.botoes.length > 0) {
          // O lembrete de botões utiliza a mensagem como a descrição do menu
          const title = `Confirmação de Agendamento`
          await enviarBotoesLembrete(phoneFormatted, title, lemb.mensagem, lemb.botoes, activeConfig.assistantName)
        } else {
          await enviarMensagemLembrete(phoneFormatted, lemb.mensagem)
        }

        // Salva registro de envio na tabela de controle de duplicidades
        const { error: insErr } = await supabase.from('lembretes_enviados').insert([{
          tipo: lemb.tipo,
          referencia_id: lemb.referencia_id,
          data_evento: lemb.data_evento,
          telefone: phoneFormatted,
          mensagem: lemb.mensagem
        }])

        if (insErr) {
          console.warn('[Lembretes Pendentes] Erro ao salvar lembrete_enviado:', insErr.message)
        }

        // Deleta do lembretes_pendentes para não ficar listado
        await supabase.from('lembretes_pendentes').delete().eq('id', lemb.id)

        enviados++
      } catch (e: any) {
        erros++
        console.error(`Erro ao disparar lembrete pendente ${lemb.id}:`, e.message)
      }
    }

    return NextResponse.json({
      ok: true,
      mensagem: `Processo finalizado. Enviados com sucesso: ${enviados}. Falhas: ${erros}.`,
      resultados: { enviados, erros }
    })
  } catch (error: any) {
    console.error('[Lembretes Pendentes POST] Erro geral:', error.message)
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }
}
