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
           .fontSize(7.5)
           .font('Helvetica-Bold')
           .text(title.toUpperCase(), 25, y + 2.5, { width: 545, align: 'center' })
      }

      // Desenha campos normais
      const drawField = (label: string, value: string | number | null | undefined, x: number, y: number, width: number, height: number, align: 'left' | 'center' | 'right' = 'left') => {
        doc.rect(x, y, width, height).stroke(gridColor)
        
        doc.fillColor(labelColor)
           .fontSize(5.5)
           .font('Helvetica-Bold')
           .text(label.toUpperCase(), x + 3, y + 3, { width: width - 6 })

        if (value !== undefined && value !== null && value !== '') {
          doc.fillColor(valueColor)
             .fontSize(8)
             .font('Helvetica')
             .text(String(value).toUpperCase(), x + 3, y + 12, { width: width - 6, align })
        }
      }

      // Desenha caixas de texto longas
      const drawTextArea = (label: string, value: string | null | undefined, x: number, y: number, width: number, height: number) => {
        doc.rect(x, y, width, height).stroke(gridColor)
        doc.fillColor(labelColor)
           .fontSize(5.5)
           .font('Helvetica-Bold')
           .text(label.toUpperCase(), x + 3, y + 3, { width: width - 6 })

        if (value) {
          doc.fillColor(valueColor)
             .fontSize(7)
             .font('Helvetica')
             .text(String(value).toUpperCase(), x + 3, y + 12, { width: width - 6, align: 'justify', lineGap: 1 })
        }
      }

      // ─── CABEÇALHO (y: 20 a 55) ───
      // SUS Box
      doc.rect(20, 20, 100, 35).stroke(gridColor)
      doc.fillColor(valueColor)
         .fontSize(10)
         .font('Helvetica-Bold')
         .text('SUS', 25, 24, { width: 90, align: 'center' })
      doc.fontSize(5.5)
         .font('Helvetica-Bold')
         .text('Sistema\nÚnico de\nSaúde', 25, 36, { width: 45, align: 'center' })
         .text('Ministério\nda\nSaúde', 70, 36, { width: 45, align: 'center' })

      // Título
      doc.rect(120, 20, 410, 35).stroke(gridColor)
      doc.fillColor(valueColor)
         .fontSize(9.5)
         .font('Helvetica-Bold')
         .text('LAUDO PARA SOLICITAÇÃO/AUTORIZAÇÃO DE\nPROCEDIMENTO AMBULATORIAL', 125, 24, { width: 400, align: 'center' })

      // Folhas fls.
      doc.rect(530, 20, 45, 35).stroke(gridColor)
      doc.fillColor(valueColor)
         .fontSize(9)
         .font('Helvetica-Bold')
         .text('fls.1/2', 530, 32, { width: 45, align: 'center' })

      // ─── IDENTIFICAÇÃO DO ESTABELECIMENTO SOLICITANTE (y: 60 a 95) ───
      drawSectionTitle('IDENTIFICAÇÃO DO ESTABELECIMENTO DE SAÚDE (SOLICITANTE)', 60)
      drawField('1 - NOME DO ESTABELECIMENTO DE SAÚDE SOLICITANTE', data.estabelecimentoSolicitante, 20, 72, 455, 23)
      drawField('2 - CNES', data.cnesSolicitante, 475, 72, 100, 23, 'center')

      // ─── IDENTIFICAÇÃO DO PACIENTE (y: 100 a 255) ───
      drawSectionTitle('IDENTIFICAÇÃO DO PACIENTE', 100)
      // Linha 1
      drawField('3 - NOME DO PACIENTE', data.nomePaciente, 20, 112, 455, 23)
      drawField('4 - Nº DO PRONTUÁRIO', data.numeroProntuario || '', 475, 112, 100, 23, 'center')
      // Linha 2
      const formattedDate = data.dataNascimento ? new Date(data.dataNascimento).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : ''
      drawField('5 - CARTÃO NACIONAL DE SAÚDE (CNS)', data.cnsPaciente, 20, 135, 220, 23, 'center')
      drawField('6 - DATA DE NASCIMENTO', formattedDate, 240, 135, 100, 23, 'center')
      
      const sexoFmt = data.sexo === 'M' ? 'MASC. [X]   FEM. [ ]' : data.sexo === 'F' ? 'MASC. [ ]   FEM. [X]' : 'MASC. [ ]   FEM. [ ]'
      drawField('7 - SEXO', sexoFmt, 340, 135, 135, 23, 'center')
      drawField('8 - RAÇA/COR', data.racaCor || '', 475, 135, 100, 23, 'center')
      
      // Linha 3
      drawField('9 - NOME DA MÃE', data.nomeMae, 20, 158, 385, 23)
      drawField('10 - TELEFONE DE CONTATO', data.telefone, 405, 158, 170, 23, 'center')
      
      // Linha 4
      drawField('11 - NOME DO RESPONSÁVEL', data.nomeResponsavel || '', 20, 181, 385, 23)
      drawField('12 - TELEFONE DE CONTATO', data.telefoneResponsavel || '', 405, 181, 170, 23, 'center')

      // Linha 5
      drawField('13 - ENDEREÇO (RUA, Nº, BAIRRO)', data.enderecoPaciente || '', 20, 204, 555, 23)

      // Linha 6
      drawField('14 - MUNICÍPIO DE RESIDÊNCIA', data.municipioPaciente || 'CONCEIÇÃO DO TOCANTINS', 20, 227, 220, 23)
      drawField('15 - CÓD. IBGE MUNICÍPIO', data.codigoIbge || '1705607', 240, 227, 120, 23, 'center')
      drawField('16 - UF', data.ufPaciente || 'TO', 360, 227, 45, 23, 'center')
      drawField('17 - CEP', data.cep || '', 405, 227, 170, 23, 'center')

      // ─── PROCEDIMENTO SOLICITADO (y: 255 a 290) ───
      drawSectionTitle('PROCEDIMENTO SOLICITADO', 255)
      drawField('18 - CÓDIGO DO PROCEDIMENTO PRINCIPAL', data.codigoSigtap, 20, 267, 180, 23, 'center')
      drawField('19 - NOME DO PROCEDIMENTO PRINCIPAL', data.descricaoProcedimento, 200, 267, 320, 23)
      drawField('20 - QTDE.', data.quantidade || '1', 520, 267, 55, 23, 'center')

      // ─── PROCEDIMENTO(S) SECUNDÁRIO(S) (y: 295 a 425) ───
      drawSectionTitle('PROCEDIMENTO(S) SECUNDÁRIO(S)', 295)
      
      const secList = data.procedimentosSecundarios || []
      const rowsSec = [
        [21, 22, 23],
        [24, 25, 26],
        [27, 28, 29],
        [30, 31, 32],
        [33, 34, 35]
      ]

      rowsSec.forEach((row, idx) => {
        const yRow = 307 + (idx * 23)
        const item = secList[idx] || {}
        drawField(`${row[0]} - CÓDIGO DO PROCEDIMENTO SECUNDÁRIO`, item.codigo || '', 20, yRow, 180, 23, 'center')
        drawField(`${row[1]} - NOME DO PROCEDIMENTO SECUNDÁRIO`, item.nome || '', 200, yRow, 320, 23)
        drawField(`${row[2]} - QTDE.`, item.quantidade || '', 520, yRow, 55, 23, 'center')
      })

      // ─── JUSTIFICATIVA DO(S) PROCEDIMENTO(S) SOLICITADO(S) (y: 425 a 545) ───
      drawSectionTitle('JUSTIFICATIVA DO(S) PROCEDIMENTO(S) SOLICITADO(S)', 427)
      drawField('36 - DESCRIÇÃO DO DIAGNÓSTICO', data.diagnosticoDescricao || '', 20, 439, 280, 23)
      drawField('37 - CID10 PRINCIPAL', data.cid10 || '', 300, 439, 90, 23, 'center')
      drawField('38 - CID10 SECUNDÁRIO', data.cidSecundario || '', 390, 439, 90, 23, 'center')
      drawField('39 - CID10 CAUSAS ASSOCIADAS', data.cidCausasAssociadas || '', 480, 439, 95, 23, 'center')
      
      drawTextArea(
        '40 - OBSERVAÇÕES / JUSTIFICATIVA CLÍNICA',
        data.justificativaClinica || 'Procedimento solicitado via central de regulação do município.',
        20, 462, 555, 60
      )

      // ─── SOLICITAÇÃO (y: 530 a 590) ───
      drawSectionTitle('SOLICITAÇÃO', 527)
      drawField('41 - NOME DO PROFISSIONAL SOLICITANTE', data.nomeMedico, 20, 539, 280, 23)
      
      const formattedSolDate = data.dataSolicitacao ? new Date(data.dataSolicitacao).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : ''
      drawField('42 - DATA DA SOLICITAÇÃO', formattedSolDate, 300, 539, 100, 23, 'center')
      drawField('45 - ASSINATURA E CARIMBO (Nº REGISTRO DO CONSELHO)', data.crmMedico || '', 400, 539, 175, 23)

      const docSolFmt = data.documentoSolicitanteTipo === 'CPF' ? 'CNS ( )  CPF (X)' : data.documentoSolicitanteTipo === 'CNS' ? 'CNS (X)  CPF ( )' : 'CNS ( )  CPF ( )'
      drawField('43 - DOCUMENTO', docSolFmt, 20, 562, 120, 23, 'center')
      drawField('44 - Nº DOCUMENTO (CNS/CPF) DO PROFISSIONAL SOLICITANTE', data.documentoSolicitanteNumero || '', 140, 562, 435, 23, 'center')

      // ─── AUTORIZAÇÃO (y: 590 a 735) ───
      drawSectionTitle('AUTORIZAÇÃO', 590)
      
      // Linha 1
      drawField('46 - NOME DO PROFISSIONAL AUTORIZADOR', '', 20, 602, 230, 23)
      drawField('47 - CÓD. ÓRGÃO EMISSOR', '', 250, 602, 145, 23, 'center')
      
      // Caixa do Número da APAC (52)
      doc.rect(395, 602, 180, 69).stroke(gridColor)
      doc.fillColor(labelColor).fontSize(5.5).font('Helvetica-Bold').text('52 - Nº DA AUTORIZAÇÃO (APAC)', 398, 605)

      // Linha 2
      const docAutFmt = 'CNS ( )  CPF ( )'
      drawField('48 - DOCUMENTO', docAutFmt, 20, 625, 120, 23, 'center')
      drawField('49 - Nº DOCUMENTO (CNS/CPF) DO PROFISSIONAL AUTORIZADOR', '', 140, 625, 255, 23, 'center')

      // Linha 3
      drawField('50 - DATA DA AUTORIZAÇÃO', '', 20, 648, 120, 23, 'center')
      drawField('51 - ASSINATURA E CARIMBO (Nº DO REGISTRO DO CONSELHO)', '', 140, 648, 255, 23)

      // Linha 4
      drawField('53 - PERÍODO DE VALIDADE DA APAC', '', 20, 671, 375, 23, 'center')

      // ─── IDENTIFICAÇÃO DO ESTABELECIMENTO DE SAÚDE EXECUTANTE (y: 700 a 735) ───
      drawSectionTitle('IDENTIFICAÇÃO DO ESTABELECIMENTO DE SAÚDE (EXECUTANTE)', 700)
      drawField('54 - NOME FANTASIA DO ESTABELECIMENTO DE SAÚDE EXECUTANTE', '', 20, 712, 455, 23)
      drawField('55 - CNES', '', 475, 712, 100, 23, 'center')

      // Rodapé institucional
      doc.fillColor('#64748b').fontSize(6).font('Helvetica-Oblique')
         .text('Formulário em conformidade com o modelo nacional do SUS e as regras de regulação local.', 20, 750, { width: 555, align: 'center' })
         .text('Sistema de Saúde Integrado - Secretaria Municipal de Saúde de Conceição do Tocantins.', 20, 760, { width: 555, align: 'center' })

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
