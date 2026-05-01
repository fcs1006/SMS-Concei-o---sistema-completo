import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { normalizarTexto } from '@/app/api/utils/helpers';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

/**
 * GET /api/escala
 * Lista todos os servidores em escala
 */
export async function GET(request: NextRequest) {
  try {
    const { data, error } = await supabase
      .from('escala')
      .select('*')
      .order('nome');

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
 * POST /api/escala
 * Adiciona ou remove servidor da escala
 * Body: { matricula, nome, remover?: boolean }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { matricula, nome, remover } = body;

    if (!matricula) {
      return NextResponse.json(
        { error: 'Matrícula não informada' },
        { status: 400 }
      );
    }

    const matNorm = normalizarTexto(matricula);

    if (remover) {
      const { error } = await supabase
        .from('escala')
        .delete()
        .eq('matricula_normalizada', matNorm);

      if (error) throw error;

      return NextResponse.json({
        matricula,
        nome: nome || '',
        emEscala: false,
        acao: 'removido'
      });
    } else {
      // Verificar se já existe
      const { data: existing } = await supabase
        .from('escala')
        .select('id')
        .eq('matricula_normalizada', matNorm)
        .single();

      if (!existing) {
        const { error } = await supabase
          .from('escala')
          .insert([
            {
              matricula: String(matricula).trim(),
              matricula_normalizada: matNorm,
              nome: String(nome || '').trim()
            }
          ]);

        if (error) throw error;
      }

      return NextResponse.json({
        matricula,
        nome: String(nome || '').trim(),
        emEscala: true,
        acao: 'adicionado'
      });
    }
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
