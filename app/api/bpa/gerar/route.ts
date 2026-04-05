import { NextRequest, NextResponse } from 'next/server'

function padNum(v: any, t: number) {
  const s = String(v).replace(/\D/g, '')
  return s.padStart(t, '0').slice(-t)
}

function padNumEsp(v: any, t: number) {
  const s = String(v).replace(/\D/g, '')
  if (!s) return ' '.repeat(t)
  return s.padStart(t, '0').substring(0, t)
}

function padTxt(v: any, t: number) {
  const s = String(v || '').toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Z0-9 ]/g, ' ')
  return s.padEnd(t, ' ').substring(0, t)
}

function formatarDataYMD(dataStr: string) {
  // entrada: DD/MM/YYYY → saída: YYYYMMDD
  const partes = String(dataStr || '').replace(/\D/g, '')
  if (partes.length === 8) {
    const dd = partes.substring(0, 2)
    const mm = partes.substring(2, 4)
    const yyyy = partes.substring(4, 8)
    if (parseInt(dd) <= 31) return yyyy + mm + dd
  }
  return '00000000'
}

function montarRegistro02(r: any, folha: number, seq: number) {
  let txt = '02'
  txt += padNum(r.cnes, 7)
  txt += padNum(r.competencia, 6)
  txt += padNum(r.cbo, 6)
  txt += padNum(folha, 3)
  txt += padNum(seq, 2)
  txt += padNum(r.procedimento, 10)
  txt += padNum(r.idade || 0, 3)
  txt += padNum(r.quantidade, 6)
  txt += padTxt(r.origem, 3)
  return txt
}

function montarRegistro03(r: any, folha: number, seq: number) {
  let txt = '03'
  txt += padNum(r.cnes, 7)
  txt += padNum(r.competencia, 6)
  txt += padNum(r.cnsProfissional, 15)
  txt += padNum(r.cbo, 6)
  txt += formatarDataYMD(r.dataAtendimento)
  txt += padNum(folha, 3)
  txt += padNum(seq, 2)
  txt += padNum(r.procedimento, 10)
  txt += padNumEsp(r.cnsPaciente, 15)
  txt += padTxt(r.sexo, 1)
  txt += padNum(r.ibge, 6)
  txt += padTxt(r.cid, 4)
  txt += padNum(r.idade, 3)
  txt += padNum(r.quantidade, 6)
  txt += padNum(r.carater, 2)
  const aut = String(r.autorizacao || '').replace(/\D/g, '')
  txt += aut ? padNum(aut, 13) : ' '.repeat(13)
  txt += padTxt(r.origem, 3)
  txt += padTxt(r.nomePaciente, 30)
  txt += formatarDataYMD(r.dtNascimento)
  txt += padNum(r.raca, 2)
  txt += '    '           // etnia
  txt += padNum(r.nacionalidade, 3)
  txt += ' '.repeat(32)   // serviço
  txt += padNum(r.cep, 8)
  txt += padNum(r.codLogradouro, 3)
  txt += padTxt(r.endereco, 30)
  txt += padTxt(r.complemento, 10)
  txt += padTxt(r.numero, 5)
  txt += padTxt(r.bairro, 30)
  txt += padNum(r.telefone, 11)
  txt += padTxt(r.email, 40)
  txt += padNumEsp(r.ine, 10)
  txt += padNumEsp(r.cpf, 11)
  txt += padTxt(r.categoria, 1)
  return txt
}

export async function POST(request: NextRequest) {
  try {
    const { competencia, consolidados, prefixoArquivo } = await request.json()

    if (!consolidados?.length) {
      return NextResponse.json({ error: 'Nenhum registro consolidado para gerar.' }, { status: 400 })
    }

    const totalLinhas = consolidados.length
    const maxFolha = Math.ceil(totalLinhas / 99) || 1

    let somaProcedimentos = 0
    let somaQtd = 0
    for (const r of consolidados) {
      somaProcedimentos += parseInt(String(r.procedimento).replace(/\D/g, '') || '0') || 0
      somaQtd += parseInt(String(r.quantidade).replace(/\D/g, '') || '0') || 0
    }
    const campoControle = ((somaProcedimentos + somaQtd) % 1111) + 1111

    let txt = '01#BPA#'
      + padNum(competencia, 6)
      + padNum(totalLinhas, 6)
      + padNum(maxFolha, 6)
      + padNum(campoControle, 4)
      + ' '.repeat(36)
      + '00000000000000'
      + ' '.repeat(41)
      + 'D04.10\r\n'

    let folha = 1
    let seq = 0

    for (const r of consolidados) {
      seq++
      if (seq > 99) { folha++; seq = 1 }
      const linha = r.tipo === '02'
        ? montarRegistro02(r, folha, seq)
        : montarRegistro03(r, folha, seq)
      if (linha) txt += linha + '\r\n'
    }

    const nomeArquivo = `${prefixoArquivo || 'BPA'}_${competencia}.txt`

    return NextResponse.json({
      ok: true,
      nomeArquivo,
      conteudo: Buffer.from(txt, 'utf-8').toString('base64')
    })
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }
}
