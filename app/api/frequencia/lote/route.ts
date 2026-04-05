import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import {
  montarPeriodoFrequencia,
  montarGradePeriodoFrequencia,
  limparMarcadoresDias
} from '@/app/api/utils/frequencia';
import { FREQUENCIA_CONFIG } from '@/app/api/utils/constants';
import { normalizarTexto } from '@/app/api/utils/helpers';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

interface GerarLoteRequest {
  mes: number;
  ano: number;
  modo: 'branco' | 'preenchida';
  tipoPeriodo?: string;
  diasFacultativos?: Array<{ dia: number; descricao: string }>;
}

/**
 * POST /api/frequencia/lote
 * Gera frequências em lote para todos os servidores
 */
export async function POST(request: NextRequest) {
  try {
    const body: GerarLoteRequest = await request.json();
    const {
      mes,
      ano,
      modo = 'preenchida',
      tipoPeriodo = 'competencia_23_22',
      diasFacultativos = []
    } = body;

    // Validações
    if (!mes || mes < 1 || mes > 12) {
      return NextResponse.json(
        { error: 'Mês inválido (1-12)' },
        { status: 400 }
      );
    }
    if (!ano || ano < 2000) {
      return NextResponse.json(
        { error: 'Ano inválido' },
        { status: 400 }
      );
    }
    if (modo !== 'branco' && modo !== 'preenchida') {
      return NextResponse.json(
        { error: 'Modo inválido. Use "branco" ou "preenchida"' },
        { status: 400 }
      );
    }

    // Buscar todos os servidores ativos
    const { data: servidores, error: serverError } = await supabase
      .from('servidores')
      .select('*')
      .eq('ativo', true)
      .neq('status', 'INATIVO')
      .order('nome');

    if (serverError) throw serverError;
    if (!servidores?.length) {
      return NextResponse.json(
        { error: 'Nenhum servidor ativo encontrado' },
        { status: 404 }
      );
    }

    // Buscar escala
    const { data: escala = [] } = await supabase
      .from('escala')
      .select('matricula_normalizada');

    const escalaSet = new Set(escala.map(s => s.matricula_normalizada));

    // Filtrar servidor conforme modo
    const filtrados = servidores.filter(srv => {
      const estaEmEscala = escalaSet.has(normalizarTexto(srv.matricula));
      return modo === 'branco' ? estaEmEscala : !estaEmEscala;
    });

    if (!filtrados.length) {
      return NextResponse.json({
        modo,
        criterio:
          modo === 'branco'
            ? 'ESCALA — folha em branco'
            : 'Seg–Sex — folha com feriados e fins de semana',
        total: 0,
        totalBase: servidores.length,
        mesReferencia: '',
        tipoPeriodo,
        espelhos: []
      });
    }

    // Montar período e grades
    const periodo = montarPeriodoFrequencia(ano, mes, tipoPeriodo);
    const gradeBase = montarGradePeriodoFrequencia(periodo, diasFacultativos);
    const gradeVazia = limparMarcadoresDias(gradeBase);

    // Gerar espelhos
    const espelhos = filtrados.map(servidor => ({
      id: servidor.id,
      nome: servidor.nome,
      matricula: servidor.matricula,
    lotacao: servidor.lotacao || '',
      funcao: servidor.funcao,
      mesReferencia: periodo.referencia,
      periodoInicio: periodo.inicio,
      periodoFim: periodo.fim,
      tipoPeriodo: periodo.tipo,
      cnpj: FREQUENCIA_CONFIG.CNPJ_PADRAO,
      dias: JSON.parse(JSON.stringify(modo === 'branco' ? gradeVazia : gradeBase))
    }));

    return NextResponse.json({
      modo,
      criterio:
        modo === 'branco'
          ? 'ESCALA — folha em branco'
          : 'Seg–Sex — folha com feriados e fins de semana',
      total: espelhos.length,
      totalBase: servidores.length,
      mesReferencia: periodo.referencia,
      tipoPeriodo: periodo.tipo,
      espelhos
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
