/**
 * Normaliza texto removendo acentos, espaços duplicados e convertendo para maiúscula
 */
export function normalizarTexto(txt: string): string {
  return String(txt || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
}

/**
 * Formata data para formato brasileiro DD/MM/YYYY
 */
export function formatarDataBr(data: Date): string {
  return `${String(data.getDate()).padStart(2, '0')}/${String(data.getMonth() + 1).padStart(2, '0')}/${data.getFullYear()}`;
}

/**
 * Encontra índice de coluna pelo nome (com sinônimos)
 */
export function encontrarIndiceColuna(cabecalho: string[], opcoes: string[]): number {
  for (const opcao of opcoes) {
    const idx = cabecalho.findIndex(col => normalizarTexto(col) === normalizarTexto(opcao));
    if (idx >= 0) return idx;
  }
  return -1;
}

/**
 * Normaliza dias facultativos
 */
export function normalizarDiasFacultativos(
  dias: any[]
): { dia: number; descricao: string }[] {
  return (dias || [])
    .map(item =>
      typeof item === 'number' || typeof item === 'string'
        ? { dia: Number(item), descricao: 'FACULTATIVO' }
        : {
            dia: Number(item?.dia),
            descricao: String((item?.descricao) || 'FACULTATIVO').trim() || 'FACULTATIVO'
          }
    )
    .filter(item => Number.isInteger(item.dia) && item.dia >= 1 && item.dia <= 31);
}

/**
 * Calcula domingo de Páscoa usando algoritmo de Computus
 */
export function calcularDomingoPascoa(ano: number): Date {
  const a = ano % 19;
  const b = Math.floor(ano / 100);
  const c = ano % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31);
  const dia = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(ano, mes - 1, dia);
}

/**
 * Adiciona dias a uma data
 */
export function adicionarDias(data: Date, dias: number): Date {
  const d = new Date(data.getTime());
  d.setDate(d.getDate() + dias);
  return d;
}

/**
 * Obtém feriados nacionais (fallback - sem API)
 */
export function obterFeriadosNacionaisFallback(ano: number): Array<{
  ano: number;
  mes: number;
  dia: number;
  nome: string;
}> {
  const pascoa = calcularDomingoPascoa(ano);
  const fixos = [
    { mes: 1, dia: 1 }, // Ano novo
    { mes: 4, dia: 21 }, // Tiradentes
    { mes: 5, dia: 1 }, // Dia do trabalho
    { mes: 9, dia: 7 }, // Independência
    { mes: 10, dia: 12 }, // Nossa Senhora Aparecida
    { mes: 11, dia: 2 }, // Finados
    { mes: 11, dia: 15 }, // Proclamação da República
    { mes: 11, dia: 20 }, // Consciência negra
    { mes: 12, dia: 25 } // Natal
  ];

  const moveis = [
    adicionarDias(pascoa, -48), // Segunda de Carnaval
    adicionarDias(pascoa, -47), // Carnaval
    adicionarDias(pascoa, -2), // Sexta-feira Santa
    adicionarDias(pascoa, 60) // Corpus Christi
  ].map(d => ({ mes: d.getMonth() + 1, dia: d.getDate() }));

  return fixos
    .concat(moveis)
    .map(f => ({ ano, mes: f.mes, dia: f.dia, nome: 'FERIADO NACIONAL' }));
}

/**
 * Fetch JSON com tratamento de erro
 */
export async function fetchJsonApi(url: string): Promise<any> {
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (compatible; NextApp/1.0)',
        'Accept-Language': 'pt-BR,pt;q=0.9'
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error(`[API] Erro ao buscar ${url}:`, error);
    throw error;
  }
}
