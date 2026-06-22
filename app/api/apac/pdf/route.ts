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

      // Desenha campos normais
      const drawField = (label: string, value: string | number | null | undefined, x: number, y: number, width: number, height: number, align: 'left' | 'center' | 'right' = 'left') => {
        doc.rect(x, y, width, height).stroke(gridColor)
        
        doc.fillColor(labelColor)
           .fontSize(7)
           .font('Helvetica-Bold')
           .text(label.toUpperCase(), x + 3, y + 2, { width: width - 6 })

        if (value !== undefined && value !== null && value !== '') {
          doc.fillColor(valueColor)
             .fontSize(10.5)
             .font('Helvetica')
             .text(String(value).toUpperCase(), x + 3, y + 10.5, { width: width - 6, align })
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
          doc.fillColor(valueColor)
             .fontSize(9.5)
             .font('Helvetica')
             .text(String(value).toUpperCase(), x + 3, y + 12, { width: width - 6, align: 'justify', lineGap: 1 })
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

      // ─── IDENTIFICAÇÃO DO ESTABELECIMENTO SOLICITANTE (y: 60 a 95) ───
      drawSectionTitle('IDENTIFICAÇÃO DO ESTABELECIMENTO DE SAÚDE (SOLICITANTE)', 60)
      drawField('1 - NOME DO ESTABELECIMENTO DE SAÚDE SOLICITANTE', data.estabelecimentoSolicitante, 20, 72, 455, 23)
      drawField('2 - CNES', data.cnesSolicitante, 475, 72, 100, 23, 'center')

      // ─── IDENTIFICAÇÃO DO PACIENTE (y: 100 a 227) ───
      drawSectionTitle('IDENTIFICAÇÃO DO PACIENTE', 100)
      // Linha 1
      drawField('3 - NOME DO PACIENTE', data.nomePaciente, 20, 112, 455, 23)
      drawField('4 - Nº DO PRONTUÁRIO', data.numeroProntuario || '', 475, 112, 100, 23, 'center')
      // Linha 2
      const formattedDate = data.dataNascimento ? new Date(data.dataNascimento).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : ''
      drawField('5 - CARTÃO NACIONAL DE SAÚDE (CNS)', data.cnsPaciente, 20, 135, 255, 23, 'center')
      drawField('6 - DATA DE NASCIMENTO', formattedDate, 275, 135, 130, 23, 'center')
      
      const sexoFmt = data.sexo === 'M' ? 'MASC. [X]   FEM. [ ]' : data.sexo === 'F' ? 'MASC. [ ]   FEM. [X]' : 'MASC. [ ]   FEM. [ ]'
      drawField('7 - SEXO', sexoFmt, 405, 135, 170, 23, 'center')
      
      // Linha 3
      drawField('8 - NOME DA MÃE OU RESPONSÁVEL', data.nomeMae, 20, 158, 385, 23)
      drawField('9 - TELEFONE DE CONTATO', data.telefone, 405, 158, 170, 23, 'center')

      // Linha 4
      drawField('10 - ENDEREÇO (RUA, Nº, BAIRRO)', data.enderecoPaciente || '', 20, 181, 555, 23)

      // Linha 5
      drawField('11 - MUNICÍPIO DE RESIDÊNCIA', data.municipioPaciente || 'CONCEIÇÃO DO TOCANTINS', 20, 204, 220, 23)
      drawField('12 - CÓD. IBGE MUNICÍPIO', data.codigoIbge || '1705607', 240, 204, 120, 23, 'center')
      drawField('13 - UF', data.ufPaciente || 'TO', 360, 204, 45, 23, 'center')
      drawField('14 - CEP', data.cep || '', 405, 204, 170, 23, 'center')

      // ─── PROCEDIMENTO SOLICITADO (y: 232 a 267) ───
      drawSectionTitle('PROCEDIMENTO SOLICITADO', 232)
      drawField('15 - CÓDIGO DO PROCEDIMENTO PRINCIPAL', data.codigoSigtap, 20, 244, 180, 23, 'center')
      drawField('16 - NOME DO PROCEDIMENTO PRINCIPAL', data.descricaoProcedimento, 200, 244, 320, 23)
      drawField('17 - QTDE.', data.quantidade || '1', 520, 244, 55, 23, 'center')

      // ─── PROCEDIMENTO(S) SECUNDÁRIO(S) (y: 272 a 399) ───
      drawSectionTitle('PROCEDIMENTO(S) SECUNDÁRIO(S)', 272)
      
      const secList = data.procedimentosSecundarios || []
      const rowsSec = [
        [18, 19, 20],
        [21, 22, 23],
        [24, 25, 26],
        [27, 28, 29],
        [30, 31, 32]
      ]

      rowsSec.forEach((row, idx) => {
        const yRow = 284 + (idx * 23)
        const item = secList[idx] || {}
        drawField(`${row[0]} - CÓDIGO DO PROCEDIMENTO SECUNDÁRIO`, item.codigo || '', 20, yRow, 180, 23, 'center')
        drawField(`${row[1]} - NOME DO PROCEDIMENTO SECUNDÁRIO`, item.nome || '', 200, yRow, 320, 23)
        drawField(`${row[2]} - QTDE.`, item.quantidade || '', 520, yRow, 55, 23, 'center')
      })

      // ─── JUSTIFICATIVA DO(S) PROCEDIMENTO(S) SOLICITADO(S) (y: 404 a 499) ───
      drawSectionTitle('JUSTIFICATIVA DO(S) PROCEDIMENTO(S) SOLICITADO(S)', 404)
      drawField('33 - DESCRIÇÃO DO DIAGNÓSTICO', data.diagnosticoDescricao || '', 20, 416, 280, 23)
      drawField('34 - CID10 PRINCIPAL', data.cid10 || '', 300, 416, 90, 23, 'center')
      drawField('35 - CID10 SECUNDÁRIO', data.cidSecundario || '', 390, 416, 90, 23, 'center')
      drawField('36 - CID10 CAUSAS ASSOCIADAS', data.cidCausasAssociadas || '', 480, 416, 95, 23, 'center')
      
      drawTextArea(
        '37 - OBSERVAÇÕES / JUSTIFICATIVA CLÍNICA',
        data.justificativaClinica || 'Procedimento solicitado via central de regulação do município.',
        20, 439, 555, 60
      )

      // ─── SOLICITAÇÃO (y: 504 a 562) ───
      drawSectionTitle('SOLICITAÇÃO', 504)
      drawField('38 - NOME DO PROFISSIONAL SOLICITANTE', data.nomeMedico, 20, 516, 280, 23)
      
      const formattedSolDate = data.dataSolicitacao ? new Date(data.dataSolicitacao).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : ''
      drawField('39 - DATA DA SOLICITAÇÃO', formattedSolDate, 300, 516, 100, 23, 'center')
      drawField('42 - ASSINATURA E CARIMBO (Nº REGISTRO DO CONSELHO)', data.crmMedico || '', 400, 516, 175, 23)

      const docSolFmt = data.documentoSolicitanteTipo === 'CPF' ? 'CNS ( )  CPF (X)' : data.documentoSolicitanteTipo === 'CNS' ? 'CNS (X)  CPF ( )' : 'CNS ( )  CPF ( )'
      drawField('40 - DOCUMENTO', docSolFmt, 20, 539, 120, 23, 'center')
      drawField('41 - Nº DOCUMENTO (CNS/CPF) DO PROFISSIONAL SOLICITANTE', data.documentoSolicitanteNumero || '', 140, 539, 435, 23, 'center')

      // ─── AUTORIZAÇÃO (y: 567 a 648) ───
      drawSectionTitle('AUTORIZAÇÃO', 567)
      
      // Linha 1 (Esquerda)
      drawField('43 - NOME DO PROFISSIONAL AUTORIZADOR', '', 20, 579, 230, 23)
      drawField('44 - CÓD. ÓRGÃO EMISSOR', '', 250, 579, 145, 23, 'center')
      
      // Caixa do Número da APAC (49) - Direita (Linhas 1 e 2)
      doc.rect(395, 579, 180, 46).stroke(gridColor)
      doc.fillColor(labelColor).fontSize(7).font('Helvetica-Bold').text('49 - Nº DA AUTORIZAÇÃO (APAC)', 398, 582)

      // Linha 2 (Esquerda)
      const docAutFmt = 'CNS ( )  CPF ( )'
      drawField('45 - DOCUMENTO', docAutFmt, 20, 602, 120, 23, 'center')
      drawField('46 - Nº DOCUMENTO (CNS/CPF) DO PROFISSIONAL AUTORIZADOR', '', 140, 602, 255, 23, 'center')

      // Linha 3 (Esquerda)
      drawField('47 - DATA DA AUTORIZAÇÃO', '', 20, 625, 120, 23, 'center')
      drawField('48 - ASSINATURA E CARIMBO (Nº DO REGISTRO DO CONSELHO)', '', 140, 625, 255, 23)

      // Linha 3 (Direita) - Período de validade da APAC (50)
      doc.rect(395, 625, 180, 23).stroke(gridColor)
      doc.fillColor(labelColor).fontSize(7).font('Helvetica-Bold').text('50 - PERÍODO DE VALIDADE DA APAC', 398, 628)
      doc.fillColor(valueColor).fontSize(9.5).font('Helvetica').text('      /      /      a      /      /      ', 398, 636, { width: 174, align: 'center' })

      // ─── IDENTIFICAÇÃO DO ESTABELECIMENTO DE SAÚDE EXECUTANTE (y: 654 a 689) ───
      drawSectionTitle('IDENTIFICAÇÃO DO ESTABELECIMENTO DE SAÚDE (EXECUTANTE)', 654)
      drawField('51 - NOME FANTASIA DO ESTABELECIMENTO DE SAÚDE EXECUTANTE', '', 20, 666, 455, 23)
      drawField('52 - CNES', '', 475, 666, 100, 23, 'center')

      // Rodapé institucional
      doc.fillColor('#64748b').fontSize(6).font('Helvetica-Oblique')
         .text('Formulário em conformidade com o modelo nacional do SUS e as regras de regulação local.', 20, 704, { width: 555, align: 'center' })
         .text('Sistema de Saúde Integrado - Secretaria Municipal de Saúde de Conceição do Tocantins.', 20, 714, { width: 555, align: 'center' })

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
