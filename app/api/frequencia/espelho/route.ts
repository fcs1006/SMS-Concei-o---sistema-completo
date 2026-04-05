import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import {
  montarPeriodoFrequencia,
  montarGradePeriodoFrequencia,
  ehEscala
} from '../../utils/frequencia';
import { FREQUENCIA_CONFIG } from '../../utils/constants';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

interface GerarEspelhoRequest {
  mes: number;
  ano: number;
  servidorId?: number;
  matricula?: string;
  tipoPeriodo?: string;
  diasFacultativos?: Array<{ dia: number; descricao: string }>;
}

/**
 * POST /api/frequencia/espelho
 * Gera espelho individual de frequência para um servidor
 */
export async function POST(request: NextRequest) {
  try {
    const body: GerarEspelhoRequest = await request.json();
    const { mes, ano, servidorId, matricula, tipoPeriodo = 'competencia_23_22', diasFacultativos = [] } = body;

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
    if (!servidorId && !matricula) {
      return NextResponse.json(
        { error: 'Informe servidorId ou matrícula' },
        { status: 400 }
      );
    }

    // Buscar servidor
    let query = supabase.from('servidores').select('*');
    if (servidorId) {
      query = query.eq('id', servidorId);
    } else if (matricula) {
      query = query.eq('matricula', matricula);
    }

    const { data: servidores, error: queryError } = await query;
    if (queryError) throw queryError;

    const servidor = servidores?.[0];
    if (!servidor) {
      return NextResponse.json(
        { error: 'Servidor não encontrado' },
        { status: 404 }
      );
    }

    // Montar período
    const periodo = montarPeriodoFrequencia(ano, mes, tipoPeriodo);
    let dias = montarGradePeriodoFrequencia(periodo, diasFacultativos);

    // Se servidor está em escala, limpa os marcadores
    const emEscala = await ehEscala(servidor.matricula);
    if (emEscala) {
      dias = dias.map((d: { dia: number; marcador: string; tipoMarcador: string }) => ({
        ...d,
        marcador: '',
        tipoMarcador: ''
      }));
    }

    return NextResponse.json({
      nome: servidor.nome,
      matricula: servidor.matricula,
      lotacao: servidor.lotacao || '',
      funcao: servidor.funcao || '',
      mesReferencia: periodo.referencia,
      periodoInicio: periodo.inicio,
      periodoFim: periodo.fim,
      tipoPeriodo: periodo.tipo,
      cnpj: FREQUENCIA_CONFIG.CNPJ_PADRAO,
      dias,
      emEscala
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
