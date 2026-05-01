import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
)

// GET /api/especialidades?especialidade=ortopedia&mes=04&ano=2026&incluir_excluidos=1
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const especialidade = searchParams.get('especialidade')
    const mes = searchParams.get('mes')
    const ano = searchParams.get('ano')
    const incluirExcluidos = searchParams.get('incluir_excluidos') === '1'
    const statusFiltro = searchParams.get('status') // para relatório detalhado

    // Busca pacientes do mês/ano de cadastro OU com data_atendimento no mês/ano selecionado
    let query = supabase
      .from('especialidades_agendamentos')
      .select('*')
      .order('data_consulta', { ascending: true })
      .order('created_at', { ascending: true })

    if (especialidade) query = query.eq('especialidade', especialidade)
    if (statusFiltro) query = query.eq('status', statusFiltro)
    if (!incluirExcluidos && !statusFiltro) query = query.neq('status', 'excluido')

    // Filtro de mês/ano apenas para relatório detalhado
    if (statusFiltro && mes) query = query.eq('mes', mes)
    if (statusFiltro && ano) query = query.eq('ano', ano)

    const { data, error } = await query
    if (error) throw error

    return NextResponse.json({ ok: true, data: data || [] })
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }
}

// POST /api/especialidades
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { especialidade, paciente_nome, paciente_cns, telefone, data_consulta, data_atendimento, tipo_exame, observacao, mes, ano, criado_por, profissional_nome, prioridade, sexo } = body

    if (!especialidade || !paciente_nome || !telefone || !data_consulta || !mes || !ano) {
      return NextResponse.json({ ok: false, error: 'Campos obrigatórios ausentes (nome, telefone, data)' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('especialidades_agendamentos')
      .insert([{
        especialidade, paciente_nome, paciente_cns: paciente_cns || null,
        telefone: telefone.replace(/\D/g, ''),
        data_consulta, data_atendimento: data_atendimento || null,
        tipo_exame: tipo_exame || null,
        status: 'pendente', observacao: observacao || null,
        mes, ano, criado_por: criado_por || null,
        profissional_nome: profissional_nome || null,
        prioridade: prioridade || null,
        sexo: sexo || null
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
// Body: { id, status, motivo_cancelamento?, motivo_exclusao? }  — atualiza status
// Body: { id, campos: { paciente_nome, ... } }                  — atualiza campos
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()
    const { id, status, motivo_cancelamento, motivo_exclusao, campos } = body

    if (!id) {
      return NextResponse.json({ ok: false, error: 'ID obrigatório' }, { status: 400 })
    }

    // Atualização de campos livres (edição)
    if (campos) {
      const camposPermitidos = ['paciente_nome', 'paciente_cns', 'telefone', 'sexo', 'data_consulta', 'data_atendimento', 'tipo_exame', 'observacao', 'profissional_nome', 'periodo', 'prioridade']
      const update: Record<string, any> = {}
      for (const k of camposPermitidos) {
        if (k in campos) update[k] = campos[k]
      }
      if (update.telefone) update.telefone = String(update.telefone).replace(/\D/g, '')

      const { data, error } = await supabase
        .from('especialidades_agendamentos')
        .update(update)
        .eq('id', id)
        .select()
        .single()

      if (error) throw error
      return NextResponse.json({ ok: true, data })
    }

    // Atualização de status
    if (!status) {
      return NextResponse.json({ ok: false, error: 'Status ou campos obrigatórios' }, { status: 400 })
    }

    if (!['pendente', 'autorizado', 'negado', 'excluido'].includes(status)) {
      return NextResponse.json({ ok: false, error: 'Status inválido' }, { status: 400 })
    }

    const { autorizado_por } = body
    const update: Record<string, any> = { status }
    if (status === 'negado' && motivo_cancelamento) update.motivo_cancelamento = motivo_cancelamento
    if (status === 'excluido' && motivo_exclusao) update.motivo_exclusao = motivo_exclusao
    if (status === 'pendente') {
      update.motivo_cancelamento = null
      update.motivo_exclusao = null
      update.autorizado_por = null
      update.data_atendimento = null
      update.periodo = null
    }
    if (status === 'autorizado') {
      update.motivo_cancelamento = null
      update.motivo_exclusao = null
      update.autorizado_por = autorizado_por || null
      update.periodo = body.periodo || null
      update.data_atendimento = body.data_atendimento || null
      update.justificativa_cota = body.justificativa_cota || null
    }

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

// DELETE não é mais usado — exclusão via PATCH status='excluido'
export async function DELETE(request: NextRequest) {
  return NextResponse.json({ ok: false, error: 'Use PATCH com status=excluido' }, { status: 405 })
}
