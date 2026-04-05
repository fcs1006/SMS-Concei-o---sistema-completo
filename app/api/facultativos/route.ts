import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

export async function GET(request: NextRequest) {
  const mes = Number(request.nextUrl.searchParams.get('mes'));
  const ano = Number(request.nextUrl.searchParams.get('ano'));
  const { data, error } = await supabase
    .from('dias_facultativos')
    .select('*')
    .eq('mes', mes)
    .eq('ano', ano)
    .order('dia');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data || []);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { dia, mes, ano, descricao } = body;
  const { data, error } = await supabase
    .from('dias_facultativos')
    .insert([{ dia: Number(dia), mes: Number(mes), ano: Number(ano), descricao: String(descricao).toUpperCase() }])
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}

export async function DELETE(request: NextRequest) {
  const id = request.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'ID não informado' }, { status: 400 });
  const { error } = await supabase.from('dias_facultativos').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
