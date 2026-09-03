import { NextRequest, NextResponse } from 'next/server'
import { PDFDocument, rgb, StandardFonts, PDFPage, PDFFont } from 'pdf-lib'

const PAGE_HEIGHT = 841.89 // A4 height in points

function drawRect(
  page: PDFPage,
  x: number,
  y: number,
  width: number,
  height: number,
  options?: { fill?: any; stroke?: any; borderWidth?: number }
) {
  const yBottom = PAGE_HEIGHT - y - height
  page.drawRectangle({
    x,
    y: yBottom,
    width,
    height,
    borderWidth: options?.borderWidth ?? 0.75,
    borderColor: options?.stroke ?? rgb(0, 0, 0),
    color: options?.fill
  })
}

function drawText(
  page: PDFPage,
  text: string,
  x: number,
  y: number,
  options: {
    font: PDFFont
    size: number
    color?: any
    width?: number
    align?: 'left' | 'center' | 'right'
  }
) {
  if (!text) return
  const str = String(text)
  const size = options.size
  const font = options.font
  const color = options.color ?? rgb(0, 0, 0)

  let targetX = x
  if (options.align === 'center' && options.width) {
    const textWidth = font.widthOfTextAtSize(str, size)
    targetX = x + Math.max(0, (options.width - textWidth) / 2)
  } else if (options.align === 'right' && options.width) {
    const textWidth = font.widthOfTextAtSize(str, size)
    targetX = x + Math.max(0, options.width - textWidth)
  }

  const yBaseline = PAGE_HEIGHT - y - size * 0.82

  page.drawText(str, {
    x: targetX,
    y: yBaseline,
    size,
    font,
    color
  })
}

function drawWrappedText(
  page: PDFPage,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  font: PDFFont,
  size: number,
  color = rgb(0, 0, 0),
  lineHeight = size * 1.25
) {
  if (!text) return
  const words = text.split(/\s+/)
  let currentLine = ''
  let currentY = y

  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word
    const testWidth = font.widthOfTextAtSize(testLine, size)
    if (testWidth > maxWidth && currentLine) {
      drawText(page, currentLine, x, currentY, { font, size, color })
      currentLine = word
      currentY += lineHeight
    } else {
      currentLine = testLine
    }
  }
  if (currentLine) {
    drawText(page, currentLine, x, currentY, { font, size, color })
  }
}

