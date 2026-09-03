import { NextRequest, NextResponse } from 'next/server'
import { PDFDocument, rgb, StandardFonts, PDFPage, PDFFont } from 'pdf-lib'

const PAGE_HEIGHT = 841.89 // A4 height

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

function drawLine(
  page: PDFPage,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  color = rgb(0, 0, 0),
  thickness = 0.75
) {
  page.drawLine({
    start: { x: x1, y: PAGE_HEIGHT - y1 },
    end: { x: x2, y: PAGE_HEIGHT - y2 },
    thickness,
    color
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

async function generateEncaminhamentoPDF(data: any): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create()
  const page = pdfDoc.addPage([595.28, PAGE_HEIGHT])

  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
  const fontOblique = await pdfDoc.embedFont(StandardFonts.HelveticaOblique)

  const drawField = (
    label: string,
    value: string | number | null | undefined,
    x: number,
    y: number,
    width: number,
    height: number,
    align: 'left' | 'center' | 'right' = 'left',
    valFontSize = 9.5
  ) => {
    drawRect(page, x, y, width, height)

    drawText(page, label.toUpperCase(), x + 3, y + 3.5, {
      font: fontBold,
      size: 6.5,
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
    drawText(page, label.toUpperCase(), x + 3, y + 4, {
      font: fontBold,
      size: 6.5,
      color: rgb(0, 0, 0),
      width: width - 6
    })

    if (value) {
      const valStr = String(value).toUpperCase().trim().replace(/\s+/g, ' ')
      drawWrappedText(page, valStr, x + 4, y + 14, width - 8, fontRegular, 8.5, rgb(0, 0, 0), 10.5)
    }
  }

  // ─── CABEÇALHO (y: 20 a 55) ───
  drawRect(page, 20, 20, 555, 35)
  drawText(page, 'MINISTÉRIO DA SAÚDE', 20, 22, { font: fontBold, size: 7.5, width: 555, align: 'center' })
  drawText(page, 'ESTADO DE TOCANTINS', 20, 30, { font: fontBold, size: 7.5, width: 555, align: 'center' })
  drawText(page, 'MUNICÍPIO DE CONCEIÇÃO DO TOCANTINS', 20, 38, { font: fontBold, size: 7.5, width: 555, align: 'center' })

  const unidadeCabecalho = data.estabelecimentoSolicitante || 'Unidade de Saude Luiz Francisco de Miranda'
  drawText(page, unidadeCabecalho.toUpperCase(), 20, 46, { font: fontBold, size: 7.5, width: 555, align: 'center' })

  // Título
  drawText(page, 'GUIA DE ENCAMINHAMENTO', 20, 62, { font: fontBold, size: 11, width: 555, align: 'center' })
  drawText(page, 'REFERÊNCIA', 20, 75, { font: fontBold, size: 9.5, width: 555, align: 'center' })

  // ─── REFERÊNCIA GRID (y: 88 a 395) ───
  // Linha 1
  drawField('Nome do cidadão', data.nomePaciente, 20, 88, 355, 25)
  drawField('CPF/CNS', data.cnsPaciente || data.cpfPaciente || '', 375, 88, 105, 25, 'center')
  drawField('Classificação de risco', data.classificacaoRisco || 'ELETIVO', 480, 88, 95, 25, 'center')

  // Linha 2
  const formattedNascimento = data.dataNascimento
    ? new Date(data.dataNascimento).toLocaleDateString('pt-BR', { timeZone: 'UTC' })
    : ''
  drawField('Sexo', data.sexo === 'F' || data.sexo === 'FEMININO' ? 'FEMININO' : 'MASCULINO', 20, 113, 100, 25, 'center')
  drawField('Idade', data.idade || '', 120, 113, 155, 25, 'center')
  drawField('Data de nascimento', formattedNascimento, 275, 113, 130, 25, 'center')
  drawField('Telefone', data.telefone || '', 405, 113, 170, 25, 'center')

  // Linha 3
  drawField('Nome da mãe', data.nomeMae || '', 20, 138, 280, 25)
  drawField('Município de nascimento', data.municipioNascimento || 'CONCEIÇÃO DO TOCANTINS / TO', 300, 138, 275, 25)

  // Linha 4
  drawField('Unidade de saúde solicitante', data.estabelecimentoSolicitante || '', 20, 163, 455, 25)
  drawField('CNES', data.cnesSolicitante || '', 475, 163, 100, 25, 'center')

  // Linha 5
  drawField('Profissional solicitante', data.nomeMedico || '', 20, 188, 385, 25)
  drawField('CNS', data.documentoSolicitanteNumero || '', 405, 188, 170, 25, 'center')

  // Linha 6
  drawField('Especialidade', data.especialidade || '', 20, 213, 280, 25)

  const cidCompleto = data.cid10 ? `${data.cid10} - ${data.diagnosticoDescricao || ''}` : ''
  drawField('Hipótese / Diagnóstico (CID10)', cidCompleto, 300, 213, 275, 25)

  // Linha 7 (Motivo do encaminhamento)
  drawTextArea('Motivo do encaminhamento', data.justificativaClinica || '', 20, 238, 555, 110)

  // Linha 8 (Observação)
  drawTextArea('Observação', data.observacao || '', 20, 348, 555, 45)

  // ─── ASSINATURA SOLICITANTE (y: 425 a 475) ───
  const ySig = 425
  drawLine(page, 177, ySig, 417, ySig, rgb(0, 0, 0), 0.75)
  drawText(page, String(data.nomeMedico || '').toUpperCase(), 20, ySig + 3, {
    font: fontBold,
    size: 9.5,
    width: 555,
    align: 'center'
  })

  const crmStr = data.crmMedico ? `CRM - ${data.crmMedico}` : ''
  const cargoStr = data.cargoMedico || 'Médico da estratégia de saúde da família'
  drawText(page, `${cargoStr} ${crmStr ? ' - ' + crmStr : ''}`, 20, ySig + 14, {
    font: fontRegular,
    size: 8,
    width: 555,
    align: 'center'
  })

  const localDataStr = data.cidadeData || `Conceição do Tocantins - TO, ${new Date().toLocaleDateString('pt-BR')}`
  drawText(page, localDataStr, 20, ySig + 24, {
    font: fontRegular,
    size: 7.5,
    width: 555,
    align: 'center'
  })

  // ─── CONTRA-REFERÊNCIA (y: 478+) ───
  const yContra = 478
  drawLine(page, 20, yContra, 575, yContra, rgb(0, 0, 0), 0.75)
  drawLine(page, 20, yContra + 2, 575, yContra + 2, rgb(0, 0, 0), 0.75)

  drawText(page, 'CONTRA - REFERÊNCIA', 20, yContra + 8, {
    font: fontBold,
    size: 9.5,
    width: 555,
    align: 'center'
  })

  // Row 1 Contra-Referência
  const yRow1 = yContra + 22
  drawField('Unidade de especialidade', '', 20, yRow1, 415, 25)
  drawField('AGENDA: Data e Hora', '       /       /', 435, yRow1, 140, 25, 'center')

  // Row 2 Contra-Referência
  const yRow2 = yRow1 + 25
  drawRect(page, 20, yRow2, 415, 90)
  drawText(page, 'PARECER / CONDUTA DA ESPECIALIDADE', 23, yRow2 + 4.5, {
    font: fontBold,
    size: 6.5,
    width: 409
  })

  // Linhas para parecer
  const lightGray = rgb(0.58, 0.64, 0.72)
  drawLine(page, 25, yRow2 + 27, 430, yRow2 + 27, lightGray, 0.5)
  drawLine(page, 25, yRow2 + 45, 430, yRow2 + 45, lightGray, 0.5)
  drawLine(page, 25, yRow2 + 63, 430, yRow2 + 63, lightGray, 0.5)
  drawLine(page, 25, yRow2 + 81, 430, yRow2 + 81, lightGray, 0.5)

  // Diagnóstico (CID10)
  drawField('Diagnóstico (CID10)', '', 435, yRow2, 140, 25)
  drawRect(page, 435, yRow2 + 25, 140, 65)

  // Row 3 Contra-Referência (Observação)
  const yRow3 = yRow2 + 90
  drawRect(page, 20, yRow3, 555, 50)
  drawText(page, 'OBSERVAÇÃO', 23, yRow3 + 4.5, {
    font: fontBold,
    size: 6.5,
    width: 549
  })

  drawLine(page, 25, yRow3 + 22, 570, yRow3 + 22, lightGray, 0.5)
  drawLine(page, 25, yRow3 + 40, 570, yRow3 + 40, lightGray, 0.5)

  // Linhas inferiores para Assinatura e Data da Consulta
  const yBottom = yRow3 + 100

  // Data da Consulta
  drawLine(page, 20, yBottom, 200, yBottom, rgb(0, 0, 0), 0.75)
  drawText(page, '      /      /', 20, yBottom - 11, {
    font: fontRegular,
    size: 9.5,
    width: 180,
    align: 'center'
  })
  drawText(page, 'DATA DA CONSULTA', 20, yBottom + 3, {
    font: fontBold,
    size: 8,
    width: 180,
    align: 'center'
  })

  // Assinatura e carimbo do especialista
  drawLine(page, 325, yBottom, 575, yBottom, rgb(0, 0, 0), 0.75)
  drawText(page, 'ASSINATURA E CARIMBO DO ESPECIALISTA', 325, yBottom + 3, {
    font: fontBold,
    size: 8,
    width: 250,
    align: 'center'
  })

  // ─── RODAPÉ (y: 755 a 765) ───
  const formattedPrintDate = new Date().toLocaleDateString('pt-BR')
  const formattedPrintTime = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  const operName = data.operadorNome || 'Operador GestSus'

  drawText(page, `Impresso em ${formattedPrintDate} às ${formattedPrintTime} por ${operName}.`, 20, 762, {
    font: fontOblique,
    size: 7,
    color: rgb(0.28, 0.33, 0.41),
    width: 400
  })
  drawText(page, 'Pág. 1 / 1', 420, 762, {
    font: fontRegular,
    size: 7,
    color: rgb(0.28, 0.33, 0.41),
    width: 155,
    align: 'right'
  })

  return await pdfDoc.save()
}

export async function POST(request: NextRequest) {
  try {
    const data = await request.json()

    if (!data.nomePaciente) {
      return NextResponse.json({ ok: false, error: 'O nome do paciente é obrigatório.' }, { status: 400 })
    }

    const uint8Array = await generateEncaminhamentoPDF(data)

    return new NextResponse(uint8Array as any, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'inline; filename="guia_encaminhamento.pdf"',
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate'
      }
    })
  } catch (error: any) {
    console.error('[ENCAMINHAMENTO PDF POST] Erro geral:', error.message)
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }
}
