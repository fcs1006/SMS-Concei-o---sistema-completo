import { getSupabaseServer } from '@/lib/supabaseServer'
import {
  buscarDataAtualizacaoPortal,
  buscarTodosServidoresApi,
  normalizarCompetenciaTransparencia,
  sincronizarServidoresNoSupabase
} from '@/lib/frequencia/transparencia'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const atualizacao = await buscarDataAtualizacaoPortal()
    return Response.json({ ok: true, atualizacao })
  } catch (error) {
    return Response.json(
      { ok: false, error: error.message || 'Erro ao consultar portal.' },
      { status: 500 }
    )
  }
}

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}))
    const competencia = normalizarCompetenciaTransparencia(body?.ano, body?.mes)
    const servidoresPortal = await buscarTodosServidoresApi(competencia.ano, competencia.mes)

    if (!servidoresPortal.length) {
      return Response.json(
        {
          ok: false,
          error: `Nenhum servidor encontrado no portal para ${String(competencia.mes).padStart(2, '0')}/${competencia.ano}.`
        },
        { status: 404 }
      )
    }

    const supabase = getSupabaseServer()
    const resumo = await sincronizarServidoresNoSupabase(supabase, servidoresPortal)
    const atualizacao = await buscarDataAtualizacaoPortal().catch(() => '')

    return Response.json({
      ok: true,
      competencia: `${String(competencia.mes).padStart(2, '0')}/${competencia.ano}`,
      atualizacaoPortal: atualizacao,
      totalPortal: servidoresPortal.length,
      totalInseridos: resumo.inseridos,
      totalAtualizados: resumo.atualizados,
      totalIgnorados: resumo.ignorados,
      totalInativos: resumo.inativos
    })
  } catch (error) {
    return Response.json(
      { ok: false, error: error.message || 'Erro ao sincronizar servidores.' },
      { status: 500 }
    )
  }
}
