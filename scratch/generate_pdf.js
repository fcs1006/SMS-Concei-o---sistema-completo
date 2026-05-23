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
  if (!cpf) return 'Não informado';
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
      return { label: 'Vermelho (Emergência)', color: '#DC2626', bg: '#FEE2E2' };
    case 2:
      return { label: 'Amarelo (Urgência)', color: '#D97706', bg: '#FEF3C7' };
    case 3:
      return { label: 'Verde (Pouco Urgente)', color: '#16A34A', bg: '#DCFCE7' };
    case 4:
      return { label: 'Azul (Não Urgente)', color: '#2563EB', bg: '#DBEAFE' };
    default:
      return { label: 'Não Classificado', color: '#4B5563', bg: '#F3F4F6' };
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
      return { label: 'Agendado - Pendente Confirmação', color: '#B45309', bg: '#FEF3C7', border: '#FBBF24' };
    }
    return { label: 'Confirmado / Agendado', color: '#065F46', bg: '#D1FAE5', border: '#34D399' };
  }
  if (status.includes('NEGADA') || status.includes('REJEITADA') || status.includes('RECUSADO')) {
    return { label: 'Negada / Recusada', color: '#991B1B', bg: '#FEE2E2', border: '#F87171' };
  }
  if (status.includes('CANCELADA') || status.includes('EXCLUIDO')) {
    return { label: 'Cancelado', color: '#7F1D1D', bg: '#FEE2E2', border: '#F87171' };
  }
  if (status.includes('PENDENTE') || status.includes('SOLICITADO') || status.includes('REGULACAO')) {
    return { label: 'Fila de Regulação (Pendente)', color: '#1E3A8A', bg: '#DBEAFE', border: '#60A5FA' };
  }
  return { label: statusStr, color: '#374151', bg: '#F3F4F6', border: '#D1D5DB' };
}

