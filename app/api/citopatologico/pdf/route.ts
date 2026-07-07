import { NextRequest, NextResponse } from 'next/server'
import PDFDocument from 'pdfkit'

function generateCitopatologicoPDF(data: any): Promise<Buffer> {
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

      // Helper para desenhar campos com bordas
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
        doc.rect(x, y, width, height).stroke(gridColor)
        
        doc.fillColor(labelColor)
           .fontSize(6.5)
           .font('Helvetica-Bold')
           .text(label.toUpperCase(), x + 3, y + 3, { width: width - 6 })

        if (value !== undefined && value !== null && value !== '') {
          const valStr = String(value).toUpperCase().trim()
          
          let currentSize = valFontSize
          doc.font('Helvetica').fontSize(currentSize)
          let textWidth = doc.widthOfString(valStr)
          
          while (textWidth > width - 8 && currentSize > 7) {
            currentSize -= 0.5
            doc.fontSize(currentSize)
            textWidth = doc.widthOfString(valStr)
          }
          
          const yVal = y + 11.5 + (valFontSize - currentSize) * 0.35
          
          doc.fillColor(valueColor)
             .text(valStr, x + 4, yVal, { width: width - 8, align })
        }
      }

      // Helper para desenhar caixas de seção preenchidas
      const drawSectionTitle = (title: string, y: number) => {
        doc.rect(20, y, 555, 14).fill('#000000')
        doc.fillColor('#ffffff')
           .fontSize(8.5)
           .font('Helvetica-Bold')
           .text(title.toUpperCase(), 25, y + 3, { width: 545, align: 'center' })
      }

      // Helper para desenhar checkboxes
      const drawCheckbox = (label: string, isChecked: boolean, x: number, y: number, labelSize = 8) => {
        doc.rect(x, y, 7, 7).stroke(gridColor)
        if (isChecked) {
          doc.fillColor(valueColor)
             .fontSize(6.5)
             .font('Helvetica-Bold')
             .text('X', x + 1, y + 0.5)
        }
        doc.fillColor(labelColor)
           .fontSize(labelSize)
           .font('Helvetica')
           .text(label, x + 10, y + 0.5)
      }

      // ==========================================
      // PAGINA 1: REQUISIÇÃO (FRENTE)
      // ==========================================
      
      // Cabeçalho Oficial
      doc.rect(20, 20, 180, 24).stroke(gridColor)
      doc.fillColor(valueColor)
         .fontSize(10)
         .font('Helvetica-Bold')
         .text('MINISTÉRIO DA SAÚDE', 25, 27, { width: 170, align: 'left' })

      doc.rect(200, 20, 375, 24).stroke(gridColor)
      doc.fillColor(valueColor)
         .fontSize(9.5)
         .font('Helvetica-Bold')
         .text('REQUISIÇÃO DE EXAME CITOPATOLÓGICO - COLO DO ÚTERO', 205, 24, { width: 365, align: 'center' })
         .fontSize(7.5)
         .font('Helvetica-Oblique')
         .text('Programa Nacional de Controle do Câncer do Colo do Útero', 205, 33, { width: 365, align: 'center' })

      // Linha 1 Unidade
      drawField('UF', data.ufUnidade, 20, 48, 30, 22, 'center')
      drawField('CNES da Unidade de Saúde', data.cnesUnidade, 55, 48, 110, 22, 'center')
      drawField('Unidade de Saúde', data.unidadeSaude, 170, 48, 235, 22)
      
      const protocoloVal = data.numeroProtocolo || ''
      drawField('Nº Protocolo', protocoloVal, 410, 48, 165, 22, 'center', 9)

      // Linha 2 Unidade
      drawField('Município da Unidade', data.municipioUnidade, 20, 73, 385, 22)
      drawField('Prontuário', data.prontuario || '—', 410, 73, 165, 22, 'center')

      // Seção: Informações Pessoais
      drawSectionTitle('Informações Pessoais', 100)

      // CNS
      drawField('Cartão SUS*', data.cnsPaciente, 20, 114, 555, 22)
      // Nome Completo
      drawField('Nome Completo da Mulher*', data.nomePaciente, 20, 139, 555, 22)
      // Mãe
      drawField('Nome Completo da Mãe*', data.nomeMae, 20, 164, 555, 22)
      // Apelido
      drawField('Apelido da Mulher', data.apelido || '—', 20, 189, 555, 22)
      
      // CPF e Nacionalidade
      drawField('CPF', data.cpfPaciente || '—', 20, 214, 180, 22, 'center')
      drawField('Nacionalidade', data.nacionalidade || 'BRASILEIRA', 205, 214, 370, 22)

      // Nasc, Idade, Raça
      const dataNascFmt = data.dataNascimento ? data.dataNascimento.split('-').reverse().join('/') : '—'
      drawField('Data de Nascimento*', dataNascFmt, 20, 239, 130, 22, 'center')
      drawField('Idade', data.idade || '—', 155, 239, 60, 22, 'center')
      
      // Raça/cor boxes
      const rY = 239
      doc.rect(220, rY, 355, 22).stroke(gridColor)
      doc.fillColor(labelColor).fontSize(6).font('Helvetica-Bold').text('RAÇA/COR', 223, rY + 3)
      drawCheckbox('Branca', data.raca === '01', 225, rY + 11)
      drawCheckbox('Preta', data.raca === '02', 270, rY + 11)
      drawCheckbox('Parda', data.raca === '03', 315, rY + 11)
      drawCheckbox('Amarela', data.raca === '04', 360, rY + 11)
      drawCheckbox('Indígena/Etnia', data.raca === '05', 415, rY + 11)

      // Residência
      drawField('Dados Residenciais: Logradouro', data.logradouro || '—', 20, 264, 555, 22)
      
      drawField('Número', data.numero || '—', 20, 289, 80, 22, 'center')
      drawField('Complemento', data.complemento || '—', 100, 289, 120, 22)
      drawField('Bairro', data.bairro || '—', 225, 289, 195, 22)
      drawField('UF', data.ufResidencia || 'TO', 425, 289, 30, 22, 'center')
      drawField('Código do Município', data.codigoMunicipio || '170560', 460, 289, 115, 22, 'center')

      drawField('Município', data.municipio || 'CONCEIÇÃO DO TOCANTINS', 20, 314, 215, 22)
      drawField('CEP', data.cep || '77305000', 240, 314, 85, 22, 'center')
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
      drawField('DDD / Telefone', telVal, 330, 314, 110, 22, 'center')
      drawField('Ponto de Referência', data.pontoReferencia || '—', 445, 314, 130, 22)

      // Escolaridade boxes
      const escY = 339
      doc.rect(20, escY, 555, 22).stroke(gridColor)
      doc.fillColor(labelColor).fontSize(6).font('Helvetica-Bold').text('ESCOLARIDADE', 23, escY + 3)
      drawCheckbox('Analfabeta', data.escolaridade === 'Analfabeta', 25, escY + 11)
      drawCheckbox('F. Incompleto', data.escolaridade === 'Ensino Fundamental Incompleto', 95, escY + 11)
      drawCheckbox('F. Completo', data.escolaridade === 'Ensino Fundamental Completo', 185, escY + 11)
      drawCheckbox('Médio Completo', data.escolaridade === 'Ensino Médio Completo', 270, escY + 11)
      drawCheckbox('Superior Completo', data.escolaridade === 'Ensino Superior Completo', 370, escY + 11)

      // Seção: Anamnese
      drawSectionTitle('Dados da Anamnese', 370)

      // Grid Anamnese (Esquerda / Direita)
      const aY = 384
      doc.rect(20, aY, 275, 200).stroke(gridColor) // Coluna Esquerda
      doc.rect(300, aY, 275, 200).stroke(gridColor) // Coluna Direita
             // Coluna Esquerda Conteúdo
      let cy = aY + 5
      doc.fillColor(labelColor).font('Helvetica-Bold').fontSize(8.5).text('1. Motivo do exame*', 25, cy)
      cy += 11
      drawCheckbox('Rastreamento', data.motivoExame === 'Rastreamento', 28, cy)
      drawCheckbox('Repetição', data.motivoExame === 'Repetição', 105, cy)
      drawCheckbox('Seguimento', data.motivoExame === 'Seguimento', 170, cy)

      cy += 16
      doc.fillColor(labelColor).font('Helvetica-Bold').fontSize(8.5).text('2. Fez o exame preventivo alguma vez?*', 25, cy)
      cy += 11
      drawCheckbox('Sim', data.fezPreventivo === 'Sim', 28, cy)
      drawCheckbox('Não', data.fezPreventivo === 'Não', 75, cy)
      drawCheckbox('Não sabe', data.fezPreventivo === 'Não sabe', 120, cy)
      if (data.fezPreventivo === 'Sim') {
        doc.fillColor(valueColor).fontSize(8.5).font('Helvetica').text(`Ano: ${data.preventivoAno || '—'}`, 185, cy)
      }

      cy += 18
      doc.fillColor(labelColor).font('Helvetica-Bold').fontSize(8.5).text('3. Usa DIU?*', 25, cy)
      cy += 11
      drawCheckbox('Sim', data.usaDiu === 'Sim', 28, cy)
      drawCheckbox('Não', data.usaDiu === 'Não', 75, cy)
      drawCheckbox('Não sabe', data.usaDiu === 'Não sabe', 120, cy)

      cy += 16
      doc.fillColor(labelColor).font('Helvetica-Bold').fontSize(8.5).text('4. Está grávida?*', 25, cy)
      cy += 11
      drawCheckbox('Sim', data.estaGravida === 'Sim', 28, cy)
      drawCheckbox('Não', data.estaGravida === 'Não', 75, cy)
      drawCheckbox('Não sabe', data.estaGravida === 'Não sabe', 120, cy)

      cy += 16
      doc.fillColor(labelColor).font('Helvetica-Bold').fontSize(8.5).text('5. Usa pílula anticoncepcional?*', 25, cy)
      cy += 11
      drawCheckbox('Sim', data.usaPilula === 'Sim', 28, cy)
      drawCheckbox('Não', data.usaPilula === 'Não', 75, cy)
      drawCheckbox('Não sabe', data.usaPilula === 'Não sabe', 120, cy)

      cy += 16
      doc.fillColor(labelColor).font('Helvetica-Bold').fontSize(8)
         .text('6. Usa hormônio / remédio para menopausa?*', 25, cy)
      cy += 11
      drawCheckbox('Sim', data.usaHormonioMenopausa === 'Sim', 28, cy)
      drawCheckbox('Não', data.usaHormonioMenopausa === 'Não', 75, cy)
      drawCheckbox('Não sabe', data.usaHormonioMenopausa === 'Não sabe', 120, cy)

      // Coluna Direita Conteúdo
      cy = aY + 5
      doc.fillColor(labelColor).font('Helvetica-Bold').fontSize(8.5).text('7. Já fez tratamento por radioterapia?*', 305, cy)
      cy += 11
      drawCheckbox('Sim', data.tratamentoRadioterapia === 'Sim', 308, cy)
      drawCheckbox('Não', data.tratamentoRadioterapia === 'Não', 355, cy)
      drawCheckbox('Não sabe', data.tratamentoRadioterapia === 'Não sabe', 400, cy)

      cy += 16
      doc.fillColor(labelColor).font('Helvetica-Bold').fontSize(8.5).text('8. Data da última menstruação / regra (DUM)*', 305, cy)
      cy += 11
      if (data.dumNaoSabe) {
        drawCheckbox('Não sabe / Não lembra', true, 308, cy)
      } else {
        const dumVal = data.dataUltimaMenstruacao ? data.dataUltimaMenstruacao.split('-').reverse().join('/') : '—'
        doc.fillColor(valueColor).fontSize(8.5).font('Helvetica-Bold').text(`DATA: ${dumVal}`, 308, cy)
      }

      cy += 18
      doc.fillColor(labelColor).font('Helvetica-Bold').fontSize(8.5)
         .text('9. Tem ou teve algum sangramento após relações sexuais?*', 305, cy)
      cy += 11
      drawCheckbox('Sim', data.sangramentoAposRacao === 'Sim', 308, cy)
      drawCheckbox('Não / Não sabe / Não lembra', data.sangramentoAposRacao !== 'Sim', 355, cy)

      cy += 20
      doc.fillColor(labelColor).font('Helvetica-Bold').fontSize(8.5)
         .text('10. Tem ou teve algum sangramento após a menopausa?*', 305, cy)
      cy += 11
      drawCheckbox('Sim', data.sangramentoAposMenopausa === 'Sim', 308, cy)
      drawCheckbox('Não / Não sabe / Não lembra / Não na menopausa', data.sangramentoAposMenopausa !== 'Sim', 355, cy)

      // Seção: Exame Clínico
      drawSectionTitle('Exame Clínico', 592)

      const ecY = 606
      doc.rect(20, ecY, 275, 45).stroke(gridColor)
      doc.rect(300, ecY, 275, 45).stroke(gridColor)

      // Inspeção do colo
      doc.fillColor(labelColor).font('Helvetica-Bold').fontSize(8.5).text('11. Inspeção do colo*', 25, ecY + 4)
      drawCheckbox('Normal', data.inspecaoColo === 'Normal', 28, ecY + 15)
      drawCheckbox('Ausente', data.inspecaoColo === 'Ausente', 90, ecY + 15)
      drawCheckbox('Alterado', data.inspecaoColo === 'Alterado', 150, ecY + 15)
      drawCheckbox('Não visualizado', data.inspecaoColo === 'Colo não visualizado', 210, ecY + 15)

      // Sinais DST
      doc.fillColor(labelColor).font('Helvetica-Bold').fontSize(8.5).text('12. Sinais sugestivos de DST?*', 305, ecY + 4)
      drawCheckbox('Sim', data.sinaisDst === 'Sim', 308, ecY + 18)
      drawCheckbox('Não', data.sinaisDst === 'Não', 360, ecY + 18)

      // Nota importante
      const nY = 658
      doc.rect(20, nY, 555, 24).fill('#f1f5f9')
      doc.rect(20, nY, 555, 24).stroke(gridColor)
      doc.fillColor(valueColor).fontSize(7.5).font('Helvetica-Bold')
         .text('NOTA: Na presença de colo alterado, com lesão sugestiva de câncer, não aguardar o resultado do exame citopatológico para encaminhar a mulher para colposcopia.', 25, nY + 4, { width: 545, align: 'center' })

      // Coleta & Responsável
      const colDataFmt = data.dataColeta ? data.dataColeta.split('-').reverse().join('/') : '—'
      drawField('Data da Coleta*', colDataFmt, 20, 690, 160, 28, 'center', 10.5)
      
      const respVal = data.responsavel || '—'
      drawField('Responsável / Assinatura e Carimbo*', respVal, 190, 690, 385, 28, 'center', 10.5)

      // Nota do final da página
      doc.fillColor('#64748b').fontSize(7).font('Helvetica-Oblique').text('Atenção: Os campos com asterisco (*) são obrigatórios', 390, 802, { width: 185, align: 'right' })

      // ==========================================
      // PAGINA 2: RESULTADOS (VERSO EM BRANCO)
      // ==========================================
      doc.addPage()

      // Título do Laboratório
      doc.rect(20, 20, 555, 30).stroke(gridColor)
      doc.fillColor(valueColor)
         .fontSize(10.5)
         .font('Helvetica-Bold')
         .text('IDENTIFICAÇÃO DO LABORATÓRIO', 20, 24, { width: 555, align: 'center' })

      drawField('CNES do Laboratório*', '', 20, 50, 160, 26)
      drawField('Nome do Laboratório*', '', 180, 50, 220, 26)
      drawField('Número do Exame*', '', 400, 50, 95, 26)
      drawField('Recebido em*', '', 495, 50, 80, 26, 'center')

      // Título Resultado
      doc.rect(20, 90, 555, 16).fill('#000000')
      doc.fillColor('#ffffff')
         .fontSize(9.5)
         .font('Helvetica-Bold')
         .text('RESULTADO DO EXAME CITOPATOLÓGICO - COLO DO ÚTERO', 20, 94, { width: 555, align: 'center' })

      // 1. Avaliação Pré-Analítica
      doc.rect(20, 120, 270, 110).stroke(gridColor)
      doc.fillColor(labelColor).font('Helvetica-Bold').fontSize(8).text('AVALIAÇÃO PRÉ-ANALÍTICA', 23, 124)
      doc.fontSize(7.5).text('AMOSTRA REJEITADA POR:', 23, 136)
      drawCheckbox('Ausência ou erro na identificação da lâmina/frasco', false, 25, 148, 7)
      drawCheckbox('Lâmina danificada ou ausente', false, 25, 161, 7)
      drawCheckbox('Causas alheias ao laboratório; especificar:', false, 25, 174, 7)
      drawCheckbox('Outras causas; especificar:', false, 25, 187, 7)
      
      // Linhas pontilhadas sob especificações
      doc.lineCap('square').lineWidth(0.5).dash(2, { space: 2 }).moveTo(175, 179).lineTo(285, 179).stroke()
      doc.lineCap('square').lineWidth(0.5).dash(2, { space: 2 }).moveTo(125, 192).lineTo(285, 192).stroke()
      doc.undash()

      // 2. Epitélios representados
      doc.rect(20, 245, 270, 52).stroke(gridColor)
      doc.fillColor(labelColor).font('Helvetica-Bold').fontSize(8).text('EPITÉLIOS REPRESENTADOS NA AMOSTRA:*', 23, 249)
      drawCheckbox('Escamoso', false, 25, 265, 7.5)
      drawCheckbox('Glandular', false, 95, 265, 7.5)
      drawCheckbox('Metaplásico', false, 165, 265, 7.5)

      // 3. Adequabilidade
      doc.rect(300, 120, 275, 177).stroke(gridColor)
      doc.fillColor(labelColor).font('Helvetica-Bold').fontSize(8).text('ADEQUABILIDADE DO MATERIAL*', 303, 124)
      drawCheckbox('Satisfatória', false, 305, 136, 7.5)
      drawCheckbox('Insatisfatória para avaliação oncótica devido a:', false, 305, 148, 7.5)
      
      const adY = 162
      drawCheckbox('Material acelular ou hipocelular em menos de 10% do esfregaço', false, 312, adY, 6.5)
      drawCheckbox('Sangue em mais de 75% do esfregaço', false, 312, adY + 12, 6.5)
      drawCheckbox('Piócitos em mais de 75% do esfregaço', false, 312, adY + 24, 6.5)
      drawCheckbox('Artefatos de dessecamento em mais de 75% do esfregaço', false, 312, adY + 36, 6.5)
      drawCheckbox('Contaminantes externos em mais de 75% do esfregaço', false, 312, adY + 48, 6.5)
      drawCheckbox('Intensa superposição celular em mais de 75% do esfregaço', false, 312, adY + 60, 6.5)
      drawCheckbox('Outros, especificar:', false, 312, adY + 72, 6.5)
      doc.lineCap('square').lineWidth(0.5).dash(2, { space: 2 }).moveTo(395, adY + 77).lineTo(570, adY + 77).stroke()
      doc.undash()

      // Diagnóstico Descritivo
      doc.rect(20, 312, 555, 16).fill('#000000')
      doc.fillColor('#ffffff').fontSize(9.5).font('Helvetica-Bold').text('DIAGNÓSTICO DESCRITIVO', 20, 316, { width: 555, align: 'center' })

      const dY = 340
      // Dentro dos limites
      doc.rect(20, dY, 270, 32).stroke(gridColor)
      doc.fillColor(labelColor).font('Helvetica-Bold').fontSize(8).text('DENTRO DOS LIMITES DA NORMALIDADE?', 23, dY + 4)
      drawCheckbox('Sim', false, 25, dY + 16, 7.5)
      drawCheckbox('Não', false, 75, dY + 16, 7.5)

      // Benignas
      doc.rect(20, dY + 38, 270, 110).stroke(gridColor)
      doc.fillColor(labelColor).font('Helvetica-Bold').fontSize(8).text('ALTERAÇÕES CELULARES BENIGNAS OU REPARATIVAS', 23, dY + 42)
      const bgY = dY + 54
      drawCheckbox('Inflamação', false, 25, bgY, 7.5)
      drawCheckbox('Metaplasia escamosa imatura', false, 25, bgY + 13, 7.5)
      drawCheckbox('Reparação', false, 25, bgY + 26, 7.5)
      drawCheckbox('Atrofia com inflamação', false, 25, bgY + 39, 7.5)
      drawCheckbox('Radiação', false, 25, bgY + 52, 7.5)
      drawCheckbox('Outros; especificar:', false, 25, bgY + 65, 7.5)
      
      // Microbiologia
      doc.rect(20, dY + 154, 270, 175).stroke(gridColor)
      doc.fillColor(labelColor).font('Helvetica-Bold').fontSize(8).text('MICROBIOLOGIA', 23, dY + 158)
      const micY = dY + 170
      drawCheckbox('Lactobacillus sp', false, 25, micY, 7.5)
      drawCheckbox('Cocos', false, 25, micY + 13, 7.5)
      drawCheckbox('Sugestivo de Chlamydia sp', false, 25, micY + 26, 7.5)
      drawCheckbox('Actinomyces sp', false, 25, micY + 39, 7.5)
      drawCheckbox('Candida sp', false, 25, micY + 52, 7.5)
      drawCheckbox('Trichomonas vaginalis', false, 25, micY + 65, 7.5)
      drawCheckbox('Efeito citopático compatível com vírus do grupo Herpes', false, 25, micY + 78, 7.5)
      drawCheckbox('Bacilos supracitoplasmáticos (Gardnerella/Mobiluncus)', false, 25, micY + 91, 7.5)
      drawCheckbox('Outros bacilos', false, 25, micY + 104, 7.5)
      drawCheckbox('Outros; especificar:', false, 25, micY + 117, 7.5)

      // Células Atípicas
      const catY = dY
      doc.rect(300, catY, 275, 329).stroke(gridColor)
      doc.fillColor(labelColor).font('Helvetica-Bold').fontSize(8).text('CÉLULAS ATÍPICAS DE SIGNIFICADO INDETERMINADO', 303, catY + 3)
      
      doc.font('Helvetica-Bold').fontSize(7.5).text('ESCAMOSAS:', 303, catY + 14)
      drawCheckbox('Possivelmente não neoplásicas (ASC-US)', false, 305, catY + 24, 7)
      drawCheckbox('Não se pode afastar lesão de alto grau (ASC-H)', false, 305, catY + 36, 7)
      
      doc.font('Helvetica-Bold').fontSize(7.5).text('GLANDULARES:', 303, catY + 50)
      drawCheckbox('Possivelmente não neoplásicas', false, 305, catY + 60, 7)
      drawCheckbox('Não se pode afastar lesão de alto grau', false, 305, catY + 72, 7)

      doc.font('Helvetica-Bold').fontSize(7.5).text('DE ORIGEM INDEFINIDA:', 303, catY + 86)
      drawCheckbox('Possivelmente não neoplásicas', false, 305, catY + 96, 7)
      drawCheckbox('Não se pode afastar lesão de alto grau', false, 305, catY + 108, 7)

      doc.font('Helvetica-Bold').fontSize(8).text('ATIPIAS EM CÉLULAS ESCAMOSAS', 303, catY + 124)
      drawCheckbox('Lesão intra-epitelial de baixo grau (HPV / NIC I)', false, 305, catY + 134, 7)
      drawCheckbox('Lesão intra-epitelial de alto grau (NIC II e III)', false, 305, catY + 146, 7)
      drawCheckbox('Lesão intra-epitelial de alto grau, não podendo excluir micro-invasão', false, 305, catY + 158, 7)
      drawCheckbox('Carcinoma epidermóide invasor', false, 305, catY + 170, 7)

      doc.font('Helvetica-Bold').fontSize(8).text('ATIPIAS EM CÉLULAS GLANDULARES', 303, catY + 186)
      drawCheckbox('Adenocarcinoma "in situ"', false, 305, catY + 196, 7)
      doc.font('Helvetica-Bold').fontSize(7.5).text('ADENOCARCINOMA INVASOR:', 303, catY + 208)
      drawCheckbox('Cervical', false, 305, catY + 218, 7)
      drawCheckbox('Endometrial', false, 365, catY + 218, 7)
      drawCheckbox('Sem outras especificações', false, 435, catY + 218, 7)

      doc.font('Helvetica-Bold').fontSize(8).text('OUTRAS NEOPLASIAS MALIGNAS:', 303, catY + 234)
      drawCheckbox('Presença de células endometriais (na pós-menopausa ou', false, 305, catY + 246, 7)
      doc.fillColor(labelColor).fontSize(6.5).font('Helvetica').text('acima de 40 anos, fora do período menstrual)', 315, catY + 254)

      // Observações Gerais
      doc.rect(20, 692, 555, 36).stroke(gridColor)
      doc.fillColor(labelColor).font('Helvetica-Bold').fontSize(8).text('OBSERVAÇÕES GERAIS:', 23, 696)
      
      // Assinatura do Laboratório
      drawField('Screening pelo citotécnico', '', 20, 735, 270, 30)
      drawField('Responsável / Assinatura e Registro*', '', 300, 735, 275, 30)
      
      drawField('Data do Resultado*', '', 20, 770, 160, 30)

      doc.end()
    } catch (e) {
      reject(e)
    }
  })
}

export async function POST(request: NextRequest) {
  try {
    const data = await request.json()
    const pdfBuffer = await generateCitopatologicoPDF(data)
    const uint8Array = new Uint8Array(pdfBuffer)
    
    return new NextResponse(uint8Array, {
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
