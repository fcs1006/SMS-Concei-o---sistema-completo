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

async function generateCitopatologicoPDF(data: any): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create()

  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
  const fontOblique = await pdfDoc.embedFont(StandardFonts.HelveticaOblique)

  // ==========================================
  // PAGINA 1: REQUISIÇÃO (FRENTE)
  // ==========================================
  const page1 = pdfDoc.addPage([595.28, PAGE_HEIGHT])

  const drawFieldP1 = (
    label: string,
    value: string | number | null | undefined,
    x: number,
    y: number,
    width: number,
    height: number,
    align: 'left' | 'center' | 'right' = 'left',
    valFontSize = 10.5
  ) => {
    drawRect(page1, x, y, width, height)

    drawText(page1, label.toUpperCase(), x + 3, y + 2.5, {
      font: fontBold,
      size: 6.5,
      color: rgb(0, 0, 0),
      width: width - 6
    })

    if (value !== undefined && value !== null && value !== '') {
      const valStr = String(value).toUpperCase().trim()

      let currentSize = valFontSize
      let textWidth = fontRegular.widthOfTextAtSize(valStr, currentSize)

      while (textWidth > width - 8 && currentSize > 7) {
        currentSize -= 0.5
        textWidth = fontRegular.widthOfTextAtSize(valStr, currentSize)
      }

      const yVal = y + 11.5 + (valFontSize - currentSize) * 0.35

      drawText(page1, valStr, x + 4, yVal, {
        font: fontRegular,
        size: currentSize,
        color: rgb(0, 0, 0),
        width: width - 8,
        align
      })
    }
  }

  const drawSectionTitleP1 = (title: string, y: number) => {
    drawRect(page1, 20, y, 555, 14, { fill: rgb(0, 0, 0) })
    drawText(page1, title.toUpperCase(), 25, y + 2.5, {
      font: fontBold,
      size: 8.5,
      color: rgb(1, 1, 1),
      width: 545,
      align: 'center'
    })
  }

  const drawCheckboxP1 = (label: string, isChecked: boolean, x: number, y: number, labelSize = 8) => {
    drawRect(page1, x, y, 7, 7)
    if (isChecked) {
      drawText(page1, 'X', x + 1, y + 0.5, { font: fontBold, size: 6.5 })
    }
    drawText(page1, label, x + 10, y + 0.5, { font: fontRegular, size: labelSize })
  }

  // Cabeçalho Oficial
  drawRect(page1, 20, 20, 180, 24)
  drawText(page1, 'MINISTÉRIO DA SAÚDE', 25, 27, { font: fontBold, size: 10, width: 170, align: 'left' })

  drawRect(page1, 200, 20, 375, 24)
  drawText(page1, 'REQUISIÇÃO DE EXAME CITOPATOLÓGICO - COLO DO ÚTERO', 205, 24, { font: fontBold, size: 9.5, width: 365, align: 'center' })
  drawText(page1, 'Programa Nacional de Controle do Câncer do Colo do Útero', 205, 33, { font: fontOblique, size: 7.5, width: 365, align: 'center' })

  // Linha 1 Unidade
  drawFieldP1('UF', data.ufUnidade, 20, 48, 30, 22, 'center')
  drawFieldP1('CNES da Unidade de Saúde', data.cnesUnidade, 55, 48, 110, 22, 'center')
  drawFieldP1('Unidade de Saúde', data.unidadeSaude, 170, 48, 235, 22)

  const protocoloVal = data.numeroProtocolo || ''
  drawFieldP1('Nº Protocolo', protocoloVal, 410, 48, 165, 22, 'center', 9)

  // Linha 2 Unidade
  drawFieldP1('Município da Unidade', data.municipioUnidade, 20, 73, 385, 22)
  drawFieldP1('Prontuário', data.prontuario || '—', 410, 73, 165, 22, 'center')

  // Seção: Informações Pessoais
  drawSectionTitleP1('Informações Pessoais', 100)

  // CNS
  drawFieldP1('Cartão SUS*', data.cnsPaciente, 20, 114, 555, 22)
  // Nome Completo
  drawFieldP1('Nome Completo da Mulher*', data.nomePaciente, 20, 139, 555, 22)
  // Mãe
  drawFieldP1('Nome Completo da Mãe*', data.nomeMae, 20, 164, 555, 22)
  // Apelido
  drawFieldP1('Apelido da Mulher', data.apelido || '—', 20, 189, 555, 22)

  // CPF e Nacionalidade
  drawFieldP1('CPF', data.cpfPaciente || '—', 20, 214, 180, 22, 'center')
  drawFieldP1('Nacionalidade', data.nacionalidade || 'BRASILEIRA', 205, 214, 370, 22)

  // Nasc, Idade, Raça
  const dataNascFmt = data.dataNascimento ? data.dataNascimento.split('-').reverse().join('/') : '—'
  drawFieldP1('Data de Nascimento*', dataNascFmt, 20, 239, 130, 22, 'center')
  drawFieldP1('Idade', data.idade || '—', 155, 239, 60, 22, 'center')

  // Raça/cor boxes
  const rY = 239
  drawRect(page1, 220, rY, 355, 22)
  drawText(page1, 'RAÇA/COR', 223, rY + 3, { font: fontBold, size: 6 })
  drawCheckboxP1('Branca', data.raca === '01', 225, rY + 11)
  drawCheckboxP1('Preta', data.raca === '02', 270, rY + 11)
  drawCheckboxP1('Parda', data.raca === '03', 315, rY + 11)
  drawCheckboxP1('Amarela', data.raca === '04', 360, rY + 11)
  drawCheckboxP1('Indígena/Etnia', data.raca === '05', 415, rY + 11)

  // Residência
  drawFieldP1('Dados Residenciais: Logradouro', data.logradouro || '—', 20, 264, 555, 22)

  drawFieldP1('Número', data.numero || '—', 20, 289, 80, 22, 'center')
  drawFieldP1('Complemento', data.complemento || '—', 100, 289, 120, 22)
  drawFieldP1('Bairro', data.bairro || '—', 225, 289, 195, 22)
  drawFieldP1('UF', data.ufResidencia || 'TO', 425, 289, 30, 22, 'center')
  drawFieldP1('Código do Município', data.codigoMunicipio || '170560', 460, 289, 115, 22, 'center')

  drawFieldP1('Município', data.municipio || 'CONCEIÇÃO DO TOCANTINS', 20, 314, 215, 22)
  drawFieldP1('CEP', data.cep || '77305000', 240, 314, 85, 22, 'center')

  let telVal = '—'
  if (data.telefone && data.telefone.trim() !== '') {
    const cleanTel = data.telefone.replace(/\D/g, '')
    const dddStr = String(data.ddd || '63').replace(/\D/g, '')
    if (cleanTel.length >= 10) {
      if (cleanTel.startsWith(dddStr)) {
        telVal = `(${dddStr}) ${cleanTel.substring(dddStr.length)}`
      } else {
        telVal = `(${cleanTel.substring(0, 2)}) ${cleanTel.substring(2)}`
      }
    } else {
      telVal = `(${dddStr}) ${cleanTel}`
    }
  }
  drawFieldP1('DDD / Telefone', telVal, 330, 314, 110, 22, 'center')
  drawFieldP1('Ponto de Referência', data.pontoReferencia || '—', 445, 314, 130, 22)

  // Escolaridade boxes
  const escY = 339
  drawRect(page1, 20, escY, 555, 22)
  drawText(page1, 'ESCOLARIDADE', 23, escY + 3, { font: fontBold, size: 6 })
  drawCheckboxP1('Analfabeta', data.escolaridade === 'Analfabeta', 25, escY + 11)
  drawCheckboxP1('F. Incompleto', data.escolaridade === 'Ensino Fundamental Incompleto', 95, escY + 11)
  drawCheckboxP1('F. Completo', data.escolaridade === 'Ensino Fundamental Completo', 185, escY + 11)
  drawCheckboxP1('Médio Completo', data.escolaridade === 'Ensino Médio Completo', 270, escY + 11)
  drawCheckboxP1('Superior Completo', data.escolaridade === 'Ensino Superior Completo', 370, escY + 11)

  // Seção: Anamnese
  drawSectionTitleP1('Dados da Anamnese', 370)

  // Grid Anamnese (Esquerda / Direita)
  const aY = 384
  drawRect(page1, 20, aY, 275, 200) // Coluna Esquerda
  drawRect(page1, 300, aY, 275, 200) // Coluna Direita

  // Coluna Esquerda Conteúdo
  let cy = aY + 5
  drawText(page1, '1. Motivo do exame*', 25, cy, { font: fontBold, size: 8.5 })
  cy += 11
  drawCheckboxP1('Rastreamento', data.motivoExame === 'Rastreamento', 28, cy)
  drawCheckboxP1('Repetição', data.motivoExame === 'Repetição', 105, cy)
  drawCheckboxP1('Seguimento', data.motivoExame === 'Seguimento', 170, cy)

  cy += 16
  drawText(page1, '2. Fez o exame preventivo alguma vez?*', 25, cy, { font: fontBold, size: 8.5 })
  cy += 11
  drawCheckboxP1('Sim', data.fezPreventivo === 'Sim', 28, cy)
  drawCheckboxP1('Não', data.fezPreventivo === 'Não', 75, cy)
  drawCheckboxP1('Não sabe', data.fezPreventivo === 'Não sabe', 120, cy)
  if (data.fezPreventivo === 'Sim') {
    drawText(page1, `Ano: ${data.preventivoAno || '—'}`, 185, cy, { font: fontRegular, size: 8.5 })
  }

  cy += 18
  drawText(page1, '3. Usa DIU?*', 25, cy, { font: fontBold, size: 8.5 })
  cy += 11
  drawCheckboxP1('Sim', data.usaDiu === 'Sim', 28, cy)
  drawCheckboxP1('Não', data.usaDiu === 'Não', 75, cy)
  drawCheckboxP1('Não sabe', data.usaDiu === 'Não sabe', 120, cy)

  cy += 16
  drawText(page1, '4. Está grávida?*', 25, cy, { font: fontBold, size: 8.5 })
  cy += 11
  drawCheckboxP1('Sim', data.estaGravida === 'Sim', 28, cy)
  drawCheckboxP1('Não', data.estaGravida === 'Não', 75, cy)
  drawCheckboxP1('Não sabe', data.estaGravida === 'Não sabe', 120, cy)

  cy += 16
  drawText(page1, '5. Usa pílula anticoncepcional?*', 25, cy, { font: fontBold, size: 8.5 })
  cy += 11
  drawCheckboxP1('Sim', data.usaPilula === 'Sim', 28, cy)
  drawCheckboxP1('Não', data.usaPilula === 'Não', 75, cy)
  drawCheckboxP1('Não sabe', data.usaPilula === 'Não sabe', 120, cy)

  cy += 16
  drawText(page1, '6. Usa hormônio / remédio para menopausa?*', 25, cy, { font: fontBold, size: 8 })
  cy += 11
  drawCheckboxP1('Sim', data.usaHormonioMenopausa === 'Sim', 28, cy)
  drawCheckboxP1('Não', data.usaHormonioMenopausa === 'Não', 75, cy)
  drawCheckboxP1('Não sabe', data.usaHormonioMenopausa === 'Não sabe', 120, cy)

  // Coluna Direita Conteúdo
  cy = aY + 5
  drawText(page1, '7. Já fez tratamento por radioterapia?*', 305, cy, { font: fontBold, size: 8.5 })
  cy += 11
  drawCheckboxP1('Sim', data.tratamentoRadioterapia === 'Sim', 308, cy)
  drawCheckboxP1('Não', data.tratamentoRadioterapia === 'Não', 355, cy)
  drawCheckboxP1('Não sabe', data.tratamentoRadioterapia === 'Não sabe', 400, cy)

  cy += 16
  drawText(page1, '8. Data da última menstruação / regra (DUM)*', 305, cy, { font: fontBold, size: 8.5 })
  cy += 11
  if (data.dumNaoSabe) {
    drawCheckboxP1('Não sabe / Não lembra', true, 308, cy)
  } else {
    const dumVal = data.dataUltimaMenstruacao ? data.dataUltimaMenstruacao.split('-').reverse().join('/') : '—'
    drawText(page1, `DATA: ${dumVal}`, 308, cy, { font: fontBold, size: 8.5 })
  }

  cy += 18
  drawText(page1, '9. Tem ou teve algum sangramento após relações sexuais?*', 305, cy, { font: fontBold, size: 8.5 })
  cy += 11
  drawCheckboxP1('Sim', data.sangramentoAposRacao === 'Sim', 308, cy)
  drawCheckboxP1('Não / Não sabe / Não lembra', data.sangramentoAposRacao !== 'Sim', 355, cy)

  cy += 20
  drawText(page1, '10. Tem ou teve algum sangramento após a menopausa?*', 305, cy, { font: fontBold, size: 8.5 })
  cy += 11
  drawCheckboxP1('Sim', data.sangramentoAposMenopausa === 'Sim', 308, cy)
  drawCheckboxP1('Não / Não sabe / Não lembra / Não na menopausa', data.sangramentoAposMenopausa !== 'Sim', 355, cy)

  // Seção: Exame Clínico
  drawSectionTitleP1('Exame Clínico', 592)

  const ecY = 606
  drawRect(page1, 20, ecY, 275, 45)
  drawRect(page1, 300, ecY, 275, 45)

  // Inspeção do colo
  drawText(page1, '11. Inspeção do colo*', 25, ecY + 4, { font: fontBold, size: 8.5 })
  drawCheckboxP1('Normal', data.inspecaoColo === 'Normal', 28, ecY + 15)
  drawCheckboxP1('Ausente', data.inspecaoColo === 'Ausente', 90, ecY + 15)
  drawCheckboxP1('Alterado', data.inspecaoColo === 'Alterado', 150, ecY + 15)
  drawCheckboxP1('Não visualizado', data.inspecaoColo === 'Colo não visualizado', 210, ecY + 15)

  // Sinais DST
  drawText(page1, '12. Sinais sugestivos de DST?*', 305, ecY + 4, { font: fontBold, size: 8.5 })
  drawCheckboxP1('Sim', data.sinaisDst === 'Sim', 308, ecY + 18)
  drawCheckboxP1('Não', data.sinaisDst === 'Não', 360, ecY + 18)

  // Nota importante
  const nY = 658
  drawRect(page1, 20, nY, 555, 24, { fill: rgb(0.95, 0.96, 0.98), stroke: rgb(0, 0, 0) })
  drawText(
    page1,
    'NOTA: Na presença de colo alterado, com lesão sugestiva de câncer, não aguardar o resultado do exame citopatológico para encaminhar a mulher para colposcopia.',
    25,
    nY + 7,
    { font: fontBold, size: 7.5, width: 545, align: 'center' }
  )

  // Coleta & Responsável
  const colDataFmt = data.dataColeta ? data.dataColeta.split('-').reverse().join('/') : '—'
  drawFieldP1('Data da Coleta*', colDataFmt, 20, 690, 160, 28, 'center', 10.5)

  const respVal = data.responsavel || '—'
  drawFieldP1('Responsável / Assinatura e Carimbo*', respVal, 190, 690, 385, 28, 'center', 10.5)

  // Nota do final da página
  drawText(page1, 'Atenção: Os campos com asterisco (*) são obrigatórios', 390, 802, {
    font: fontOblique,
    size: 7,
    color: rgb(0.39, 0.45, 0.55),
    width: 185,
    align: 'right'
  })

  // ==========================================
  // PAGINA 2: RESULTADOS (VERSO EM BRANCO)
  // ==========================================
  const page2 = pdfDoc.addPage([595.28, PAGE_HEIGHT])

  const drawFieldP2 = (
    label: string,
    value: string | number | null | undefined,
    x: number,
    y: number,
    width: number,
    height: number,
    align: 'left' | 'center' | 'right' = 'left',
    valFontSize = 10.5
  ) => {
    drawRect(page2, x, y, width, height)
    drawText(page2, label.toUpperCase(), x + 3, y + 2.5, {
      font: fontBold,
      size: 6.5,
      color: rgb(0, 0, 0),
      width: width - 6
    })
    if (value) {
      drawText(page2, String(value), x + 4, y + 13, { font: fontRegular, size: valFontSize, align, width: width - 8 })
    }
  }

  const drawCheckboxP2 = (label: string, isChecked: boolean, x: number, y: number, labelSize = 7.5) => {
    drawRect(page2, x, y, 7, 7)
    if (isChecked) {
      drawText(page2, 'X', x + 1, y + 0.5, { font: fontBold, size: 6.5 })
    }
    drawText(page2, label, x + 10, y + 0.5, { font: fontRegular, size: labelSize })
  }

  // Título do Laboratório
  drawRect(page2, 20, 20, 555, 30)
  drawText(page2, 'IDENTIFICAÇÃO DO LABORATÓRIO', 20, 28, { font: fontBold, size: 10.5, width: 555, align: 'center' })

  drawFieldP2('CNES do Laboratório*', '', 20, 50, 160, 26)
  drawFieldP2('Nome do Laboratório*', '', 180, 50, 220, 26)
  drawFieldP2('Número do Exame*', '', 400, 50, 95, 26)
  drawFieldP2('Recebido em*', '', 495, 50, 80, 26, 'center')

  // Título Resultado
  drawRect(page2, 20, 90, 555, 16, { fill: rgb(0, 0, 0) })
  drawText(page2, 'RESULTADO DO EXAME CITOPATOLÓGICO - COLO DO ÚTERO', 20, 94, {
    font: fontBold,
    size: 9.5,
    color: rgb(1, 1, 1),
    width: 555,
    align: 'center'
  })

  // 1. Avaliação Pré-Analítica
  drawRect(page2, 20, 120, 270, 110)
  drawText(page2, 'AVALIAÇÃO PRÉ-ANALÍTICA', 23, 124, { font: fontBold, size: 8 })
  drawText(page2, 'AMOSTRA REJEITADA POR:', 23, 136, { font: fontRegular, size: 7.5 })
  drawCheckboxP2('Ausência ou erro na identificação da lâmina/frasco', false, 25, 148, 7)
  drawCheckboxP2('Lâmina danificada ou ausente', false, 25, 161, 7)
  drawCheckboxP2('Causas alheias ao laboratório; especificar:', false, 25, 174, 7)
  drawCheckboxP2('Outras causas; especificar:', false, 25, 187, 7)

  drawLine(page2, 175, 182, 285, 182, rgb(0.6, 0.6, 0.6), 0.5)
  drawLine(page2, 125, 195, 285, 195, rgb(0.6, 0.6, 0.6), 0.5)

  // 2. Epitélios representados
  drawRect(page2, 20, 245, 270, 52)
  drawText(page2, 'EPITÉLIOS REPRESENTADOS NA AMOSTRA:*', 23, 249, { font: fontBold, size: 8 })
  drawCheckboxP2('Escamoso', false, 25, 265, 7.5)
  drawCheckboxP2('Glandular', false, 95, 265, 7.5)
  drawCheckboxP2('Metaplásico', false, 165, 265, 7.5)

  // 3. Adequabilidade
  drawRect(page2, 300, 120, 275, 177)
  drawText(page2, 'ADEQUABILIDADE DO MATERIAL*', 303, 124, { font: fontBold, size: 8 })
  drawCheckboxP2('Satisfatória', false, 305, 136, 7.5)
  drawCheckboxP2('Insatisfatória para avaliação oncótica devido a:', false, 305, 148, 7.5)

  const adY = 162
  drawCheckboxP2('Material acelular ou hipocelular em menos de 10% do esfregaço', false, 312, adY, 6.5)
  drawCheckboxP2('Sangue em mais de 75% do esfregaço', false, 312, adY + 12, 6.5)
  drawCheckboxP2('Piócitos em mais de 75% do esfregaço', false, 312, adY + 24, 6.5)
  drawCheckboxP2('Artefatos de dessecamento em mais de 75% do esfregaço', false, 312, adY + 36, 6.5)
  drawCheckboxP2('Contaminantes externos em mais de 75% do esfregaço', false, 312, adY + 48, 6.5)
  drawCheckboxP2('Intensa superposição celular em mais de 75% do esfregaço', false, 312, adY + 60, 6.5)
  drawCheckboxP2('Outros, especificar:', false, 312, adY + 72, 6.5)
  drawLine(page2, 395, adY + 80, 570, adY + 80, rgb(0.6, 0.6, 0.6), 0.5)

  // Diagnóstico Descritivo
  drawRect(page2, 20, 312, 555, 16, { fill: rgb(0, 0, 0) })
  drawText(page2, 'DIAGNÓSTICO DESCRITIVO', 20, 316, {
    font: fontBold,
    size: 9.5,
    color: rgb(1, 1, 1),
    width: 555,
    align: 'center'
  })

  const dY = 340
  // Dentro dos limites
  drawRect(page2, 20, dY, 270, 32)
  drawText(page2, 'DENTRO DOS LIMITES DA NORMALIDADE?', 23, dY + 4, { font: fontBold, size: 8 })
  drawCheckboxP2('Sim', false, 25, dY + 16, 7.5)
  drawCheckboxP2('Não', false, 75, dY + 16, 7.5)

  // Benignas
  drawRect(page2, 20, dY + 38, 270, 110)
  drawText(page2, 'ALTERAÇÕES CELULARES BENIGNAS OU REPARATIVAS', 23, dY + 42, { font: fontBold, size: 8 })
  const bgY = dY + 54
  drawCheckboxP2('Inflamação', false, 25, bgY, 7.5)
  drawCheckboxP2('Metaplasia escamosa imatura', false, 25, bgY + 13, 7.5)
  drawCheckboxP2('Reparação', false, 25, bgY + 26, 7.5)
  drawCheckboxP2('Atrofia com inflamação', false, 25, bgY + 39, 7.5)
  drawCheckboxP2('Radiação', false, 25, bgY + 52, 7.5)
  drawCheckboxP2('Outros; especificar:', false, 25, bgY + 65, 7.5)

  // Microbiologia
  drawRect(page2, 20, dY + 154, 270, 175)
  drawText(page2, 'MICROBIOLOGIA', 23, dY + 158, { font: fontBold, size: 8 })
  const micY = dY + 170
  drawCheckboxP2('Lactobacillus sp', false, 25, micY, 7.5)
  drawCheckboxP2('Cocos', false, 25, micY + 13, 7.5)
  drawCheckboxP2('Sugestivo de Chlamydia sp', false, 25, micY + 26, 7.5)
  drawCheckboxP2('Actinomyces sp', false, 25, micY + 39, 7.5)
  drawCheckboxP2('Candida sp', false, 25, micY + 52, 7.5)
  drawCheckboxP2('Trichomonas vaginalis', false, 25, micY + 65, 7.5)
  drawCheckboxP2('Efeito citopático compatível com vírus do grupo Herpes', false, 25, micY + 78, 7.5)
  drawCheckboxP2('Bacilos supracitoplasmáticos (Gardnerella/Mobiluncus)', false, 25, micY + 91, 7.5)
  drawCheckboxP2('Outros bacilos', false, 25, micY + 104, 7.5)
  drawCheckboxP2('Outros; especificar:', false, 25, micY + 117, 7.5)

  // Células Atípicas
  const catY = dY
  drawRect(page2, 300, catY, 275, 329)
  drawText(page2, 'CÉLULAS ATÍPICAS DE SIGNIFICADO INDETERMINADO', 303, catY + 3, { font: fontBold, size: 8 })

  drawText(page2, 'ESCAMOSAS:', 303, catY + 14, { font: fontBold, size: 7.5 })
  drawCheckboxP2('Possivelmente não neoplásicas (ASC-US)', false, 305, catY + 24, 7)
  drawCheckboxP2('Não se pode afastar lesão de alto grau (ASC-H)', false, 305, catY + 36, 7)

  drawText(page2, 'GLANDULARES:', 303, catY + 50, { font: fontBold, size: 7.5 })
  drawCheckboxP2('Possivelmente não neoplásicas', false, 305, catY + 60, 7)
  drawCheckboxP2('Não se pode afastar lesão de alto grau', false, 305, catY + 72, 7)

  drawText(page2, 'DE ORIGEM INDEFINIDA:', 303, catY + 86, { font: fontBold, size: 7.5 })
  drawCheckboxP2('Possivelmente não neoplásicas', false, 305, catY + 96, 7)
  drawCheckboxP2('Não se pode afastar lesão de alto grau', false, 305, catY + 108, 7)

  drawText(page2, 'ATIPIAS EM CÉLULAS ESCAMOSAS', 303, catY + 124, { font: fontBold, size: 8 })
  drawCheckboxP2('Lesão intra-epitelial de baixo grau (HPV / NIC I)', false, 305, catY + 134, 7)
  drawCheckboxP2('Lesão intra-epitelial de alto grau (NIC II e III)', false, 305, catY + 146, 7)
  drawCheckboxP2('Lesão intra-epitelial de alto grau, não podendo excluir micro-invasão', false, 305, catY + 158, 7)
  drawCheckboxP2('Carcinoma epidermóide invasor', false, 305, catY + 170, 7)

  drawText(page2, 'ATIPIAS EM CÉLULAS GLANDULARES', 303, catY + 186, { font: fontBold, size: 8 })
  drawCheckboxP2('Adenocarcinoma "in situ"', false, 305, catY + 196, 7)
  drawText(page2, 'ADENOCARCINOMA INVASOR:', 303, catY + 208, { font: fontBold, size: 7.5 })
  drawCheckboxP2('Cervical', false, 305, catY + 218, 7)
  drawCheckboxP2('Endometrial', false, 365, catY + 218, 7)
  drawCheckboxP2('Sem outras especificações', false, 435, catY + 218, 7)

  drawText(page2, 'OUTRAS NEOPLASIAS MALIGNAS:', 303, catY + 234, { font: fontBold, size: 8 })
  drawCheckboxP2('Presença de células endometriais (na pós-menopausa ou', false, 305, catY + 246, 7)
  drawText(page2, 'acima de 40 anos, fora do período menstrual)', 315, catY + 254, { font: fontRegular, size: 6.5 })

  // Observações Gerais
  drawRect(page2, 20, 692, 555, 36)
  drawText(page2, 'OBSERVAÇÕES GERAIS:', 23, 696, { font: fontBold, size: 8 })

  // Assinatura do Laboratório
  drawFieldP2('Screening pelo citotécnico', '', 20, 735, 270, 30)
  drawFieldP2('Responsável / Assinatura e Registro*', '', 300, 735, 275, 30)
  drawFieldP2('Data do Resultado*', '', 20, 770, 160, 30)

  return await pdfDoc.save()
}

export async function POST(request: NextRequest) {
  try {
    const data = await request.json()
    const uint8Array = await generateCitopatologicoPDF(data)

    return new NextResponse(uint8Array as any, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'inline; filename="requisicao_citopatologico.pdf"',
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate'
      }
    })
  } catch (error: any) {
    console.error('Erro ao gerar o PDF do Citopatológico:', error)
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }
}
