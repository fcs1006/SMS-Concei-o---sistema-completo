import { createClient } from '@supabase/supabase-js';
import {
  formatarDataBr,
  obterFeriadosNacionaisFallback,
  normalizarDiasFacultativos,
  normalizarTexto
} from './helpers';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

/**
 * Monta objeto período de frequência
 */
export function montarPeriodoFrequencia(
  ano: number,
  mes: number,
  tipoPeriodo: string = 'competencia_23_22'
): {
  tipo: string;
  inicio: string;
  fim: string;
  referencia: string;
} {
  if (tipoPeriodo === 'mes_inteiro') {
    const inicio = new Date(ano, mes - 1, 1);
    const fim = new Date(ano, mes, 0);
    return {
      tipo: 'mes_inteiro',
      inicio: formatarDataBr(inicio),
      fim: formatarDataBr(fim),
      referencia: `${String(mes).padStart(2, '0')}/${ano}`
    };
  }

  // competencia_23_22: 23 do mês anterior até 22 do mês atual
  const inicio = new Date(ano, mes - 2, 23);
  const fim = new Date(ano, mes - 1, 22);

  return {
    tipo: 'competencia_23_22',
    inicio: formatarDataBr(inicio),
    fim: formatarDataBr(fim),
    referencia: `${String(inicio.getMonth() + 1).padStart(2, '0')}/${String(fim.getMonth() + 1).padStart(2, '0')} - ${fim.getFullYear()}`
  };
}

/**
 * Monta grade de período com feriados, fins de semana e facultativos
 */
export function montarGradePeriodoFrequencia(
  periodo: ReturnType<typeof montarPeriodoFrequencia>,
  diasFacultativos: Array<{ dia: number; descricao: string }> = []
): Array<{ dia: number; marcador: string; tipoMarcador: string }> {
  const mapaFac = construirMapaFacultativosPorDia(diasFacultativos || []);

  // Parse datas (string no formato DD/MM/YYYY)
  const parseData = (str: string) => {
    const [d, m, a] = str.split('/');
    return new Date(Number(a), Number(m) - 1, Number(d));
  };

  const dataInicio = parseData(periodo.inicio);
  const dataFim = parseData(periodo.fim);

  // Coleta todos os feriados dos anos envolvidos
  const anosEnvolvidos = new Set<number>();
  anosEnvolvidos.add(dataInicio.getFullYear());
  anosEnvolvidos.add(dataFim.getFullYear());

  const todosFeriados: Array<{ ano: number; mes: number; dia: number; nome: string }> = [];
  anosEnvolvidos.forEach(a => {
    todosFeriados.push(...obterFeriadosNacionaisFallback(a));
  });

  const resultado: Array<{ dia: number; marcador: string; tipoMarcador: string }> = [];
  const cursor = new Date(dataInicio.getFullYear(), dataInicio.getMonth(), dataInicio.getDate());

  while (cursor.getTime() <= dataFim.getTime()) {
    let marcador = '';
    let tipoMarcador = '';

    const diaSemana = cursor.getDay();
    const diaNumero = cursor.getDate();
    const mesCursor = cursor.getMonth() + 1;
    const anoCursor = cursor.getFullYear();

    // Domingos
    if (diaSemana === 0) {
      marcador = 'DOMINGO';
      tipoMarcador = 'DOMINGO';
    }
    // Sábados
    else if (diaSemana === 6) {
      marcador = 'SÁBADO';
      tipoMarcador = 'SABADO';
    }

    // Feriados nacionais
    const ehFeriado = todosFeriados.some(
      f => f.ano === anoCursor && f.mes === mesCursor && f.dia === diaNumero
    );
    if (ehFeriado) {
      marcador = 'FERIADO';
      tipoMarcador = 'FERIADO';
    }

    // Dias facultativos
    if (mapaFac[diaNumero]) {
      marcador = 'FACULTATIVO';
      tipoMarcador = 'FACULTATIVO';
    }

    resultado.push({ dia: diaNumero, marcador, tipoMarcador });
    cursor.setDate(cursor.getDate() + 1);
  }

  return resultado;
}

/**
 * Constrói mapa de facultativos por dia do mês
 */
function construirMapaFacultativosPorDia(
  facultativos: Array<{ dia: number; descricao: string }>
): Record<number, string | boolean> {
  const mapa: Record<number, string | boolean> = {};
  (facultativos || []).forEach(f => {
    if (f && f.dia) mapa[f.dia] = f.descricao || true;
  });
  return mapa;
}

/**
 * Verifica se servidor está em escala
 */
export async function ehEscala(matricula: string): Promise<boolean> {
  try {
    const matNorm = normalizarTexto(matricula);
    const { data } = await supabase
      .from('escala')
      .select('id')
      .eq('matricula_normalizada', matNorm)
      .single();

    return !!data;
  } catch {
    return false;
  }
}

/**
 * Limpa marcadores de dias
 */
export function limparMarcadoresDias(
  dias: Array<{ dia: number; marcador?: string; tipoMarcador?: string }>
): Array<{ dia: number; marcador: string; tipoMarcador: string }> {
  return (dias || []).map((item, i) => ({
    dia: Number(item?.dia) || i + 1,
    marcador: '',
    tipoMarcador: ''
  }));
}
