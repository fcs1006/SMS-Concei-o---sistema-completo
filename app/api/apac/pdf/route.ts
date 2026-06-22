import { NextRequest, NextResponse } from 'next/server'
import PDFDocument from 'pdfkit'

function generateAPACPDF(data: any): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      // Ajustamos a margem para 20 para maximizar o uso da folha A4
      const doc = new PDFDocument({ size: 'A4', margin: 20 })
      const chunks: any[] = []
      
      doc.on('data', (chunk: any) => chunks.push(chunk))
      doc.on('end', () => resolve(Buffer.concat(chunks)))
      doc.on('error', (err: any) => reject(err))

      // Paleta de cores
      const gridColor = '#000000' // Preto fino para as bordas para ficar igual ao formulário oficial
      const labelColor = '#000000'
      const valueColor = '#000000'
      
      // Desenha barra preta com título branco
      const drawSectionTitle = (title: string, y: number) => {
        doc.rect(20, y, 555, 12).fill('#000000')
        doc.fillColor('#ffffff')
           .fontSize(9)
           .font('Helvetica-Bold')
           .text(title.toUpperCase(), 25, y + 1.5, { width: 545, align: 'center' })
      }

      // Desenha campos normais com escala dinâmica de fonte para evitar quebras
      const drawField = (label: string, value: string | number | null | undefined, x: number, y: number, width: number, height: number, align: 'left' | 'center' | 'right' = 'left') => {
        doc.rect(x, y, width, height).stroke(gridColor)
        
        doc.fillColor(labelColor)
           .fontSize(7)
           .font('Helvetica-Bold')
           .text(label.toUpperCase(), x + 3, y + 2.5, { width: width - 6 })

        if (value !== undefined && value !== null && value !== '') {
          const valStr = String(value).toUpperCase().trim().replace(/\s+/g, ' ')
          
          let currentSize = 10.5
          doc.font('Helvetica').fontSize(currentSize)
          let textWidth = doc.widthOfString(valStr)
          
          while (textWidth > width - 8 && currentSize > 7) {
            currentSize -= 0.5
            doc.fontSize(currentSize)
            textWidth = doc.widthOfString(valStr)
          }
          
          const yVal = y + 11.5 + (10.5 - currentSize) * 0.35
          
          doc.fillColor(valueColor)
             .text(valStr, x + 4, yVal, { width: width - 8, align })
        }
      }

      // Desenha caixas de texto longas
      const drawTextArea = (label: string, value: string | null | undefined, x: number, y: number, width: number, height: number) => {
        doc.rect(x, y, width, height).stroke(gridColor)
        doc.fillColor(labelColor)
           .fontSize(7)
           .font('Helvetica-Bold')
           .text(label.toUpperCase(), x + 3, y + 3, { width: width - 6 })

        if (value) {
          const valStr = String(value).toUpperCase().trim().replace(/\s+/g, ' ')
          doc.fillColor(valueColor)
             .fontSize(9.5)
             .font('Helvetica')
             .text(valStr, x + 3, y + 12, { width: width - 6, align: 'justify', lineGap: 1 })
        }
      }

      // ─── CABEÇALHO (y: 20 a 55) ───
      // SUS Box
      doc.rect(20, 20, 100, 35).stroke(gridColor)
      doc.fillColor(valueColor)
         .fontSize(14)
         .font('Helvetica-Bold')
         .text('SUS', 25, 20, { width: 90, align: 'center' })
      doc.fontSize(7)
         .font('Helvetica-Bold')
         .text('Sistema\nÚnico de\nSaúde', 25, 33, { width: 45, align: 'center' })
         .text('Ministério\nda\nSaúde', 70, 33, { width: 45, align: 'center' })

      // Título
      doc.rect(120, 20, 410, 35).stroke(gridColor)
      doc.fillColor(valueColor)
         .fontSize(12)
         .font('Helvetica-Bold')
         .text('LAUDO PARA SOLICITAÇÃO/AUTORIZAÇÃO DE\nPROCEDIMENTO AMBULATORIAL', 125, 21, { width: 400, align: 'center' })

      // Folhas fls.
      doc.rect(530, 20, 45, 35).stroke(gridColor)
      doc.fillColor(valueColor)
         .fontSize(11)
         .font('Helvetica-Bold')
         .text('fls.1/2', 530, 30, { width: 45, align: 'center' })

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
      const formattedDate = data.dataNascimento ? new Date(data.dataNascimento).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : ''
      drawField('5 - CARTÃO NACIONAL DE SAÚDE (CNS)', data.cnsPaciente, 20, 142, 255, 25, 'center')
      drawField('6 - DATA DE NASCIMENTO', formattedDate, 275, 142, 130, 25, 'center')
      
      const sexoFmt = data.sexo === 'M' ? 'MASC. [X]   FEM. [ ]' : data.sexo === 'F' ? 'MASC. [ ]   FEM. [X]' : 'MASC. [ ]   FEM. [ ]'
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
        const yRow = 307 + (idx * 25)
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
        20, 477, 555, 60
      )

      // ─── SOLICITAÇÃO (y: 545 a 607) ───
      drawSectionTitle('SOLICITAÇÃO', 545)
      drawField('38 - NOME DO PROFISSIONAL SOLICITANTE', data.nomeMedico, 20, 557, 280, 25)
      
      const formattedSolDate = data.dataSolicitacao ? new Date(data.dataSolicitacao).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : ''
      drawField('39 - DATA DA SOLICITAÇÃO', formattedSolDate, 300, 557, 100, 25, 'center')
      drawField('42 - ASSINATURA E CARIMBO (Nº REGISTRO DO CONSELHO)', data.crmMedico || '', 400, 557, 175, 25, 'right')

      const docSolFmt = data.documentoSolicitanteTipo === 'CPF' ? 'CNS ( )  CPF (X)' : data.documentoSolicitanteTipo === 'CNS' ? 'CNS (X)  CPF ( )' : 'CNS ( )  CPF ( )'
      drawField('40 - DOCUMENTO', docSolFmt, 20, 582, 120, 25, 'center')
      drawField('41 - Nº DOCUMENTO (CNS/CPF) DO PROFISSIONAL SOLICITANTE', data.documentoSolicitanteNumero || '', 140, 582, 435, 25, 'center')

      // ─── AUTORIZAÇÃO (y: 615 a 702) ───
      drawSectionTitle('AUTORIZAÇÃO', 615)
      
      // Linha 1 (Esquerda)
      drawField('43 - NOME DO PROFISSIONAL AUTORIZADOR', '', 20, 627, 230, 25)
      drawField('44 - CÓD. ÓRGÃO EMISSOR', '', 250, 627, 145, 25, 'center')
      
      // Caixa do Número da APAC (49) - Direita (Linhas 1 e 2)
      doc.rect(395, 627, 180, 50).stroke(gridColor)
      doc.fillColor(labelColor).fontSize(7).font('Helvetica-Bold').text('49 - Nº DA AUTORIZAÇÃO (APAC)', 398, 630)

      // Linha 2 (Esquerda)
      const docAutFmt = 'CNS ( )  CPF ( )'
      drawField('45 - DOCUMENTO', docAutFmt, 20, 652, 120, 25, 'center')
      drawField('46 - Nº DOCUMENTO (CNS/CPF) DO PROFISSIONAL AUTORIZADOR', '', 140, 652, 255, 25, 'center')

      // Linha 3 (Esquerda)
      drawField('47 - DATA DA AUTORIZAÇÃO', '', 20, 677, 120, 25, 'center')
      drawField('48 - ASSINATURA E CARIMBO (Nº DO REGISTRO DO CONSELHO)', '', 140, 677, 255, 25)

      // Linha 3 (Direita) - Período de validade da APAC (50)
      doc.rect(395, 677, 180, 25).stroke(gridColor)
      doc.fillColor(labelColor).fontSize(7).font('Helvetica-Bold').text('50 - PERÍODO DE VALIDADE DA APAC', 398, 680)
      doc.fillColor(valueColor).fontSize(9.5).font('Helvetica').text('      /      /      a      /      /      ', 398, 688, { width: 174, align: 'center' })

      // ─── IDENTIFICAÇÃO DO ESTABELECIMENTO DE SAÚDE EXECUTANTE (y: 710 a 747) ───
      drawSectionTitle('IDENTIFICAÇÃO DO ESTABELECIMENTO DE SAÚDE (EXECUTANTE)', 710)
      drawField('51 - NOME FANTASIA DO ESTABELECIMENTO DE SAÚDE EXECUTANTE', '', 20, 722, 455, 25)
      drawField('52 - CNES', '', 475, 722, 100, 25, 'center')

      // Rodapé institucional
      doc.fillColor('#64748b').fontSize(6.5).font('Helvetica-Oblique')
         .text('Formulário em conformidade com o modelo nacional do SUS e as regras de regulação local.', 20, 760, { width: 555, align: 'center' })
         .text('Sistema de Saúde Integrado - Secretaria Municipal de Saúde de Conceição do Tocantins.', 20, 770, { width: 555, align: 'center' })

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

    const pdfBuffer = await generateAPACPDF(data)
    const uint8Array = new Uint8Array(pdfBuffer)

    return new NextResponse(uint8Array, {
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
