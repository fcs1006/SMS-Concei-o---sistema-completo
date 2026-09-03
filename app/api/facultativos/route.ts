import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabaseServer';

export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabaseServer();
    const mes = Number(request.nextUrl.searchParams.get('mes'));
    const ano = Number(request.nextUrl.searchParams.get('ano'));

    const { data, error } = await supabase
      .from('dias_facultativos')
      .select('*')
      .eq('mes', mes)
      .eq('ano', ano)
      .order('dia');

    if (error) {
      console.error('[GET /api/facultativos] Erro:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data || []);
  } catch (err: any) {
    console.error('[GET /api/facultativos] Exceção:', err);
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
      .from('dias_facultativos')
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
      console.error('[POST /api/facultativos] Erro:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data, { status: 201 });
  } catch (err: any) {
    console.error('[POST /api/facultativos] Exceção:', err);
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
      .from('dias_facultativos')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('[DELETE /api/facultativos] Erro:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error('[DELETE /api/facultativos] Exceção:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
