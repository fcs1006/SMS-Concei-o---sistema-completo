import { NextRequest, NextResponse } from 'next/server'
import PDFDocument from 'pdfkit'

function generateEncaminhamentoPDF(data: any): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: 'A4', margin: 20 })
      const chunks: any[] = []
      
      doc.on('data', (chunk: any) => chunks.push(chunk))
      doc.on('end', () => resolve(Buffer.concat(chunks)))
      doc.on('error', (err: any) => reject(err))

      const gridColor = '#000000'
      const labelColor = '#000000'
      const valueColor = '#000000'

      // Helper para desenhar campos
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
        doc.rect(x, y, width, height).stroke(gridColor)
        
        doc.fillColor(labelColor)
           .fontSize(6.5)
           .font('Helvetica-Bold')
           .text(label.toUpperCase(), x + 3, y + 4, { width: width - 6 })

        if (value !== undefined && value !== null && value !== '') {
          const valStr = String(value).toUpperCase().trim().replace(/\s+/g, ' ')
          
          let currentSize = valFontSize
          doc.font('Helvetica').fontSize(currentSize)
          let textWidth = doc.widthOfString(valStr)
          
          while (textWidth > width - 8 && currentSize > 6.5) {
            currentSize -= 0.5
            doc.fontSize(currentSize)
            textWidth = doc.widthOfString(valStr)
          }
          
          const yVal = y + 11.5 + (valFontSize - currentSize) * 0.35
          
          doc.fillColor(valueColor)
             .text(valStr, x + 4, yVal, { width: width - 8, align })
        }
      }

      // Helper para desenhar áreas de texto (justificativas)
      const drawTextArea = (label: string, value: string | null | undefined, x: number, y: number, width: number, height: number) => {
        doc.rect(x, y, width, height).stroke(gridColor)
        doc.fillColor(labelColor)
           .fontSize(6.5)
           .font('Helvetica-Bold')
           .text(label.toUpperCase(), x + 3, y + 4.5, { width: width - 6 })

        if (value) {
          const valStr = String(value).toUpperCase().trim().replace(/\s+/g, ' ')
          doc.fillColor(valueColor)
             .fontSize(8.5)
             .font('Helvetica')
             .text(valStr, x + 4, y + 15, { width: width - 8, align: 'justify', lineGap: 1 })
        }
      }

      // ─── CABEÇALHO (y: 20 a 55) ───
      // Caixa única centralizada do cabeçalho
      doc.rect(20, 20, 555, 35).stroke(gridColor)
      doc.fillColor(valueColor)
         .fontSize(7.5)
         .font('Helvetica-Bold')
         .text('MINISTÉRIO DA SAÚDE', 20, 22, { width: 555, align: 'center' })
         .text('ESTADO DE TOCANTINS', 20, 30, { width: 555, align: 'center' })
         .text('MUNICÍPIO DE CONCEIÇÃO DO TOCANTINS', 20, 38, { width: 555, align: 'center' })
         
      const unidadeCabecalho = data.unidadeCabecalho || 'Unidade de Saude Luiz Francisco de Miranda'
      doc.text(unidadeCabecalho.toUpperCase(), 20, 46, { width: 555, align: 'center' })

      // Título
      doc.fillColor(valueColor)
         .fontSize(11)
         .font('Helvetica-Bold')
         .text('GUIA DE ENCAMINHAMENTO', 20, 62, { width: 555, align: 'center' })
         
      doc.fontSize(9.5)
         .font('Helvetica-Bold')
         .text('REFERÊNCIA', 20, 75, { width: 555, align: 'center' })

      // ─── REFERÊNCIA GRID (y: 88 a 395) ───
      // Linha 1
      drawField('Nome do cidadão', data.nomePaciente, 20, 88, 355, 25)
      drawField('CPF/CNS', data.cnsPaciente || data.cpfPaciente || '', 375, 88, 105, 25, 'center')
      drawField('Classificação de risco', data.classificacaoRisco || 'ELETIVO', 480, 88, 95, 25, 'center')

      // Linha 2
      const formattedNascimento = data.dataNascimento ? new Date(data.dataNascimento).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : ''
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
      doc.moveTo(177, ySig).lineTo(417, ySig).stroke(gridColor)
      doc.fillColor(valueColor)
         .fontSize(9.5)
         .font('Helvetica-Bold')
         .text(String(data.nomeMedico || '').toUpperCase(), 20, ySig + 3, { width: 555, align: 'center' })
         
      const crmStr = data.crmMedico ? `CRM - ${data.crmMedico}` : ''
      const cargoStr = data.cargoMedico || 'Médico da estratégia de saúde da família'
      doc.fontSize(8)
         .font('Helvetica')
         .text(`${cargoStr} ${crmStr ? ' - ' + crmStr : ''}`, 20, ySig + 14, { width: 555, align: 'center' })
         
      const localDataStr = data.cidadeData || `Conceição do Tocantins - TO, ${new Date().toLocaleDateString('pt-BR')}`
      doc.fontSize(7.5)
         .font('Helvetica')
         .text(localDataStr, 20, ySig + 24, { width: 555, align: 'center' })

      // ─── CONTRA-REFERÊNCIA (y: 478+) ───
      const yContra = 478
      doc.moveTo(20, yContra).lineTo(575, yContra).stroke(gridColor)
      doc.moveTo(20, yContra + 2).lineTo(575, yContra + 2).stroke(gridColor)

      doc.fillColor(valueColor)
         .fontSize(9.5)
         .font('Helvetica-Bold')
         .text('CONTRA - REFERÊNCIA', 20, yContra + 8, { width: 555, align: 'center' })

      // Row 1 Contra-Referência
      const yRow1 = yContra + 22
      drawField('Unidade de especialidade', '', 20, yRow1, 415, 25)
      drawField('AGENDA: Data e Hora', '       /       /', 435, yRow1, 140, 25, 'center')

      // Row 2 Contra-Referência (Parecer / conduta da especialidade + Diagnóstico)
      const yRow2 = yRow1 + 25
      doc.rect(20, yRow2, 415, 90).stroke(gridColor)
      doc.fillColor(labelColor)
         .fontSize(6.5)
         .font('Helvetica-Bold')
         .text('PARECER / CONDUTA DA ESPECIALIDADE', 23, yRow2 + 4.5, { width: 409 })

      // Linhas pontilhadas/linhas para escrever parecer
      doc.lineWidth(0.5).strokeColor('#94a3b8')
      doc.moveTo(25, yRow2 + 27).lineTo(430, yRow2 + 27).stroke()
      doc.moveTo(25, yRow2 + 45).lineTo(430, yRow2 + 45).stroke()
      doc.moveTo(25, yRow2 + 63).lineTo(430, yRow2 + 63).stroke()
      doc.moveTo(25, yRow2 + 81).lineTo(430, yRow2 + 81).stroke()
      doc.lineWidth(1).strokeColor(gridColor) // restaurar padrão

      // Diagnóstico (CID10)
      drawField('Diagnóstico (CID10)', '', 435, yRow2, 140, 25)
      doc.rect(435, yRow2 + 25, 140, 65).stroke(gridColor)

      // Row 3 Contra-Referência (Observação)
      const yRow3 = yRow2 + 90
      doc.rect(20, yRow3, 555, 50).stroke(gridColor)
      doc.fillColor(labelColor)
         .fontSize(6.5)
         .font('Helvetica-Bold')
         .text('OBSERVAÇÃO', 23, yRow3 + 4.5, { width: 549 })

      // Linhas para observação
      doc.lineWidth(0.5).strokeColor('#94a3b8')
      doc.moveTo(25, yRow3 + 22).lineTo(570, yRow3 + 22).stroke()
      doc.moveTo(25, yRow3 + 40).lineTo(570, yRow3 + 40).stroke()
      doc.lineWidth(1).strokeColor(gridColor)

      // Linhas inferiores para Assinatura e Data da Consulta
      const yBottom = yRow3 + 100
      
      // Data da Consulta
      doc.moveTo(20, yBottom).lineTo(200, yBottom).stroke(gridColor)
      doc.fillColor(valueColor)
         .fontSize(9.5)
         .font('Helvetica')
         .text('      /      /', 20, yBottom - 11, { width: 180, align: 'center' })
      doc.fontSize(8)
         .font('Helvetica-Bold')
         .text('DATA DA CONSULTA', 20, yBottom + 3, { width: 180, align: 'center' })

      // Assinatura e carimbo do especialista
      doc.moveTo(325, yBottom).lineTo(575, yBottom).stroke(gridColor)
      doc.fontSize(8)
         .font('Helvetica-Bold')
         .text('ASSINATURA E CARIMBO DO ESPECIALISTA', 325, yBottom + 3, { width: 250, align: 'center' })

      // ─── RODAPÉ (y: 755 a 765) ───
      const formattedPrintDate = new Date().toLocaleDateString('pt-BR')
      const formattedPrintTime = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
      const operName = data.operadorNome || 'Operador GestSus'
      
      doc.fillColor('#475569')
         .fontSize(7)
         .font('Helvetica-Oblique')
         .text(`Impresso em ${formattedPrintDate} às ${formattedPrintTime} por ${operName}.`, 20, 762, { width: 400 })
         .font('Helvetica')
         .text('Pág. 1 / 1', 420, 762, { width: 155, align: 'right' })

      doc.end()
    } catch (err) {
      reject(err)
    }
  })
}

export async function POST(request: NextRequest) {
  try {
    const data = await request.json()
    
    if (!data.nomePaciente) {
      return NextResponse.json({ ok: false, error: 'O nome do paciente é obrigatório.' }, { status: 400 })
    }

    const pdfBuffer = await generateEncaminhamentoPDF(data)
    const uint8Array = new Uint8Array(pdfBuffer)

    return new NextResponse(uint8Array, {
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
