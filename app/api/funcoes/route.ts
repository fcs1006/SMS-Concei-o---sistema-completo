import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

/**
 * GET /api/funcoes
 * Retorna lista de funções/cargos únicos de servidores
 */
export async function GET(request: NextRequest) {
  try {
    const { data, error } = await supabase
      .from('servidores')
      .select('funcao')
      .eq('ativo', true)
      .not('funcao', 'is', null)
      .not('funcao', 'eq', '');

    if (error) throw error;

    // Remover duplicatas e ordenar
    const unicas = [...new Set(data?.map(s => s.funcao).filter(Boolean))]
      .sort((a, b) => a.localeCompare(b, 'pt-BR'));

    return NextResponse.json(unicas);
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