async function generateAPACPDF(data: any): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create()
  const page = pdfDoc.addPage([595.28, PAGE_HEIGHT])

  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
  const fontOblique = await pdfDoc.embedFont(StandardFonts.HelveticaOblique)

  const drawSectionTitle = (title: string, y: number) => {
    drawRect(page, 20, y, 555, 12, { fill: rgb(0, 0, 0) })
    drawText(page, title.toUpperCase(), 25, y + 2, {
      font: fontBold,
      size: 8.5,
      color: rgb(1, 1, 1),
      width: 545,
      align: 'center'
    })
  }

  const drawField = (
    label: string,
    value: string | number | null | undefined,
    x: number,
    y: number,
    width: number,
    height: number,
    align: 'left' | 'center' | 'right' = 'left',
    valFontSize = 10.5
  ) => {
    drawRect(page, x, y, width, height)

    drawText(page, label.toUpperCase(), x + 3, y + 2.5, {
      font: fontBold,
      size: 6.8,
      color: rgb(0, 0, 0),
      width: width - 6
    })

    if (value !== undefined && value !== null && value !== '') {
      const valStr = String(value).toUpperCase().trim().replace(/\s+/g, ' ')

      let currentSize = valFontSize
      let textWidth = fontRegular.widthOfTextAtSize(valStr, currentSize)

      while (textWidth > width - 8 && currentSize > 6.5) {
        currentSize -= 0.5
        textWidth = fontRegular.widthOfTextAtSize(valStr, currentSize)
      }

      const yVal = y + 11.5 + (valFontSize - currentSize) * 0.35

      drawText(page, valStr, x + 4, yVal, {
        font: fontRegular,
        size: currentSize,
        color: rgb(0, 0, 0),
        width: width - 8,
        align
      })
    }
  }

  const drawTextArea = (
    label: string,
    value: string | null | undefined,
    x: number,
    y: number,
    width: number,
    height: number
  ) => {
    drawRect(page, x, y, width, height)
    drawText(page, label.toUpperCase(), x + 3, y + 3, {
      font: fontBold,
      size: 7,
      color: rgb(0, 0, 0),
      width: width - 6
    })

    if (value) {
      const valStr = String(value).toUpperCase().trim().replace(/\s+/g, ' ')
      drawWrappedText(page, valStr, x + 4, y + 13, width - 8, fontRegular, 9, rgb(0, 0, 0), 11)
    }
  }

  // ─── CABEÇALHO (y: 20 a 55) ───
  drawRect(page, 20, 20, 100, 35)
  drawText(page, 'SUS', 25, 22, { font: fontBold, size: 13, align: 'center', width: 90 })
  drawText(page, 'Sistema', 25, 33, { font: fontBold, size: 6.5, align: 'center', width: 45 })
  drawText(page, 'Único de', 25, 40, { font: fontBold, size: 6.5, align: 'center', width: 45 })
  drawText(page, 'Saúde', 25, 47, { font: fontBold, size: 6.5, align: 'center', width: 45 })

  drawText(page, 'Ministério', 70, 33, { font: fontBold, size: 6.5, align: 'center', width: 45 })
  drawText(page, 'da', 70, 40, { font: fontBold, size: 6.5, align: 'center', width: 45 })
  drawText(page, 'Saúde', 70, 47, { font: fontBold, size: 6.5, align: 'center', width: 45 })

  // Título
  drawRect(page, 120, 20, 410, 35)
  drawText(page, 'LAUDO PARA SOLICITAÇÃO/AUTORIZAÇÃO DE', 125, 25, { font: fontBold, size: 11, align: 'center', width: 400 })
  drawText(page, 'PROCEDIMENTO AMBULATORIAL', 125, 39, { font: fontBold, size: 11, align: 'center', width: 400 })

  // Folhas fls.
  drawRect(page, 530, 20, 45, 35)
  drawText(page, 'fls.1/2', 530, 32, { font: fontBold, size: 10, align: 'center', width: 45 })

  // ─── IDENTIFICAÇÃO DO ESTABELECIMENTO SOLICITANTE (y: 60 a 97) ───
  drawSectionTitle('IDENTIFICAÇÃO DO ESTABELECIMENTO DE SAÚDE (SOLICITANTE)', 60)
  drawField('1 - NOME DO ESTABELECIMENTO DE SAÚDE SOLICITANTE', data.estabelecimentoSolicitante, 20, 72, 455, 25)
  drawField('2 - CNES', data.cnesSolicitante, 475, 72, 100, 25, 'center')

  // ─── IDENTIFICAÇÃO DO PACIENTE (y: 105 a 242) ───
  drawSectionTitle('IDENTIFICAÇÃO DO PACIENTE', 105)
  // Linha 1
  drawField('3 - NOME DO PACIENTE', data.nomePaciente, 20, 117, 455, 25)
  drawField('4 - Nº DO PRONTUÁRIO', data.numeroProntuario || '', 475, 117, 100, 25, 'center')
  // Linha 2
  const formattedDate = data.dataNascimento
    ? new Date(data.dataNascimento).toLocaleDateString('pt-BR', { timeZone: 'UTC' })
    : ''
  drawField('5 - CARTÃO NACIONAL DE SAÚDE (CNS)', data.cnsPaciente, 20, 142, 255, 25, 'center')
  drawField('6 - DATA DE NASCIMENTO', formattedDate, 275, 142, 130, 25, 'center')

  const sexoFmt =
    data.sexo === 'M'
      ? 'MASC. [X]   FEM. [ ]'
      : data.sexo === 'F'
      ? 'MASC. [ ]   FEM. [X]'
      : 'MASC. [ ]   FEM. [ ]'
  drawField('7 - SEXO', sexoFmt, 405, 142, 170, 25, 'center')

  // Linha 3
  drawField('8 - NOME DA MÃE OU RESPONSÁVEL', data.nomeMae, 20, 167, 385, 25)
  drawField('9 - TELEFONE DE CONTATO', data.telefone, 405, 167, 170, 25, 'center')

  // Linha 4
  drawField('10 - ENDEREÇO (RUA, Nº, BAIRRO)', data.enderecoPaciente || '', 20, 192, 555, 25)

  // Linha 5
  drawField('11 - MUNICÍPIO DE RESIDÊNCIA', data.municipioPaciente || 'CONCEIÇÃO DO TOCANTINS', 20, 217, 220, 25)
  drawField('12 - CÓD. IBGE MUNICÍPIO', data.codigoIbge || '1705607', 240, 217, 120, 25, 'center')
  drawField('13 - UF', data.ufPaciente || 'TO', 360, 217, 45, 25, 'center')
  drawField('14 - CEP', data.cep || '', 405, 217, 170, 25, 'center')

  // ─── PROCEDIMENTO SOLICITADO (y: 250 a 287) ───
  drawSectionTitle('PROCEDIMENTO SOLICITADO', 250)
  drawField('15 - CÓDIGO DO PROCEDIMENTO PRINCIPAL', data.codigoSigtap, 20, 262, 180, 25, 'center')
  drawField('16 - NOME DO PROCEDIMENTO PRINCIPAL', data.descricaoProcedimento, 200, 262, 320, 25)
  drawField('17 - QTDE.', data.quantidade || '1', 520, 262, 55, 25, 'center')

  // ─── PROCEDIMENTO(S) SECUNDÁRIO(S) (y: 295 a 432) ───
  drawSectionTitle('PROCEDIMENTO(S) SECUNDÁRIO(S)', 295)

  const secList = data.procedimentosSecundarios || []
  const rowsSec = [
    [18, 19, 20],
    [21, 22, 23],
    [24, 25, 26],
    [27, 28, 29],
    [30, 31, 32]
  ]

  rowsSec.forEach((row, idx) => {
    const yRow = 307 + idx * 25
    const item = secList[idx] || {}
    drawField(`${row[0]} - CÓDIGO DO PROCEDIMENTO SECUNDÁRIO`, item.codigo || '', 20, yRow, 180, 25, 'center')
    drawField(`${row[1]} - NOME DO PROCEDIMENTO SECUNDÁRIO`, item.nome || '', 200, yRow, 320, 25)
    drawField(`${row[2]} - QTDE.`, item.quantidade || '', 520, yRow, 55, 25, 'center')
  })

  // ─── JUSTIFICATIVA DO(S) PROCEDIMENTO(S) SOLICITADO(S) (y: 440 a 537) ───
  drawSectionTitle('JUSTIFICATIVA DO(S) PROCEDIMENTO(S) SOLICITADO(S)', 440)
  drawField('33 - DESCRIÇÃO DO DIAGNÓSTICO', data.diagnosticoDescricao || '', 20, 452, 280, 25)
  drawField('34 - CID10 PRINCIPAL', data.cid10 || '', 300, 452, 90, 25, 'center')
  drawField('35 - CID10 SECUNDÁRIO', data.cidSecundario || '', 390, 452, 90, 25, 'center')
  drawField('36 - CID10 CAUSAS ASSOCIADAS', data.cidCausasAssociadas || '', 480, 452, 95, 25, 'center')

  drawTextArea(
    '37 - OBSERVAÇÕES / JUSTIFICATIVA CLÍNICA',
    data.justificativaClinica || 'Procedimento solicitado via central de regulação do município.',
    20,
    477,
    555,
    60
  )

  // ─── SOLICITAÇÃO (y: 545 a 607) ───
  drawSectionTitle('SOLICITAÇÃO', 545)
  drawField('38 - NOME DO PROFISSIONAL SOLICITANTE', data.nomeMedico, 20, 557, 280, 25)

  const formattedSolDate = data.dataSolicitacao
    ? new Date(data.dataSolicitacao).toLocaleDateString('pt-BR', { timeZone: 'UTC' })
    : ''
  drawField('39 - DATA DA SOLICITAÇÃO', formattedSolDate, 300, 557, 100, 25, 'center')
  drawField('42 - ASSINATURA E CARIMBO (Nº REGISTRO DO CONSELHO)', data.crmMedico || '', 400, 557, 175, 25, 'right')

  const docSolFmt =
    data.documentoSolicitanteTipo === 'CPF'
      ? 'CNS ( )  CPF (X)'
      : data.documentoSolicitanteTipo === 'CNS'
      ? 'CNS (X)  CPF ( )'
      : 'CNS ( )  CPF ( )'
  drawField('40 - DOCUMENTO', docSolFmt, 20, 582, 120, 25, 'center')
  drawField('41 - Nº DOCUMENTO (CNS/CPF) DO PROFISSIONAL SOLICITANTE', data.documentoSolicitanteNumero || '', 140, 582, 435, 25, 'center')

  // ─── AUTORIZAÇÃO (y: 615 a 702) ───
  drawSectionTitle('AUTORIZAÇÃO', 615)

  // Linha 1 (Esquerda)
  drawField('43 - NOME DO PROFISSIONAL AUTORIZADOR', '', 20, 627, 230, 25)
  drawField('44 - CÓD. ÓRGÃO EMISSOR', '', 250, 627, 145, 25, 'center')

  // Caixa do Número da APAC (49) - Direita (Linhas 1 e 2)
  drawRect(page, 395, 627, 180, 50)
  drawText(page, '49 - Nº DA AUTORIZAÇÃO (APAC)', 398, 630, { font: fontBold, size: 7, color: rgb(0, 0, 0) })

  // Linha 2 (Esquerda)
  const docAutFmt = 'CNS ( )  CPF ( )'
  drawField('45 - DOCUMENTO', docAutFmt, 20, 652, 120, 25, 'center')
  drawField('46 - Nº DOCUMENTO (CNS/CPF) DO PROFISSIONAL AUTORIZADOR', '', 140, 652, 255, 25, 'center')

  // Linha 3 (Esquerda)
  drawField('47 - DATA DA AUTORIZAÇÃO', '', 20, 677, 120, 25, 'center')
  drawField('48 - ASSINATURA E CARIMBO (Nº DO REGISTRO DO CONSELHO)', '', 140, 677, 255, 25)

  // Linha 3 (Direita) - Período de validade da APAC (50)
  drawRect(page, 395, 677, 180, 25)
  drawText(page, '50 - PERÍODO DE VALIDADE DA APAC', 398, 680, { font: fontBold, size: 7, color: rgb(0, 0, 0) })
  drawText(page, '      /      /      a      /      /      ', 398, 690, {
    font: fontRegular,
    size: 9.5,
    color: rgb(0, 0, 0),
    width: 174,
    align: 'center'
  })

  // ─── IDENTIFICAÇÃO DO ESTABELECIMENTO DE SAÚDE EXECUTANTE (y: 710 a 747) ───
  drawSectionTitle('IDENTIFICAÇÃO DO ESTABELECIMENTO DE SAÚDE (EXECUTANTE)', 710)
  drawField('51 - NOME FANTASIA DO ESTABELECIMENTO DE SAÚDE EXECUTANTE', '', 20, 722, 455, 25)
  drawField('52 - CNES', '', 475, 722, 100, 25, 'center')

  // Rodapé institucional
  drawText(page, 'Formulário em conformidade com o modelo nacional do SUS e as regras de regulação local.', 20, 760, {
    font: fontOblique,
    size: 6.5,
    color: rgb(0.39, 0.45, 0.54),
    width: 555,
    align: 'center'
  })
  drawText(page, 'Sistema de Saúde Integrado - Secretaria Municipal de Saúde de Conceição do Tocantins.', 20, 770, {
    font: fontOblique,
    size: 6.5,
    color: rgb(0.39, 0.45, 0.54),
    width: 555,
    align: 'center'
  })

  return await pdfDoc.save()
}

export async function POST(request: NextRequest) {
  try {
    const data = await request.json()

    if (!data.nomePaciente) {
      return NextResponse.json({ ok: false, error: 'O nome do paciente é obrigatório.' }, { status: 400 })
    }

    const uint8Array = await generateAPACPDF(data)

    return new NextResponse(uint8Array as any, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'inline; filename="laudo_apac.pdf"',
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate'
      }
    })
  } catch (error: any) {
    console.error('[APAC PDF POST] Erro geral:', error.message)
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }
}
