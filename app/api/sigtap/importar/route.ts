import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { execSync } from 'child_process'
import fs from 'fs'
import path from 'path'
import os from 'os'
import AdmZip from 'adm-zip'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
)

const FTP_BASE = 'ftp://ftp2.datasus.gov.br/pub/sistemas/tup/downloads'

// Lista competências disponíveis no FTP
export async function GET() {
  try {
    const lista = execSync(
      `curl -s --max-time 30 --list-only "${FTP_BASE}/"`,
      { encoding: 'utf8' }
    )
    const competencias = lista
      .split('\n')
      .filter(l => l.match(/TabelaUnificada_\d{6}/))
      .map(l => {
        const match = l.match(/TabelaUnificada_(\d{6})/)
        return match ? { competencia: match[1], arquivo: l.trim() } : null
      })
      .filter(Boolean)
      .sort((a: any, b: any) => b.competencia.localeCompare(a.competencia))

    // Competências já importadas
    const { data: importadas } = await supabase
      .from('sigtap_procedimentos')
      .select('competencia')
      .order('competencia', { ascending: false })
    const jaImportadas = [...new Set((importadas || []).map((d: any) => d.competencia))]

    return NextResponse.json({ ok: true, disponiveis: competencias, importadas: jaImportadas })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 })
  }
}

// Sincroniza uma competência do FTP para o Supabase
export async function POST(request: NextRequest) {
  try {
    const { competencia } = await request.json()
    if (!competencia || !/^\d{6}$/.test(competencia)) {
      return NextResponse.json({ ok: false, error: 'Competência inválida.' }, { status: 400 })
    }

    // Descobre o nome exato do arquivo no FTP (pode ter sufixo de versão)
    const lista = execSync(
      `curl -s --max-time 30 --list-only "${FTP_BASE}/"`,
      { encoding: 'utf8' }
    )
    const arquivoFtp = lista.split('\n').find(l => l.includes(`TabelaUnificada_${competencia}`))
    if (!arquivoFtp) {
      return NextResponse.json({ ok: false, error: `Competência ${competencia} não disponível no FTP do DATASUS.` }, { status: 404 })
    }

    // Baixa o zip
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sigtap-'))
    const zipPath = path.join(tmpDir, 'tabela.zip')
    execSync(`curl -s --max-time 120 "${FTP_BASE}/${arquivoFtp.trim()}" -o "${zipPath}"`)

    if (!fs.existsSync(zipPath) || fs.statSync(zipPath).size < 1000) {
      fs.rmSync(tmpDir, { recursive: true, force: true })
      return NextResponse.json({ ok: false, error: 'Falha ao baixar arquivo do FTP.' }, { status: 500 })
    }

    // Extrai tb_procedimento.txt usando adm-zip (sem dependência de binário externo)
    const zip = new AdmZip(zipPath)
    const entry = zip.getEntry('tb_procedimento.txt')
    if (!entry) {
      fs.rmSync(tmpDir, { recursive: true, force: true })
      return NextResponse.json({ ok: false, error: 'tb_procedimento.txt não encontrado no zip.' }, { status: 500 })
    }

    // Lê e processa — arquivo de posição fixa (layout SIGTAP)
    // CO_PROCEDIMENTO[1-10] NO_PROCEDIMENTO[11-260] TP_COMPLEXIDADE[261] TP_SEXO[262]
    // QT_MAXIMA_EXEC[263-266] QT_DIAS_PERM[267-270] QT_PONTOS[271-274]
    // VL_IDADE_MIN[275-278] VL_IDADE_MAX[279-282] VL_SH[283-294] VL_SA[295-306] VL_SP[307-318]
    // CO_FINANCIAMENTO[319-320] CO_RUBRICA[321-326] QT_TEMPO_PERM[327-330] DT_COMPETENCIA[331-336]
    const conteudo = entry.getData().toString('latin1')
    const linhas = conteudo.split('\n').filter(l => l.length >= 260)

    const registros: any[] = []
    for (const linha of linhas) {
      const co = linha.substring(0, 10).trim()
      const nome = linha.substring(10, 260).trim()
      if (!co || !nome) continue
      registros.push({
        co_procedimento:  co,
        no_procedimento:  nome,
        competencia,
        co_complexidade:  linha.substring(260, 261).trim() || null,
        co_sexo:          linha.substring(261, 262).trim() || null,
        vl_idade_minima:  parseInt(linha.substring(274, 278)) || null,
        vl_idade_maxima:  parseInt(linha.substring(278, 282)) || null,
        vl_sh:            parseFloat(linha.substring(282, 294)) / 100 || null,
        vl_sa:            parseFloat(linha.substring(294, 306)) / 100 || null,
        vl_sp:            parseFloat(linha.substring(306, 318)) / 100 || null,
        co_financiamento: linha.substring(318, 320).trim() || null,
      })
    }

    fs.rmSync(tmpDir, { recursive: true, force: true })

    if (registros.length === 0) {
      return NextResponse.json({ ok: false, error: 'Nenhum procedimento encontrado no arquivo.' }, { status: 400 })
    }

    // Remove competência antiga e reinsere
    await supabase.from('sigtap_procedimentos').delete().eq('competencia', competencia)

    const LOTE = 500
    let inseridos = 0
    for (let i = 0; i < registros.length; i += LOTE) {
      const { error } = await supabase.from('sigtap_procedimentos').insert(registros.slice(i, i + LOTE))
      if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
      inseridos += LOTE
    }

    return NextResponse.json({ ok: true, inseridos: registros.length, competencia })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 })
  }
}
