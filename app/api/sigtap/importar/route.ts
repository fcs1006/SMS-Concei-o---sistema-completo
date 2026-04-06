import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
)

// POST /api/sigtap/importar
// Body: FormData com campo "arquivo" (tb_procedimento.txt) e "competencia" (AAAAMM)
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const arquivo = formData.get('arquivo') as File | null
    const competencia = (formData.get('competencia') as string || '').trim()

    if (!arquivo) return NextResponse.json({ ok: false, error: 'Arquivo não enviado.' }, { status: 400 })
    if (!/^\d{6}$/.test(competencia)) return NextResponse.json({ ok: false, error: 'Competência inválida. Use AAAAMM (ex: 202604).' }, { status: 400 })

    const texto = await arquivo.text()
    const linhas = texto.split('\n').filter(l => l.trim())

    // O arquivo tb_procedimento.txt do SIGTAP é separado por ";"
    // Colunas: CO_PROCEDIMENTO;NO_PROCEDIMENTO;DT_COMPETENCIA;CO_REGISTRO;QT_MAXIMA_EXECUCAO;
    //          QT_DIAS_PERMANENCIA;QT_PONTOS;VL_IDADE_MINIMA;VL_IDADE_MAXIMA;CO_FINANCIAMENTO;
    //          CO_COMPLEXIDADE;CO_SEXO;VL_SH;VL_SA;VL_SP;...

    const registros: any[] = []
    let pulados = 0

    for (const linha of linhas) {
      // Suporte a separador ; ou tab ou pipe
      const sep = linha.includes(';') ? ';' : linha.includes('\t') ? '\t' : '|'
      const cols = linha.split(sep).map(c => c.trim().replace(/^"|"$/g, ''))

      const co = cols[0]?.replace(/\D/g, '')
      const nome = cols[1]?.trim()

      if (!co || co.length < 8 || !nome) { pulados++; continue }

      registros.push({
        co_procedimento: co.slice(0, 10),
        no_procedimento: nome.toUpperCase(),
        competencia,
        co_complexidade:  cols[10] || null,
        co_financiamento: cols[9]  || null,
        co_sexo:          cols[11] || null,
        vl_idade_minima:  parseFloat(cols[7])  || null,
        vl_idade_maxima:  parseFloat(cols[8])  || null,
        vl_sh:            parseFloat(cols[12]) || null,
        vl_sa:            parseFloat(cols[13]) || null,
        vl_sp:            parseFloat(cols[14]) || null,
      })
    }

    if (registros.length === 0) {
      return NextResponse.json({ ok: false, error: 'Nenhum procedimento válido encontrado no arquivo.' }, { status: 400 })
    }

    // Remove registros anteriores da mesma competência e reinsere
    const { error: delErr } = await supabase
      .from('sigtap_procedimentos')
      .delete()
      .eq('competencia', competencia)

    if (delErr) return NextResponse.json({ ok: false, error: delErr.message }, { status: 500 })

    // Insere em lotes de 500
    const LOTE = 500
    let inseridos = 0
    for (let i = 0; i < registros.length; i += LOTE) {
      const lote = registros.slice(i, i + LOTE)
      const { error } = await supabase.from('sigtap_procedimentos').insert(lote)
      if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
      inseridos += lote.length
    }

    return NextResponse.json({ ok: true, inseridos, pulados, competencia })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 })
  }
}
