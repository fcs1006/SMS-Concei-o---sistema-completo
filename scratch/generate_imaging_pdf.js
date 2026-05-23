const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');

// Helper to calculate age as of 22/05/2026
function calculateAge(birthDateStr) {
  if (!birthDateStr) return 'N/A';
  const birth = new Date(birthDateStr);
  const refDate = new Date('2026-05-22');
  let age = refDate.getFullYear() - birth.getFullYear();
  const m = refDate.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && refDate.getDate() < birth.getDate())) {
    age--;
  }
  return age;
}

// Helper to format dates
function formatDate(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

// Helper to format CPF
function formatCPF(cpf) {
  if (!cpf) return 'N/I';
  const clean = cpf.replace(/\D/g, '');
  if (clean.length !== 11) return cpf;
  return `${clean.substring(0, 3)}.${clean.substring(3, 6)}.${clean.substring(6, 9)}-${clean.substring(9)}`;
}

// Helper to format CNS
function formatCNS(cns) {
  if (!cns) return 'Não informado';
  const clean = cns.replace(/\D/g, '');
  if (clean.length !== 15) return cns;
  return `${clean.substring(0, 3)} ${clean.substring(3, 7)} ${clean.substring(7, 11)} ${clean.substring(11)}`;
}

// Map risk classification
function getRiskDetails(riskCode) {
  const code = parseInt(riskCode);
  switch (code) {
    case 1:
      return { label: 'Vermelho', color: '#DC2626', bg: '#FEE2E2' };
    case 2:
      return { label: 'Amarelo', color: '#D97706', bg: '#FEF3C7' };
    case 3:
      return { label: 'Verde', color: '#16A34A', bg: '#DCFCE7' };
    case 4:
      return { label: 'Azul', color: '#2563EB', bg: '#DBEAFE' };
    default:
      return { label: 'Não Classif.', color: '#4B5563', bg: '#F3F4F6' };
  }
}

// Map status for styling
function getStatusDetails(statusStr) {
  const status = (statusStr || '').toUpperCase();
  if (status.includes('CONFIRMADO') || status.includes('MARCADO') || status.includes('AGENDADO')) {
    if (status.includes('CANCELADO')) {
      return { label: 'Cancelado', color: '#7F1D1D', bg: '#FEE2E2', border: '#F87171' };
    }
    if (status.includes('PENDENTE')) {
      return { label: 'Agendado - Pendente', color: '#B45309', bg: '#FEF3C7', border: '#FBBF24' };
    }
    return { label: 'Confirmado', color: '#065F46', bg: '#D1FAE5', border: '#34D399' };
  }
  if (status.includes('NEGADA') || status.includes('REJEITADA') || status.includes('RECUSADO')) {
    return { label: 'Negada', color: '#991B1B', bg: '#FEE2E2', border: '#F87171' };
  }
  if (status.includes('CANCELADA') || status.includes('EXCLUIDO')) {
    return { label: 'Cancelado', color: '#7F1D1D', bg: '#FEE2E2', border: '#F87171' };
  }
  if (status.includes('PENDENTE') || status.includes('SOLICITADO') || status.includes('REGULACAO')) {
    return { label: 'Fila Regulação', color: '#1E3A8A', bg: '#DBEAFE', border: '#60A5FA' };
  }
  return { label: statusStr.length > 20 ? statusStr.substring(0, 17) + '...' : statusStr, color: '#374151', bg: '#F3F4F6', border: '#D1D5DB' };
}

function generatePDF() {
  const dumpPath = path.resolve(__dirname, 'imaging_dump.json');
  const outputPath = path.resolve(__dirname, 'exames_mama_2025_2026.pdf');
  
  if (!fs.existsSync(dumpPath)) {
    console.error(`Dump file not found at ${dumpPath}`);
    return;
  }
  
  const rawRecords = JSON.parse(fs.readFileSync(dumpPath, 'utf8'));
  
  // Filter out plastic surgery
  const records = rawRecords.filter(r => {
    const proc = (r.procedimentos?.[0]?.descricao_interna || r.procedimentos?.[0]?.descricao_sigtap || '').toUpperCase();
    return !proc.includes('CIRURGIA PLASTICA') && !proc.includes('REDUCAO DE MAMA');
  });
  
  // Sort records by data_solicitacao ascending
  records.sort((a, b) => new Date(a.data_solicitacao) - new Date(b.data_solicitacao));
  
  // Calculate statistics
  let total = records.length;
  let mamografias = 0;
  let ultrassons = 0;
  let ociMama = 0;
  
  let confirmados = 0;
  let pendentesConfirmacao = 0;
  let filaRegulacao = 0;
  let negadas = 0;
  let canceladas = 0;
  
  records.forEach(r => {
    const proc = (r.procedimentos?.[0]?.descricao_interna || r.procedimentos?.[0]?.descricao_sigtap || '').toUpperCase();
    if (proc.includes('MAMOGRAFIA')) {
      mamografias++;
    } else if (proc.includes('ULTRA-SONOGRAFIA') || proc.includes('ULTRASSONOGRAFIA')) {
      ultrassons++;
    } else if (proc.includes('OCI ')) {
      ociMama++;
    }
    
    const status = (r.status_solicitacao || '').toUpperCase();
    if (status.includes('CONFIRMADO')) {
      if (status.includes('CANCELADO')) canceladas++;
      else confirmados++;
    } else if (status.includes('PENDENTE CONFIRMAÇÃO') || status.includes('PENDENTE CONFIRMACAO')) {
      pendentesConfirmacao++;
    } else if (status.includes('NEGADA') || status.includes('REJEITADA') || status.includes('RECUSADO')) {
      negadas++;
    } else if (status.includes('CANCELADA') || status.includes('EXCLUIDO') || status.includes('CANCELADO')) {
      canceladas++;
    } else if (status.includes('PENDENTE') || status.includes('SOLICITADO') || status.includes('REGULACAO')) {
      filaRegulacao++;
    }
  });

  const doc = new PDFDocument({
    size: 'A4',
    margins: { top: 40, bottom: 40, left: 40, right: 40 },
    bufferPages: true
  });
  
  const stream = fs.createWriteStream(outputPath);
  doc.pipe(stream);
  
  const contentWidth = 515; // A4 (595) - left/right margins (80)
  
  // Design system colors
  const primaryColor = '#1E3A8A'; // Navy Blue
  const secondaryColor = '#0F766E'; // Teal
  const textDark = '#1F2937'; // Charcoal
  const textGray = '#6B7280'; // Slate Gray
  const borderLight = '#E5E7EB'; // Light Gray
  
  // Draw Header on first page (and helper to draw on all pages)
  function drawHeader(isFirstPage) {
    doc.fillColor(primaryColor);
    doc.fontSize(11).font('Helvetica-Bold').text('ESTADO DO TOCANTINS', { align: 'center' });
    doc.fontSize(11).text('PREFEITURA MUNICIPAL DE CONCEIÇÃO DO TOCANTINS', { align: 'center' });
    doc.fontSize(9).font('Helvetica').text('SECRETARIA MUNICIPAL DE SAÚDE', { align: 'center' });
    doc.fontSize(8).fillColor(textGray).text('Departamento de Regulação, Controle e Avaliação', { align: 'center' });
    
    doc.moveDown(0.4);
    doc.strokeColor(primaryColor).lineWidth(1.2).moveTo(40, doc.y).lineTo(555, doc.y).stroke();
    doc.moveDown(0.6);
    
    if (isFirstPage) {
      doc.fillColor(primaryColor).fontSize(13).font('Helvetica-Bold').text('RELATÓRIO CONSOLIDADO DE IMAGEM DA MAMA (SISREG)', { align: 'center' });
      doc.fontSize(10).fillColor(secondaryColor).text('Procedimentos: Mamografias, Ultrassonografias de Mama e Protocolos OCI', { align: 'center' });
      doc.fontSize(8.5).fillColor(textDark).font('Helvetica-Oblique').text('Período de Referência: 01/01/2025 a 22/05/2026', { align: 'center' });
      doc.moveDown(0.6);
    }
  }
  
  drawHeader(true);
  
  // Summary Stats card
  const statsY = doc.y;
  
  doc.rect(40, statsY, contentWidth, 80)
     .fillColor('#F9FAFB')
     .strokeColor(borderLight)
     .lineWidth(1)
     .fillAndStroke();
     
  doc.fillColor(textDark);
  
  // Left side: stats by procedure type
  doc.fontSize(8.5).font('Helvetica-Bold').text('DISTRIBUIÇÃO DOS PROCEDIMENTOS', 50, statsY + 8);
  doc.fontSize(8).font('Helvetica').fillColor(textDark);
  doc.text(`Mamografias Bilaterais (Rastreamento): `, 50, statsY + 22);
  doc.font('Helvetica-Bold').text(`${mamografias}`, 215, statsY + 22);
  
  doc.font('Helvetica').text(`Ultrassonografias Mamárias (Bilateral/PPI): `, 50, statsY + 34);
  doc.font('Helvetica-Bold').text(`${ultrassons}`, 215, statsY + 34);
  
  doc.font('Helvetica').text(`Protocolos OCI (Avaliação Diagnóstica): `, 50, statsY + 46);
  doc.font('Helvetica-Bold').text(`${ociMama}`, 215, statsY + 46);

  doc.font('Helvetica').text(`Total de Exames/Protocolos Regulados: `, 50, statsY + 58);
  doc.font('Helvetica-Bold').fillColor(primaryColor).text(`${total}`, 215, statsY + 58);
  
  // Right side: stats by status
  doc.fillColor(textDark);
  doc.fontSize(8.5).font('Helvetica-Bold').text('SITUAÇÃO DO FLUXO REGULATÓRIO', 280, statsY + 8);
  doc.fontSize(8).font('Helvetica').fillColor(textDark);
  doc.text(`Exames Confirmados: `, 280, statsY + 22);
  doc.font('Helvetica-Bold').fillColor('#065F46').text(`${confirmados}`, 430, statsY + 22);
  
  doc.font('Helvetica').fillColor(textDark).text(`Aguardando Confirmação Executante: `, 280, statsY + 34);
  doc.font('Helvetica-Bold').fillColor('#B45309').text(`${pendentesConfirmacao}`, 430, statsY + 34);
  
  doc.font('Helvetica').fillColor(textDark).text(`Fila de Regulação (Pendente): `, 280, statsY + 46);
  doc.font('Helvetica-Bold').fillColor('#1E3A8A').text(`${filaRegulacao}`, 430, statsY + 46);
  
  doc.font('Helvetica').fillColor(textDark).text(`Negadas / Canceladas: `, 280, statsY + 58);
  doc.font('Helvetica-Bold').fillColor('#991B1B').text(`${negadas + canceladas} (${negadas} Neg / ${canceladas} Can)`, 430, statsY + 58);
  
  doc.moveDown(5);
  doc.x = 40; // Reset X
  
  doc.fillColor(primaryColor).fontSize(10).font('Helvetica-Bold').text('LISTAGEM DETALHADA DOS PROCEDIMENTOS', 40);
  doc.moveDown(0.3);
  
  // Define Table Column X positions and Widths
  const colX = {
    num: 40,
    date: 62,
    patient: 110,
    proc: 260,
    risk: 410,
    status: 475
  };
  
  // Table Header
  const headerY = doc.y;
  doc.rect(40, headerY, contentWidth, 18)
     .fillColor(primaryColor)
     .fill();
     
  doc.fillColor('#FFFFFF').fontSize(7.5).font('Helvetica-Bold');
  doc.text('DATA SOL.', colX.date, headerY + 5);
  doc.text('PACIENTE / CPF / CNS', colX.patient, headerY + 5);
  doc.text('PROCEDIMENTO SISREG', colX.proc, headerY + 5);
  doc.text('RISCO', colX.risk, headerY + 5);
  doc.text('SITUAÇÃO', colX.status, headerY + 5);
  
  doc.y = headerY + 18;
  
  // Iterate through records and draw rows
  records.forEach((record, index) => {
    const rowHeight = 32;
    let obsText = '';
    if (record.laudo && record.laudo.length > 0) {
      // Get observations from laudos
      const obsList = record.laudo
        .filter(l => l.observacao && l.observacao.trim() !== '')
        .map(l => `[${l.tipo_perfil}]: ${l.observacao.replace(/\r?\n/g, ' ')}`);
      obsText = obsList.join(' | ');
    }
    
    // Calculate if we need an observation sub-row
    let obsHeight = 0;
    if (obsText) {
      obsHeight = Math.ceil(doc.widthOfString(obsText, { font: 'Helvetica-Oblique', size: 6.5, width: contentWidth - 40 }) / (contentWidth - 40)) * 8 + 6;
    }
    
    const totalRowHeight = rowHeight + obsHeight;
    
    // Page Break handling
    if (doc.y + totalRowHeight > 760) {
      doc.addPage();
      drawHeader(false);
      
      // Draw Table Header on new page
      const currentY = doc.y;
      doc.rect(40, currentY, contentWidth, 18)
         .fillColor(primaryColor)
         .fill();
         
      doc.fillColor('#FFFFFF').fontSize(7.5).font('Helvetica-Bold');
      doc.text('DATA SOL.', colX.date, currentY + 5);
      doc.text('PACIENTE / CPF / CNS', colX.patient, currentY + 5);
      doc.text('PROCEDIMENTO SISREG', colX.proc, currentY + 5);
      doc.text('RISCO', colX.risk, currentY + 5);
      doc.text('SITUAÇÃO', colX.status, currentY + 5);
      
      doc.y = currentY + 18;
    }
    
    const currentY = doc.y;
    
    // Row background (alternating colors for zebra effect)
    const isEven = index % 2 === 0;
    doc.rect(40, currentY, contentWidth, totalRowHeight)
       .fillColor(isEven ? '#FFFFFF' : '#F9FAFB')
       .strokeColor('#F3F4F6')
       .lineWidth(0.5)
       .fillAndStroke();
       
    // Index number
    doc.fillColor(textGray).fontSize(7).font('Helvetica');
    doc.text(`${index + 1}`, colX.num + 4, currentY + 7);
    
    // Request Date
    doc.fillColor(textDark).fontSize(7.5);
    doc.text(formatDate(record.data_solicitacao), colX.date, currentY + 7);
    
    // Patient details
    const pName = (record.no_usuario || 'Não informado').toUpperCase();
    const pAge = record.dt_nascimento_usuario ? `${calculateAge(record.dt_nascimento_usuario)} anos` : 'N/A';
    doc.font('Helvetica-Bold').fontSize(7.5).text(pName.substring(0, 36), colX.patient, currentY + 5);
    doc.font('Helvetica').fontSize(6.5).fillColor(textGray);
    doc.text(`CPF: ${formatCPF(record.cpf_usuario)} | CNS: ${formatCNS(record.cns_usuario)} | Nasc: ${formatDate(record.dt_nascimento_usuario)} (${pAge})`, colX.patient, currentY + 15);
    
    // Procedure
    const procName = (record.procedimento || 'Não informado').toUpperCase();
    doc.fillColor(textDark).font('Helvetica').fontSize(7.5);
    doc.text(procName.substring(0, 36), colX.proc, currentY + 5);
    doc.font('Helvetica-Oblique').fontSize(6.5).fillColor(textGray);
    doc.text(`Solicitante: ${(record.nome_unidade_solicitante || 'SMS CONCEIÇÃO').substring(0, 36)}`, colX.proc, currentY + 15);
    
    // Risk status
    const riskInfo = getRiskDetails(record.codigo_classificacao_risco);
    // Draw small colored dot for risk
    doc.circle(colX.risk + 6, currentY + 11, 3.5)
       .fillColor(riskInfo.color)
       .fill();
    doc.fillColor(riskInfo.color).font('Helvetica-Bold').fontSize(7).text(riskInfo.label, colX.risk + 14, currentY + 8);
    
    // Situation badge
    const statusInfo = getStatusDetails(record.status_solicitacao);
    doc.rect(colX.status, currentY + 6, colX.status + 35 > 555 ? 555 - colX.status : 38, 10)
       .fillColor(statusInfo.bg)
       .strokeColor(statusInfo.border)
       .lineWidth(0.3)
       .fillAndStroke();
    doc.fillColor(statusInfo.color).font('Helvetica-Bold').fontSize(6.5).text(statusInfo.label, colX.status + 2, currentY + 8);
    
    // Observation sub-row
    if (obsText) {
      doc.strokeColor('#E5E7EB').lineWidth(0.2).moveTo(50, currentY + rowHeight).lineTo(545, currentY + rowHeight).stroke();
      doc.fillColor(textGray).font('Helvetica-Oblique').fontSize(6.5);
      doc.text(obsText, 50, currentY + rowHeight + 3, { width: contentWidth - 20, align: 'justify' });
    }
    
    doc.y = currentY + totalRowHeight;
  });
  
  // Footer and Signatures
  const sigHeight = 100;
  if (doc.y + sigHeight > 760) {
    doc.addPage();
    drawHeader(false);
  }
  
  doc.moveDown(1.5);
  const signatureY = doc.y;
  
  // Signature layout
  doc.strokeColor(textDark).lineWidth(0.8).moveTo(140, signatureY + 30).lineTo(415, signatureY + 30).stroke();
  doc.fillColor(textDark).fontSize(9).font('Helvetica-Bold').text('Coordenação de Regulação e Controle do SISREG', 40, signatureY + 35, { align: 'center' });
  doc.fontSize(8).font('Helvetica').text('Secretaria Municipal de Saúde', { align: 'center' });
  doc.fontSize(7).fillColor(textGray).text(`Conceição do Tocantins - TO, em ${formatDate(new Date())}`, { align: 'center' });
  
  // Page number footer
  const pages = doc.bufferedPageRange();
  for (let i = 0; i < pages.count; i++) {
    doc.switchToPage(i);
    if (i > 0) {
      doc.fillColor(textGray).fontSize(7).font('Helvetica-Oblique').text('Relatório de Exames de Imagem da Mama (SISREG) | Ref: 01/01/2025 a 22/05/2026', 40, 20);
      doc.strokeColor(borderLight).lineWidth(0.5).moveTo(40, 28).lineTo(555, 28).stroke();
    }
    
    doc.strokeColor(borderLight).lineWidth(0.5).moveTo(40, 800).lineTo(555, 800).stroke();
    doc.fillColor(textGray).fontSize(7).font('Helvetica');
    doc.text(`Documento emitido eletronicamente em ${formatDate(new Date())} - Secretaria Municipal de Saúde de Conceição do Tocantins`, 40, 807);
    doc.text(`Página ${i + 1} de ${pages.count}`, 520, 807);
  }
  
  doc.end();
  
  stream.on('finish', () => {
    console.log(`PDF successfully generated at: ${outputPath}`);
  });
}

generatePDF();