function generatePDF() {
  const dumpPath = path.resolve(__dirname, 'mastologia_dump.json');
  const outputPath = path.resolve(__dirname, 'solicitacoes_mastologia_2025_2026.pdf');
  
  if (!fs.existsSync(dumpPath)) {
    console.error(`Dump file not found at ${dumpPath}`);
    return;
  }
  
  const records = JSON.parse(fs.readFileSync(dumpPath, 'utf8'));
  
  // Sort records by data_solicitacao ascending
  records.sort((a, b) => new Date(a.data_solicitacao) - new Date(b.data_solicitacao));
  
  // Calculate statistics
  let total = records.length;
  let confirmados = 0;
  let pendentesConfirmacao = 0;
  let filaRegulacao = 0;
  let negadas = 0;
  let canceladas = 0;
  
  records.forEach(r => {
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
  
  // Page geometry helper
  const contentWidth = 515; // A4 (595) - left/right margins (80)
  
  // Design system colors
  const primaryColor = '#1E3A8A'; // Navy Blue
  const secondaryColor = '#0F766E'; // Teal
  const textDark = '#1F2937'; // Charcoal
  const textGray = '#6B7280'; // Slate Gray
  const borderLight = '#E5E7EB'; // Light Gray
  
  // Draw Header on first page (and helper to draw on all pages)
  function drawHeader(isFirstPage) {
    // Title
    doc.fillColor(primaryColor);
    doc.fontSize(12).font('Helvetica-Bold').text('ESTADO DO TOCANTINS', { align: 'center' });
    doc.fontSize(12).text('PREFEITURA MUNICIPAL DE CONCEIÇÃO DO TOCANTINS', { align: 'center' });
    doc.fontSize(10).font('Helvetica').text('SECRETARIA MUNICIPAL DE SAÚDE', { align: 'center' });
    doc.fontSize(9).fillColor(textGray).text('Departamento de Regulação, Controle e Avaliação', { align: 'center' });
    
    doc.moveDown(0.5);
    // Horizontal divider
    doc.strokeColor(primaryColor).lineWidth(1.5).moveTo(40, doc.y).lineTo(555, doc.y).stroke();
    doc.moveDown(0.8);
    
    if (isFirstPage) {
      doc.fillColor(primaryColor).fontSize(14).font('Helvetica-Bold').text('RELATÓRIO CONSOLIDADO DE SOLICITAÇÕES DO SISREG', { align: 'center' });
      doc.fontSize(11).fillColor(secondaryColor).text('Especialidade: Mastologia (Consultas Gerais e Oncológicas)', { align: 'center' });
      doc.fontSize(9).fillColor(textDark).font('Helvetica-Oblique').text('Período de Referência: 01/01/2025 a 22/05/2026', { align: 'center' });
      doc.moveDown(0.8);
    }
  }
  
  drawHeader(true);
  
  // Statistics Section (Dashboard widgets style)
  const statsY = doc.y;
  const colWidth = (contentWidth - 10) / 2; // 2 columns for layout
  
  // Background card for Stats
  doc.rect(40, statsY, contentWidth, 80)
     .fillColor('#F9FAFB')
     .strokeColor(borderLight)
     .lineWidth(1)
     .fillAndStroke();
     
  doc.fillColor(textDark);
  
  // Stats Left Column
  doc.fontSize(9).font('Helvetica-Bold').text('RESUMO EXECUTIVO DA DEMANDA', 50, statsY + 8);
  doc.fontSize(8.5).font('Helvetica').fillColor(textDark);
  doc.text(`Total de Solicitações no Período: `, 50, statsY + 24);
  doc.font('Helvetica-Bold').text(`${total}`, 200, statsY + 24);
  
  doc.font('Helvetica').text(`Solicitações Confirmadas / Agendadas: `, 50, statsY + 36);
  doc.font('Helvetica-Bold').fillColor('#065F46').text(`${confirmados}`, 200, statsY + 36);
  
  doc.font('Helvetica').fillColor(textDark).text(`Aguardando Confirmação Executante: `, 50, statsY + 48);
  doc.font('Helvetica-Bold').fillColor('#B45309').text(`${pendentesConfirmacao}`, 200, statsY + 48);
  
  // Stats Right Column
  doc.fontSize(8.5).font('Helvetica').fillColor(textDark);
  doc.text(`Em Fila de Regulação (Pendentes): `, 270, statsY + 24);
  doc.font('Helvetica-Bold').fillColor('#1E3A8A').text(`${filaRegulacao}`, 430, statsY + 24);
  
  doc.font('Helvetica').fillColor(textDark).text(`Indeferidas / Negadas pelo Regulador: `, 270, statsY + 36);
  doc.font('Helvetica-Bold').fillColor('#991B1B').text(`${negadas}`, 430, statsY + 36);
  
  doc.font('Helvetica').fillColor(textDark).text(`Canceladas / Desistências: `, 270, statsY + 48);
  doc.font('Helvetica-Bold').fillColor('#7F1D1D').text(`${canceladas}`, 430, statsY + 48);
  
  doc.moveDown(5);
  doc.x = 40; // Reset X
  
  // Patient details subtitle
  doc.fillColor(primaryColor).fontSize(11).font('Helvetica-Bold').text('DETALHAMENTO CRONOLÓGICO DAS SOLICITAÇÕES', 40);
  doc.moveDown(0.5);
  
  // Render Records
  records.forEach((record, index) => {
    const statusInfo = getStatusDetails(record.status_solicitacao);
    const riskInfo = getRiskDetails(record.codigo_classificacao_risco);
    
    // We estimate height needed for the card
    // Heights: Base box is 90pt. If there's an observation, we add more.
    let observation = '';
    if (record.laudo && record.laudo.length > 0) {
      // Find regulator justification or solicitor justification
      // Let's list all descriptions chronologically or combine them
      const laudoTexts = record.laudo.map(l => {
        const dateStr = formatDate(l.data_observacao);
        return `[${dateStr} - ${l.tipo_perfil} (${l.situacao})]: ${l.observacao || 'Sem texto'}`;
      });
      observation = laudoTexts.join(' | ');
    }
    
    // Estimate heights
    const obsHeight = observation ? Math.ceil(doc.widthOfString(observation, { font: 'Helvetica', size: 7.5, width: contentWidth - 20 }) / (contentWidth - 20)) * 10 + 15 : 0;
    const cardHeight = 85 + obsHeight;
    
    // Page Budget Check: If this card goes beyond the margin, trigger page break
    if (doc.y + cardHeight > 750) {
      doc.addPage();
      drawHeader(false);
      doc.fillColor(primaryColor).fontSize(11).font('Helvetica-Bold').text('DETALHAMENTO CRONOLÓGICO DAS SOLICITAÇÕES (Continuação)', 40);
      doc.moveDown(0.5);
    }
    
    const cardY = doc.y;
    
    // Outer border box
    doc.rect(40, cardY, contentWidth, cardHeight)
       .fillColor('#FFFFFF')
       .strokeColor(borderLight)
       .lineWidth(1)
       .fillAndStroke();
       
    // Left-side color accent line representing risk classification
    doc.rect(40, cardY, 4, cardHeight)
       .fillColor(riskInfo.color)
       .fill();
       
    // Header line inside card
    doc.fillColor(textDark);
    doc.fontSize(9.5).font('Helvetica-Bold').text(`${index + 1}. PACIENTE: ${record.no_usuario || 'Não informado'}`, 52, cardY + 8);
    
    // Status Badge background
    const badgeTextWidth = doc.widthOfString(statusInfo.label.toUpperCase(), { font: 'Helvetica-Bold', size: 7 });
    const badgeX = 555 - badgeTextWidth - 10;
    doc.rect(badgeX, cardY + 7, badgeTextWidth + 8, 12)
       .fillColor(statusInfo.bg)
       .strokeColor(statusInfo.border)
       .lineWidth(0.5)
       .fillAndStroke();
       
    // Status Badge text
    doc.fillColor(statusInfo.color).fontSize(7).font('Helvetica-Bold').text(statusInfo.label.toUpperCase(), badgeX + 4, cardY + 10);
    
    // Grid Details
    doc.fillColor(textDark);
    doc.fontSize(8).font('Helvetica-Bold').text('CPF: ', 52, cardY + 23);
    doc.font('Helvetica').text(formatCPF(record.cpf_usuario), 80, cardY + 23);
    
    doc.font('Helvetica-Bold').text('CNS: ', 200, cardY + 23);
    doc.font('Helvetica').text(formatCNS(record.cns_usuario), 230, cardY + 23);
    
    doc.font('Helvetica-Bold').text('Nasc: ', 360, cardY + 23);
    doc.font('Helvetica').text(`${formatDate(record.dt_nascimento_usuario)} (${calculateAge(record.dt_nascimento_usuario)} anos)`, 390, cardY + 23);
    
    // Second row details
    doc.font('Helvetica-Bold').text('Procedimento: ', 52, cardY + 35);
    doc.font('Helvetica').text(record.procedimento || 'Não especificado', 120, cardY + 35);
    
    doc.font('Helvetica-Bold').text('Classif. Risco: ', 52, cardY + 47);
    doc.font('Helvetica').fillColor(riskInfo.color).text(riskInfo.label, 125, cardY + 47);
    
    doc.fillColor(textDark);
    doc.font('Helvetica-Bold').text('Data Solicitação: ', 260, cardY + 47);
    doc.font('Helvetica').text(formatDate(record.data_solicitacao), 340, cardY + 47);
    
    doc.font('Helvetica-Bold').text('Cód. Solicitação: ', 420, cardY + 47);
    doc.font('Helvetica').text(record.codigo_solicitacao || '—', 500, cardY + 47);
    
    // Third row: Unidade Solicitante / Executante
    doc.font('Helvetica-Bold').text('Unidade Solicitante: ', 52, cardY + 59);
    doc.font('Helvetica').text(record.nome_unidade_solicitante || 'SMS CONCEIÇÃO DO TOCANTINS', 145, cardY + 59);
    
    // Divider line before clinical observations
    if (observation) {
      doc.strokeColor(borderLight).lineWidth(0.5).moveTo(52, cardY + 73).lineTo(545, cardY + 73).stroke();
      
      // Clinical Observation
      doc.fillColor(textGray).fontSize(7.5).font('Helvetica-Bold').text('HISTÓRICO E JUSTIFICATIVA DO LAUDO:', 52, cardY + 77);
      doc.font('Helvetica').text(observation, 52, cardY + 87, { width: contentWidth - 24, align: 'justify' });
    }
    
    doc.y = cardY + cardHeight + 10; // set Y for next card
  });
  
  // Signature section (budgeted page checks)
  const sigHeight = 100;
  if (doc.y + sigHeight > 750) {
    doc.addPage();
    drawHeader(false);
  }
  
  doc.moveDown(2);
  const signatureY = doc.y;
  
  // Signature line
  doc.strokeColor(textDark).lineWidth(0.8).moveTo(140, signatureY + 40).lineTo(415, signatureY + 40).stroke();
  doc.fillColor(textDark).fontSize(9.5).font('Helvetica-Bold').text('Coordenação de Regulação e Controle do SISREG', 40, signatureY + 45, { align: 'center' });
  doc.fontSize(8.5).font('Helvetica').text('Secretaria Municipal de Saúde', { align: 'center' });
  doc.fontSize(7.5).fillColor(textGray).text(`Conceição do Tocantins - TO, em ${formatDate(new Date())}`, { align: 'center' });
  
  // Global Footer and Page Numbers
  const pages = doc.bufferedPageRange();
  for (let i = 0; i < pages.count; i++) {
    doc.switchToPage(i);
    // Header metadata on page 2+
    if (i > 0) {
      doc.fillColor(textGray).fontSize(7.5).font('Helvetica-Oblique').text('Relatório de Solicitações do SISREG - Mastologia | Ref: 01/01/2025 a 22/05/2026', 40, 20);
      doc.strokeColor(borderLight).lineWidth(0.5).moveTo(40, 30).lineTo(555, 30).stroke();
    }
    
    // Page footer on all pages
    doc.strokeColor(borderLight).lineWidth(0.5).moveTo(40, 800).lineTo(555, 800).stroke();
    doc.fillColor(textGray).fontSize(7.5).font('Helvetica');
    doc.text(`Documento emitido eletronicamente em ${formatDate(new Date())} - Secretaria Municipal de Saúde de Conceição do Tocantins`, 40, 807);
    doc.text(`Página ${i + 1} de ${pages.count}`, 520, 807);
  }
  
  doc.end();
  
  stream.on('finish', () => {
    console.log(`PDF successfully generated at: ${outputPath}`);
  });
}

generatePDF();
