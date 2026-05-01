import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { normalizarTexto } from '@/app/api/utils/helpers';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

/**
 * GET /api/servidores/frequencia
 * Busca servidores para frequência com filtro opcional
 * Query: ?termo=busca (opcional)
 */
export async function GET(request: NextRequest) {
  try {
    const termo = request.nextUrl.searchParams.get('termo') || '';
    const termoFiltro = normalizarTexto(termo);

    let query = supabase
      .from('servidores')
      .select('id, nome, matricula, lotacao, funcao')
      .neq('status', 'INATIVO')
      .order('nome');

    // Se houver termo, filtra por nome ou matrícula
    if (termoFiltro) {
      // Nota: Supabase não tem busca fulltext nativa, então aplicamos no lado do cliente
      const { data, error } = await query;
      if (error) throw error;

      const filtrados = (data || []).filter(s => {
        const nomeFiltro = normalizarTexto(s.nome);
        const matFiltro = normalizarTexto(s.matricula);
        return nomeFiltro.includes(termoFiltro) || matFiltro.includes(termoFiltro);
      });

      return NextResponse.json(filtrados.slice(0, 80));
    }

    const { data, error } = await query;
    if (error) throw error;

    return NextResponse.json(data || []);
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

/**
 * POST /api/servidores/frequencia
 * Cadastra novo servidor
 * Body: { nome, matricula, funcao, nivel?, lotacao? }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { nome, matricula, funcao, nivel, lotacao } = body;

    if (!nome) {
      return NextResponse.json(
        { error: 'Informe o nome do servidor' },
        { status: 400 }
      );
    }
    if (!funcao) {
      return NextResponse.json(
        { error: 'Informe a função do servidor' },
        { status: 400 }
      );
    }
    if (!matricula) {
      return NextResponse.json(
        { error: 'Informe a matrícula do servidor' },
        { status: 400 }
      );
    }

    // Verificar duplicação
    const { data: existing } = await supabase
      .from('servidores')
      .select('id')
      .eq('matricula', matricula)
      .single();

    if (existing) {
      return NextResponse.json(
        { error: `Já existe servidor cadastrado com a matrícula ${matricula}` },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from('servidores')
      .insert([
        {
          nome: String(nome).trim(),
          matricula: String(matricula).trim(),
          funcao: String(funcao).trim(),
          nivel: String(nivel || '').trim(),
          lotacao: String(lotacao || '').trim(),
          ativo: true
        }
      ])
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(data, { status: 201 });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
