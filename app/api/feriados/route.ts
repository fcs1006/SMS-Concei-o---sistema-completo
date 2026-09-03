import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabaseServer';

export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabaseServer();
    const anoParam = request.nextUrl.searchParams.get('ano');
    const ano = anoParam ? Number(anoParam) : new Date().getFullYear();

    const { data, error } = await supabase
      .from('feriados_personalizados')
      .select('*')
      .eq('ano', ano)
      .order('mes')
      .order('dia');

    if (error) {
      console.error('[GET /api/feriados] Erro:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data || []);
  } catch (err: any) {
    console.error('[GET /api/feriados] Exceção:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = getSupabaseServer();
    const body = await request.json();
    const { dia, mes, ano, descricao } = body;

    if (!dia || !mes || !ano || !descricao) {
      return NextResponse.json(
        { error: 'Campos dia, mes, ano e descricao são obrigatórios.' },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from('feriados_personalizados')
      .insert([
        {
          dia: Number(dia),
          mes: Number(mes),
          ano: Number(ano),
          descricao: String(descricao).toUpperCase().trim()
        }
      ])
      .select()
      .single();

    if (error) {
      console.error('[POST /api/feriados] Erro:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data, { status: 201 });
  } catch (err: any) {
    console.error('[POST /api/feriados] Exceção:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const supabase = getSupabaseServer();
    const id = request.nextUrl.searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'ID não informado' }, { status: 400 });
    }

    const { error } = await supabase
      .from('feriados_personalizados')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('[DELETE /api/feriados] Erro:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error('[DELETE /api/feriados] Exceção:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
