import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { normalizarTexto } from '@/app/api/utils/helpers';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

interface RelatorioServidor {
  nome: string;
  funcao: string;
}

/**
 * GET /api/relatorio
 * Busca relatório de frequência separando servidores ativos de prestadores
 */
export async function GET(request: NextRequest) {
  try {
    const { data, error } = await supabase
      .from('servidores')
      .select('nome, funcao, nivel')
      .eq('ativo', true)
      .order('nome');

    if (error) throw error;

    const geral: RelatorioServidor[] = [];
    const prestador: RelatorioServidor[] = [];

    (data || []).forEach(servidor => {
      if (!servidor.nome) return;

      const item: RelatorioServidor = {
        nome: servidor.nome,
        funcao: servidor.funcao || ''
      };

      const nivelNorm = normalizarTexto(servidor.nivel || '');
      if (nivelNorm === 'PRESTADOR') {
        prestador.push(item);
      } else {
        geral.push(item);
      }
    });

    return NextResponse.json({
      geral: geral.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')),
      prestador: prestador.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
