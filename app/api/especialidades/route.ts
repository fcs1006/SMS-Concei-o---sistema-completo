import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
)

// GET /api/especialidades?especialidade=ortopedia&mes=04&ano=2026
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const especialidade = searchParams.get('especialidade')
    const mes = searchParams.get('mes')
    const ano = searchParams.get('ano')

    let query = supabase
      .from('especialidades_agendamentos')
      .select('*')
      .order('data_consulta', { ascending: true })

    if (especialidade) query = query.eq('especialidade', especialidade)
    if (mes) query = query.eq('mes', mes)
    if (ano) query = query.eq('ano', ano)

    const { data, error } = await query
    if (error) throw error

    return NextResponse.json({ ok: true, data: data || [] })
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }
}

// POST /api/especialidades
// Body: { especialidade, paciente_nome, paciente_cns, telefone, data_consulta, tipo_exame, observacao, mes, ano, criado_por, profissional_nome? }
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { especialidade, paciente_nome, paciente_cns, telefone, data_consulta, tipo_exame, observacao, mes, ano, criado_por, profissional_nome } = body

    if (!especialidade || !paciente_nome || !telefone || !data_consulta || !mes || !ano) {
      return NextResponse.json({ ok: false, error: 'Campos obrigatórios ausentes (nome, telefone, data)' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('especialidades_agendamentos')
      .insert([{
        especialidade, paciente_nome, paciente_cns: paciente_cns || null,
        telefone: telefone.replace(/\D/g, ''),
        data_consulta, tipo_exame: tipo_exame || null,
        status: 'pendente', observacao: observacao || null,
        mes, ano, criado_por: criado_por || null,
        profissional_nome: profissional_nome || null
      }])
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ ok: true, data })
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }
}

// PATCH /api/especialidades
// Body: { id, status, motivo_cancelamento? }
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()
    const { id, status, motivo_cancelamento } = body

    if (!id || !status) {
      return NextResponse.json({ ok: false, error: 'ID e status obrigatórios' }, { status: 400 })
    }

    if (!['pendente', 'autorizado', 'negado'].includes(status)) {
      return NextResponse.json({ ok: false, error: 'Status inválido' }, { status: 400 })
    }

    const update: Record<string, any> = { status }
    if (status === 'negado' && motivo_cancelamento) update.motivo_cancelamento = motivo_cancelamento
    if (status !== 'negado') update.motivo_cancelamento = null

    const { data, error } = await supabase
      .from('especialidades_agendamentos')
      .update(update)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ ok: true, data })
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }
}

// DELETE /api/especialidades?id=uuid
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) return NextResponse.json({ ok: false, error: 'ID não informado' }, { status: 400 })

    const { error } = await supabase
      .from('especialidades_agendamentos')
      .delete()
      .eq('id', id)

    if (error) throw error

    return NextResponse.json({ ok: true })
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }
}
