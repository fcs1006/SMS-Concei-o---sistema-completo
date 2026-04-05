import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { fetchJsonApi, normalizarTexto } from '@/app/api/utils/helpers';
import { TRANSPARENCIA_CONFIG } from '@/app/api/utils/constants';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

interface ServidorApi {
  nome: string;
  matricula: string;
  departamento: string;
  cargo: string;
  tipoDeVinculo: string;
  dataAdmissao: string;
  situacao: string;
}

/**
 * Mapeia servidor da API para formato interno
 */
function mapearServidorApi(item: ServidorApi) {
  return {
    nome: String(item.nome || '').trim(),
    matricula: String(item.matricula || '').trim(),
    lotacao: String(item.departamento || '').trim(),
    funcao: String(item.cargo || '').trim(),
    tipoVinculo: String(item.tipoDeVinculo || '').trim(),
    dataAdmissao: String(item.dataAdmissao || '').trim(),
    situacao: String(item.situacao || '').trim()
  };
}

/**
 * Busca página da API
 */
async function buscarPaginaApi(
  pagina: number,
  tamanho: number,
  ano: number,
  mes: number
): Promise<ServidorApi[]> {
  const mes2 = String(mes).padStart(2, '0');
  const url =
    `${TRANSPARENCIA_CONFIG.URL_API_PAGINADO}` +
    `?pagina=${pagina}&tamanhoDaPagina=${tamanho}` +
    `&ano=${ano}&mes=${mes2}` +
    `&codigoDoOrgao=${TRANSPARENCIA_CONFIG.CODIGO_ORGAO_SAUDE}`;

  console.log(`[API] Página ${pagina} — ${url}`);

  const dados = await fetchJsonApi(url);
  if (!dados) return [];

  const registros = Array.isArray(dados.registros) ? dados.registros : [];
  return registros;
}

/**
 * POST /api/transparencia/sync
 * Sincroniza servidores do portal de transparência com a base local
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    let { ano, mes } = body;

    // Se não informado, usa mês/ano atual
    if (!ano || !mes) {
      const hoje = new Date();
      ano = ano || hoje.getFullYear();
      mes = mes || hoje.getMonth() + 1;
    }

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

    console.log(`[Transparência] Iniciando sincronização ${String(mes).padStart(2, '0')}/${ano}`);

    // Buscar todos servidores da API (paginado)
    const tamanho = TRANSPARENCIA_CONFIG.TAMANHO_PAGINA;
    const todos: ServidorApi[] = [];
    let pagina = 1;
    let totalEsperado: number | null = null;

    while (true) {
      const registros = await buscarPaginaApi(pagina, tamanho, ano, mes);
      if (!registros?.length) break;

      todos.push(...registros);

      // Se a primeira página define total, para quando atingir
      if (totalEsperado === null && registros.length > 0) {
        totalEsperado = todos.length; // Será ajustado quando soubermos o total real
      }

      if (registros.length < tamanho) break; // Última página
      if (todos.length >= 5000) break; // Limite de segurança
      pagina++;
    }

    if (!todos.length) {
      return NextResponse.json(
        {
          error: `Nenhum servidor encontrado na API para ${String(mes).padStart(2, '0')}/${ano}. Verifique se a competência já está publicada.`
        },
        { status: 404 }
      );
    }

    console.log(`[Transparência] Total obtidos: ${todos.length}`);

    // Mapear servidores
    const servidoresPortal = todos
      .map(mapearServidorApi)
      .filter(s => s.nome && s.matricula);

    // Sincronizar com base local
    const resumo = await atualizarBaseFpComServidoresPortal(
      servidoresPortal,
      ano,
      mes
    );

    return NextResponse.json({
      competencia: `${String(mes).padStart(2, '0')}/${ano}`,
      origem: TRANSPARENCIA_CONFIG.URL_API_PAGINADO,
      totalPortal: servidoresPortal.length,
      totalInseridos: resumo.inseridos,
      totalAtualizados: resumo.atualizados,
      totalIgnorados: resumo.ignorados,
      totalInativos: resumo.inativos
    });
  } catch (error: any) {
    console.error('[Transparência] Erro:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

/**
 * Atualiza base FP com servidores do portal
 * Regra: PRESTADORES nunca são alterados pela sync
 */
async function atualizarBaseFpComServidoresPortal(
  servidoresPortal: ReturnType<typeof mapearServidorApi>[],
  ano: number,
  mes: number
) {
  // Buscar servidores existentes
  const { data } = await supabase
    .from('servidores')
    .select('*')
    .order('id');
  const existentes = data ?? [];

  // Mapa matrícula normalizada → servidor
  const mapaPorMatricula: Record<string, any> = {};
  existentes.forEach(srv => {
    const matNorm = normalizarTexto(srv.matricula);
    if (matNorm) mapaPorMatricula[matNorm] = srv;
  });

  // Conjunto de matrículas do portal
  const matriculasPortal = new Set(
    servidoresPortal
      .map(s => normalizarTexto(s.matricula))
      .filter(Boolean)
  );

  let inseridos = 0;
  let atualizados = 0;
  let ignorados = 0;
  let inativos = 0;

  const obsTexto = (tipo: string) => `${tipo} via Portal ${String(mes).padStart(2, '0')}/${ano}`;

  // Processar servidores do portal
  for (const srv of servidoresPortal) {
    const matNorm = normalizarTexto(srv.matricula);
    if (!matNorm) {
      ignorados++;
      continue;
    }

    const existente = mapaPorMatricula[matNorm];

    if (existente) {
      // Atualizar existente
      const { error } = await supabase
        .from('servidores')
        .update({
          nome: srv.nome,
          matricula: srv.matricula,
          lotacao: srv.lotacao,
          funcao: srv.funcao,
          dataAdmissao: srv.dataAdmissao,
          tipoVinculo: srv.tipoVinculo,
          situacao: srv.situacao,
          status: 'ATIVO',
          obs: obsTexto('Atualizado'),
          atualizadoEm: new Date().toISOString()
        })
        .eq('id', existente.id);

      if (error) throw error;
      atualizados++;
    } else {
      // Inserir novo
      const { error } = await supabase
        .from('servidores')
        .insert([
          {
            nome: srv.nome,
            matricula: srv.matricula,
            lotacao: srv.lotacao,
            funcao: srv.funcao,
            dataAdmissao: srv.dataAdmissao,
            tipoVinculo: srv.tipoVinculo,
            situacao: srv.situacao,
            status: 'ATIVO',
            obs: obsTexto('Inserido'),
            ativo: true,
            criadoEm: new Date().toISOString()
          }
        ]);

      if (error) throw error;
      inseridos++;
    }
  }

  // Marcar como inativos quem não está no portal
  // EXCETO prestadores (NIVEL = PRESTADOR)
  for (const existente of existentes) {
    const matNorm = normalizarTexto(existente.matricula);
    if (!matNorm) continue;

    // Proteger prestadores
    const nivelNorm = normalizarTexto(existente.nivel || '');
    if (nivelNorm === 'PRESTADOR') continue;

    // Se não consta no portal, marca como inativo
    if (!matriculasPortal.has(matNorm)) {
      const { error } = await supabase
        .from('servidores')
        .update({
          status: 'INATIVO',
          obs: obsTexto('Inativo — não consta no portal'),
          atualizadoEm: new Date().toISOString()
        })
        .eq('id', existente.id);

      if (error) throw error;
      inativos++;
    }
  }

  console.log(
    `[Sync] Inseridos: ${inseridos} | Atualizados: ${atualizados} | Inativos: ${inativos} | Ignorados: ${ignorados}`
  );

  return { inseridos, atualizados, ignorados, inativos };
}
