'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Layout from '@/components/Layout'
import { clientConfig } from '@/lib/config'
import { Printer, Calendar, Settings, Pencil, Save, RefreshCw, BarChart2, CalendarDays, Trash2, Stethoscope, FlaskConical, UserCog, Check, X, Clock } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

const ESPECIALIDADES = [
  { id: 'ortopedia', label: 'Ortopedia', icon: '🦴', cota: 30 },
  { id: 'ginecologia', label: 'Ginecologia', icon: '🩺', cota: 30 },
  { id: 'oftalmologia', label: 'Oftalmologia', icon: '👁️', cota: 30 },
  { id: 'urologia', label: 'Urologia', icon: '🔬', cota: 30 },
  { id: 'usg', label: 'USG', icon: '🖥️', cota: 60 },
  { id: 'psiquiatria', label: 'Psiquiatria', icon: '🧠', cota: 30 },
]

const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']

const COR = '#d97706'
const COR_DARK = '#b45309'
const GRAD = 'linear-gradient(135deg, #d97706, #fbbf24)'

const STATUS_STYLE = {
  pendente: { bg: '#fef9c3', cor: '#854d0e', borda: '#fde047' },
  autorizado: { bg: '#dcfce7', cor: '#166534', borda: '#86efac' },
  negado: { bg: '#fee2e2', cor: '#991b1b', borda: '#fca5a5' },
  excluido: { bg: '#f1f5f9', cor: '#475569', borda: '#cbd5e1' },
}
const STATUS_LABEL = { pendente: 'Pendente', autorizado: 'Autorizado', negado: 'Negado', excluido: 'Excluído' }

const CONSELHOS = ['CRM', 'CRO', 'CREFITO', 'CRM-RJ', 'CRM-GO', 'CRM-DF', 'Outro']

// Ordem original de atendimento (usada na impressão e na lista)
const TIPOS_USG_ORDEM = [
  'ABDOMEN TOTAL',
  'ABDOMEN SUPERIOR',
  'VIAS URINÁRIAS',
  'PÉLVICA',
  'PRÓSTATA TRANSRETAL',
  'PRÓSTATA ABDOMINAL',
  'OBSTÉTRICA',
  'MAMAS',
  'TIREOIDE',
  'BOLSA ESCROTAL',
  'PARTES MOLES',
  'PAREDE ABDOMINAL',
  'REGIÃO INGUINAL',
  'CERVICAL',
  'TRANSVAGINAL',
  'ARTICULAÇÃO',
]
// Ordem alfabética para o select
const TIPOS_USG = [...TIPOS_USG_ORDEM].sort((a, b) => a.localeCompare(b, 'pt-BR'))

const PREPARO_USG = {
  'ABDOMEN TOTAL': 'JEJUM DE 8 HORAS. 40 GOTAS DIMETICONA ANTES DE DORMIR NO DIA ANTERIOR.',
  'ABDOMEN SUPERIOR': 'JEJUM DE 8 HORAS. 40 GOTAS DIMETICONA ANTES DE DORMIR NO DIA ANTERIOR.',
  'VIAS URINÁRIAS': 'BEXIGA CHEIA (BEBER 1 LITRO DE ÁGUA 1 HORA ANTES E NÃO URINAR).',
  'PÉLVICA': 'BEXIGA CHEIA (BEBER 1 LITRO DE ÁGUA 1 HORA ANTES E NÃO URINAR).',
  'PRÓSTATA ABDOMINAL': 'JEJUM DE 8 HORAS. 40 GOTAS DIMETICONA ANTES DE DORMIR NO DIA ANTERIOR. BEXIGA CHEIA.',
  'PRÓSTATA TRANSRETAL': 'JEJUM DE 8 HORAS. 40 GOTAS DIMETICONA ANTES DE DORMIR NO DIA ANTERIOR. BEXIGA CHEIA.',
}
const TIPOS_CONSULTA = ['1º vez', 'Retorno', 'Outro']

// Escala de Manchester adaptada para prioridade de agendamento
const MANCHESTER = [
  { valor: '1', label: 'Vermelho',  desc: 'Emergência',    bg: '#fee2e2', cor: '#991b1b', borda: '#fca5a5' },
  { valor: '2', label: 'Laranja',   desc: 'Muito Urgente', bg: '#fff7ed', cor: '#92400e', borda: '#fb923c' },
  { valor: '3', label: 'Amarelo',   desc: 'Urgente',       bg: '#fefce8', cor: '#854d0e', borda: '#fde047' },
  { valor: '4', label: 'Verde',     desc: 'Pouco Urgente', bg: '#f0fdf4', cor: '#166534', borda: '#86efac' },
  { valor: '5', label: 'Azul',      desc: 'Não Urgente',   bg: '#eff6ff', cor: '#1e40af', borda: '#93c5fd' },
]

// Exames que exigem jejum de 8h — não podem ser agendados no período da tarde
const EXAMES_JEJUM = ['ABDOMEN TOTAL', 'ABDOMEN SUPERIOR', 'PRÓSTATA TRANSRETAL', 'PRÓSTATA ABDOMINAL']

// ── Helpers ──────────────────────────────────────────────────────────────────
function fmtTelefone(v) {
  const d = v.replace(/\D/g, '').slice(0, 11)
  if (d.length <= 2) return d.length ? `(${d}` : ''
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
}

function fmtData(v) {
  if (!v) return '—'
  const [a, m, d] = String(v).split('-')
  return `${d}/${m}/${a}`
}

function abbreviateStatus(status) {
  if (!status) return '—'
  const s = status.toUpperCase().trim()
  if (s.includes('PENDENTE') && s.includes('REGULADOR')) return 'SOL/PEN/REG'
  if (s.includes('PENDENTE CONFIRMAÇÃO')) return 'AGEN/PEND_CONF'
  if (s.includes('AUTORIZADA') && s.includes('REGULADOR')) return 'SOL/AUT/REG'
  if (s.includes('AGENDADA') && s.includes('SOLICITANTE')) return 'SOL/AGEN/SOL'
  if (s.includes('CANCELADO') && s.includes('SOLICITANTE')) return 'AGEN/CANC/SOL'
  if (s.includes('CANCELADO') && s.includes('REGULADOR')) return 'AGEN/CANC/REG'
  if (s.includes('CANCELADO') && s.includes('COORDENADOR')) return 'AGEN/CANC/COORD'
  if (s.includes('CANCELADA') && s.includes('SOLICITANTE')) return 'SOL/CANC/SOL'
  if (s.includes('CANCELADA') && s.includes('COORDENADOR')) return 'SOL/CANC/COORD'
  if (s.includes('CONFIRMADO') && s.includes('EXECUTANTE')) return 'AGEN/CONF/EXEC'
  if (s.includes('FALTA') && s.includes('EXECUTANTE')) return 'AGEN/FALTA/EXEC'
  if (s.includes('NEGADA') && s.includes('REGULADOR')) return 'SOL/NEG/REG'
  return s
}

function imprimirRelatorioSisreg(dados, periodoLabel, espLabel = '', statusLabel = '') {
  const hoje = new Date()
  const dataEmissao = hoje.toLocaleDateString('pt-BR')
  const horaEmissao = hoje.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8"/>
  <title>Relatório SISREG</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: Arial, sans-serif; font-size: 11px; color: #000; padding: 20px; }
    .header { margin-bottom: 20px; border-bottom: 2px solid #1a7a3c; padding-bottom: 10px; }
    .header h1 { font-size: 16px; font-weight: bold; color: #1a7a3c; text-transform: uppercase; margin-bottom: 4px; }
    .header p { font-size: 11px; color: #555; }
    .meta { display: flex; justify-content: space-between; margin-bottom: 15px; font-size: 10px; color: #666; }
    table { width: 100%; border-collapse: collapse; margin-top: 10px; }
    th { background-color: #1a7a3c; color: #fff; text-align: left; padding: 8px 6px; font-weight: bold; border: 1px solid #1a7a3c; font-size: 10px; text-transform: uppercase; }
    td { padding: 7px 6px; border-bottom: 1px solid #ddd; font-size: 10.5px; word-break: break-word; }
    tr:nth-child(even) { background-color: #f9f9f9; }
    @media print {
      body { padding: 0; }
      th { -webkit-print-color-adjust: exact; printColorAdjust: exact; }
      tr:nth-child(even) { -webkit-print-color-adjust: exact; printColorAdjust: exact; }
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>Secretaria Municipal de Saúde — Conceição do Tocantins/TO</h1>
    <p><strong>Relatório de Monitoramento do SISREG</strong> — Central de Regulação</p>
  </div>
  
  <div class="meta">
    <div>
      <strong>Período:</strong> ${periodoLabel}
      ${espLabel ? ` | <strong>Filtro Procedimento:</strong> ${espLabel}` : ''}
      ${statusLabel ? ` | <strong>Situação:</strong> ${statusLabel}` : ''}
    </div>
    <div>
      <strong>Gerado em:</strong> ${dataEmissao} às ${horaEmissao}
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th style="width: 4%">Nº</th>
        <th style="width: 14%">Cód. Solicitação</th>
        <th style="width: 12%">Data Solic.</th>
        <th style="width: 21%">Paciente</th>
        <th style="width: 14%">CPF/CNS</th>
        <th style="width: 23%">Procedimento</th>
        <th style="width: 12%">Situação</th>
      </tr>
    </thead>
    <tbody>
      ${dados.map((r, i) => {
        const dataFmt = r.data_solicitacao ? r.data_solicitacao.slice(0, 10).split('-').reverse().join('/') : '—'
        const cnsCpf = r.cpf_usuario || r.cns_usuario || '—'
        const situacaoAbreviada = abbreviateStatus(r.status_solicitacao)
        
        return `<tr>
          <td>${i + 1}</td>
          <td style="font-weight: bold;">${r.codigo_solicitacao || '—'}</td>
          <td>${dataFmt}</td>
          <td style="text-transform: uppercase; font-weight: 600;">${r.no_usuario || '—'}</td>
          <td>${cnsCpf}</td>
          <td style="text-transform: uppercase;">${r.descricao_interna_procedimento || '—'}</td>
          <td style="font-weight: bold; color: #1a7a3c;">${situacaoAbreviada}</td>
        </tr>`
      }).join('')}
    </tbody>
  </table>
</body>
</html>`

  const win = window.open('', '_blank')
  if (win) {
    win.document.write(html)
    win.document.close()
    setTimeout(() => {
      win.print()
    }, 250)
  }
}

// ── Comprovante de Autorização ────────────────────────────────────────────────
function imprimirComprovante(ag, espLabel, municipio = `${clientConfig.municipalityName}/${clientConfig.municipalityUF}`, preparos = PREPARO_USG, dtNasc = null) {
  const hoje = new Date()
  const dataEmissao = hoje.toLocaleDateString('pt-BR')
  const horaEmissao = hoje.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  const cleanTipoExame = ag.tipo_exame ? String(ag.tipo_exame).trim().toUpperCase() : ''
  const cleanEspecialidade = ag.especialidade ? String(ag.especialidade).trim().toUpperCase() : ''
  const cleanEspLabel = espLabel ? String(espLabel).trim().toUpperCase() : ''

  const isExame = (ag.tipo_exame && !['1º VEZ', 'RETORNO', 'OUTRO'].includes(cleanTipoExame)) || 
                  cleanEspecialidade === 'PSA' || 
                  cleanEspLabel === 'PSA'

  const tipoDoc = isExame ? 'EXAME' : 'CONSULTA'
  const numComp = String(ag.id).slice(-8).toUpperCase()

  let preparo = null
  if (preparos) {
    if (cleanTipoExame && preparos[cleanTipoExame] && !['1º VEZ', 'RETORNO', 'OUTRO'].includes(cleanTipoExame)) {
      preparo = preparos[cleanTipoExame]
    } else if (cleanTipoExame) {
      const sortedKeys = Object.keys(preparos).sort((a, b) => b.length - a.length)
      const matchKey = sortedKeys.find(key => {
        if (['1º VEZ', 'RETORNO', 'OUTRO'].includes(key)) return false
        if (key.length < 3) return false
        return cleanTipoExame.includes(key) || key.includes(cleanTipoExame)
      })
      if (matchKey) {
        preparo = preparos[matchKey]
      }
    }
    
    if (!preparo) {
      if (cleanEspecialidade && preparos[cleanEspecialidade]) {
        preparo = preparos[cleanEspecialidade]
      } else if (cleanEspLabel && preparos[cleanEspLabel]) {
        preparo = preparos[cleanEspLabel]
      }
    }
  }

  // Usa data_atendimento salva no agendamento (data real do médico na escala)
  const dataAtendimento = ag.data_atendimento || ag.data_consulta

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8"/>
  <title>Comprovante de Autorização</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: Arial, sans-serif; font-size: 12px; color: #000; background: #fff; padding: 28px 32px; }
    .borda { border: 2px solid #000; border-radius: 4px; padding: 20px 24px; }
    .cabecalho { margin-bottom: 14px; }
    .cab-topo { display: flex; align-items: center; gap: 16px; padding-bottom: 10px; }
    .cab-logo { width: 60px; height: 60px; object-fit: contain; flex-shrink: 0; }
    .cab-texto p { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; line-height: 1.6; }
    .cab-linha { border: none; border-top: 2px solid #1a7a3c; margin: 0 0 12px; }
    .cab-titulo { text-align: center; }
    .cab-titulo h2 { font-size: 15px; font-weight: 800; text-transform: uppercase; margin-bottom: 4px; letter-spacing: 0.03em; }
    .num { font-size: 10px; color: #555; text-align: center; }
    .secao { margin-bottom: 14px; }
    .secao-titulo { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: #555; border-bottom: 1px solid #ccc; padding-bottom: 3px; margin-bottom: 8px; }
    .linha-campos { display: flex; gap: 24px; flex-wrap: nowrap; }
    .linha-campos .campo { flex: 1; min-width: 0; }
    .grid3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 6px 20px; }
    .campo label { font-size: 10px; font-weight: 700; text-transform: uppercase; color: #555; display: block; margin-bottom: 2px; }
    .campo span  { font-size: 13px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; display: block; }
    .destaque { background: #f0f0f0; border-radius: 4px; padding: 10px 14px; text-align: center; margin: 12px 0; }
    .destaque span { font-size: 18px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.03em; }
    .destaque small { font-size: 11px; display: block; color: #444; margin-top: 2px; }
    .aviso { background: #fffbea; border: 1px solid #e5c000; border-radius: 4px; padding: 8px 12px; font-size: 11px; color: #7a5900; margin-top: 12px; }
    @media print { body { padding: 10px; } }
  </style>
</head>
<body>
  <div class="borda">
    <div class="cabecalho">
      <div class="cab-topo">
        <img class="cab-logo" src="/logo.jpg" alt="Logo" />
        <div class="cab-texto">
          <p>Prefeitura Municipal de ${clientConfig.municipalityName}</p>
          <p>Fundo Municipal de Saúde</p>
          <p>Secretaria Municipal de Saúde</p>
        </div>
      </div>
      <hr class="cab-linha" />
      <div class="cab-titulo">
        <h2>Comprovante de Autorização de ${tipoDoc}</h2>
        <div class="num">Nº ${numComp} &nbsp;|&nbsp; Emitido em: ${dataEmissao} às ${horaEmissao}</div>
      </div>
    </div>

    <div class="secao">
      <div class="secao-titulo">Dados do Paciente</div>
      <div class="linha-campos">
        <div class="campo"><label>Nome completo</label><span style="white-space:normal;overflow:visible;text-overflow:clip;">${ag.paciente_nome || '—'}</span></div>
        <div class="campo" style="max-width:160px"><label>CPF / CNS</label><span>${ag.paciente_cns || '—'}</span></div>
        <div class="campo" style="max-width:130px"><label>Data de Nascimento</label><span>${dtNasc ? dtNasc.split('-').reverse().join('/') : '—'}</span></div>
        <div class="campo" style="max-width:130px"><label>Telefone</label><span>${ag.telefone || '—'}</span></div>
      </div>
    </div>

    <div class="destaque">
      <span>${espLabel.toUpperCase()} — ${ag.tipo_exame || '—'}</span>
      <small>${tipoDoc} autorizado pela Secretaria Municipal de Saúde</small>
    </div>

    <div class="secao">
      <div class="secao-titulo">Informações do Atendimento</div>
      <div class="grid3">
        <div class="campo"><label>Data agendada</label><span>${dataAtendimento ? dataAtendimento.split('-').reverse().join('/') : '—'}</span></div>
        <div class="campo"><label>Especialidade</label><span>${espLabel}</span></div>
        <div class="campo"><label>Profissional</label><span>${ag.profissional_nome || 'A definir'}</span></div>
        <div class="campo"><label>Período</label><span>${ag.periodo || '—'}</span></div>
        <div class="campo"><label>Regulador</label><span>${ag.autorizado_por || '—'}</span></div>
      </div>
      ${ag.observacao ? `<div class="campo" style="margin-top:8px"><label>Observação</label><span style="white-space:normal">${ag.observacao}</span></div>` : ''}
    </div>

    ${preparo ? `
    <div style="background:#fff7ed;border:1px solid #fb923c;border-radius:4px;padding:10px 14px;margin-top:10px;font-size:11px;color:#7c2d12;">
      <strong>🧪 ORIENTAÇÕES PARA O ATENDIMENTO:</strong><br/>${preparo}
    </div>` : ''}

    <div class="aviso">
      ⚠️ <strong>Importante:</strong> Apresente este comprovante no dia do atendimento junto com documento de identidade e cartão SUS.
      Este comprovante é válido apenas para a data agendada.
    </div>
  </div>
  <script>window.onload = () => { window.print(); }</script>
</body>
</html>`

  const janela = window.open('', '_blank', 'width=750,height=900')
  janela.document.write(html)
  janela.document.close()
}

// ── Impressão de lista do relatório ──────────────────────────────────────────
function imprimirRelatorio(registros, mesLabel, anoLabel, espLabel, periodosConfig = [], statusFiltro = '', tiposUsgOrdem = TIPOS_USG_ORDEM) {
  const hoje = new Date()
  const dataEmissao = hoje.toLocaleDateString('pt-BR')
  const horaEmissao = hoje.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })

  // isUsg: verdadeiro se a especialidade é USG (por label) OU se os registros são de USG
  const isUsg = espLabel?.toLowerCase() === 'usg' ||
    (registros.length > 0 && registros.some(r => tiposUsgOrdem.includes(r.tipo_exame)))

  // Modo agrupado por período: apenas para autorizados (ou quando não há filtro de status)
  const modoAgrupado = statusFiltro === 'autorizado' || (!statusFiltro && registros.some(r => r.periodo))

  // Ordena por tiposUsgOrdem (USG) ou por data de solicitação (demais)
  function sortarLista(lista) {
    return [...lista].sort((a, b) => {
      if (isUsg && modoAgrupado) {
        const ia = tiposUsgOrdem.indexOf(a.tipo_exame)
        const ib = tiposUsgOrdem.indexOf(b.tipo_exame)
        const diff = (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib)
        if (diff !== 0) return diff
      }
      const dA = modoAgrupado ? (a.data_atendimento || a.data_consulta || '') : (a.data_consulta || '')
      const dB = modoAgrupado ? (b.data_atendimento || b.data_consulta || '') : (b.data_consulta || '')
      return dA.localeCompare(dB) || (a.created_at || '').localeCompare(b.created_at || '')
    })
  }

  // Agrupa por período respeitando a ordem de cadastro dos períodos
  const ordemPeriodos = periodosConfig.map(p => p.nome)
  const periodosPresentes = [...new Set(registros.map(r => r.periodo || ''))].sort((a, b) => {
    if (!a) return 1  // sem período vai para o final
    if (!b) return -1
    const ia = ordemPeriodos.indexOf(a)
    const ib = ordemPeriodos.indexOf(b)
    return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib)
  })

  const STATUS_INFO = {
    autorizado: { label: 'AUTORIZADOS',  cor: '#166534', borda: '#1a7a3c', bg: '#f0fdf4' },
    pendente:   { label: 'PENDENTES',    cor: '#92400e', borda: '#d97706', bg: '#fffbeb' },
    negado:     { label: 'NEGADOS',      cor: '#991b1b', borda: '#dc2626', bg: '#fef2f2' },
    excluido:   { label: 'EXCLUÍDOS',    cor: '#475569', borda: '#94a3b8', bg: '#f8fafc' },
  }

  // Retorna o operador mais relevante conforme o status
  function operadorDo(r) {
    if (r.status === 'autorizado') return r.autorizado_por || r.criado_por || '—'
    return r.criado_por || '—'
  }

  // Função para gerar linhas simples (pendente/negado/excluído)
  function linhasSimples(lista) {
    return sortarLista(lista).map(r => {
      numGlobal++
      const data = r.data_consulta
      const dataFmt = data ? data.split('-').reverse().join('/') : '—'
      return `<tr>
        <td>${numGlobal}</td>
        <td style="font-weight:700">${r.paciente_nome || '—'}</td>
        <td>${r.paciente_cns || '—'}</td>
        <td>${r.telefone || '—'}</td>
        <td>${r.tipo_exame || '—'}</td>
        <td style="white-space:nowrap">${dataFmt}</td>
        <td style="color:#475569">${operadorDo(r)}</td>
      </tr>`
    }).join('')
  }

  // Função para gerar blocos agrupados por período (autorizados)
  function blocosAgrupados(lista) {
    const presentes = [...new Set(lista.map(r => r.periodo || ''))].sort((a, b) => {
      if (!a) return 1
      if (!b) return -1
      const ia = ordemPeriodos.indexOf(a)
      const ib = ordemPeriodos.indexOf(b)
      return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib)
    })
    return presentes.map(periodo => {
      const grupo = sortarLista(lista.filter(r => (r.periodo || '') === periodo))
      const primeiroR = grupo[0]
      const dataGrupo = primeiroR ? (primeiroR.data_atendimento || primeiroR.data_consulta) : null
      const dataGrupoFmt = dataGrupo ? dataGrupo.split('-').reverse().join('/') : null
      const profGrupo = primeiroR?.profissional_nome || null
      const infoPeriodo = [dataGrupoFmt, profGrupo].filter(Boolean).join(' · ')
      const cab = periodo
        ? `<tr><td colspan="7" style="padding:10px 7px 4px;font-weight:800;font-size:11px;text-transform:uppercase;letter-spacing:0.06em;color:#1a7a3c;border-top:2px solid #1a7a3c;background:#f0fdf4;-webkit-print-color-adjust:exact;print-color-adjust:exact;">${periodo} — ${grupo.length} paciente${grupo.length !== 1 ? 's' : ''}${infoPeriodo ? `<span style="font-weight:400;font-size:10px;margin-left:10px;color:#166534;">${infoPeriodo}</span>` : ''}</td></tr>`
        : `<tr><td colspan="7" style="padding:10px 7px 4px;font-weight:800;font-size:11px;text-transform:uppercase;letter-spacing:0.06em;color:#64748b;border-top:2px solid #e2e8f0;">Sem período — ${grupo.length} paciente${grupo.length !== 1 ? 's' : ''}${infoPeriodo ? `<span style="font-weight:400;font-size:10px;margin-left:10px;">${infoPeriodo}</span>` : ''}</td></tr>`
      
      let numPeriodo = 0
      const linhas = grupo.map(r => {
        numPeriodo++
        return `<tr>
          <td>${numPeriodo}</td>
          <td style="font-weight:700">${r.paciente_nome || '—'}</td>
          <td>${r.paciente_cns || '—'}</td>
          <td>${r.telefone || '—'}</td>
          <td>${r.tipo_exame || '—'}</td>
          <td>—</td>
          <td style="color:#475569">${operadorDo(r)}</td>
        </tr>`
      }).join('')
      return cab + linhas
    }).join('')
  }

  let numGlobal = 0
  let blocos = ''

  if (!statusFiltro) {
    // ── Todos os status: separar por bloco de status ──
    const ordemStatus = ['autorizado', 'pendente', 'negado', 'excluido']
    blocos = ordemStatus.map(st => {
      const grupo = registros.filter(r => r.status === st)
      if (grupo.length === 0) return ''
      const info = STATUS_INFO[st]
      const cabStatus = `<tr><td colspan="7" style="padding:11px 7px 5px;font-weight:800;font-size:12px;text-transform:uppercase;letter-spacing:0.06em;color:${info.cor};border-top:3px solid ${info.borda};background:${info.bg};-webkit-print-color-adjust:exact;print-color-adjust:exact;">${info.label} — ${grupo.length} registro${grupo.length !== 1 ? 's' : ''}</td></tr>`
      const conteudo = st === 'autorizado' ? blocosAgrupados(grupo) : linhasSimples(grupo)
      return cabStatus + conteudo
    }).join('')
  } else if (modoAgrupado) {
    // ── Autorizados: agrupado por período ──
    blocos = blocosAgrupados(registros)
  } else {
    // ── Pendentes / Negados / Excluídos: lista simples ──
    blocos = linhasSimples(registros)
  }

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8"/>
  <title>Relatório de Especialidades</title>
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    body { font-family: Arial, sans-serif; font-size: 11px; color: #000; padding: 24px 28px; }
    .cabecalho { margin-bottom: 14px; padding-bottom: 10px; border-bottom: 2px solid #1a7a3c; }
    .cab-topo { display: flex; align-items: center; gap: 14px; margin-bottom: 8px; }
    .cab-logo { width: 52px; height: 52px; object-fit: contain; }
    .cab-texto p { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; line-height: 1.6; }
    .cab-titulo { text-align: center; }
    .cab-titulo h2 { font-size: 14px; font-weight: 800; text-transform: uppercase; margin-bottom: 3px; }
    .cab-titulo small { font-size: 10px; color: #555; }
    table { width: 100%; border-collapse: collapse; margin-top: 14px; }
    thead tr { background: #1a7a3c; color: white; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    th { padding: 6px 7px; text-align: left; font-size: 9px; text-transform: uppercase; letter-spacing: 0.05em; }
    td { padding: 5px 7px; border-bottom: 1px solid #e2e8f0; font-size: 10px; }
    tr:nth-child(even) td { background: #f8fafc; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .rodape { margin-top: 16px; font-size: 10px; color: #555; text-align: right; }
    @media print { body { padding: 10px; } }
  </style>
</head>
<body>
  <div class="cabecalho">
    <div class="cab-topo">
      <img class="cab-logo" src="/logo.jpg" alt="Logo" />
      <div class="cab-texto">
        <p>Prefeitura Municipal de ${clientConfig.municipalityName}</p>
        <p>Fundo Municipal de Saúde</p>
        <p>Secretaria Municipal de Saúde</p>
      </div>
    </div>
    <div class="cab-titulo">
      <h2>Lista de ${isUsg ? 'Exames' : 'Consultas'}${espLabel ? ' — ' + espLabel.toUpperCase() : ''}</h2>
      <p style="font-size:11px;font-weight:700;margin:4px 0 2px;text-transform:uppercase;letter-spacing:0.06em;color:${statusFiltro === 'autorizado' ? '#166534' : statusFiltro === 'negado' ? '#991b1b' : statusFiltro === 'excluido' ? '#475569' : '#92400e'}">
        ${{ autorizado: 'Autorizados', pendente: 'Pendentes', negado: 'Negados', excluido: 'Excluídos', '': 'Todos os status' }[statusFiltro] || 'Todos os status'}
      </p>
      <small>Competência: ${mesLabel}${anoLabel ? '/' + anoLabel : ''} &nbsp;|&nbsp; Emitido em: ${dataEmissao} às ${horaEmissao} &nbsp;|&nbsp; ${registros.length} registro${registros.length !== 1 ? 's' : ''}</small>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th>#</th><th>Paciente</th><th>CPF/CNS</th><th>Telefone</th><th>Tipo</th>
        <th>${modoAgrupado && statusFiltro === 'autorizado' ? '' : 'Data Solicitação'}</th>
        <th>${statusFiltro === 'autorizado' ? 'Autorizado por' : statusFiltro === 'pendente' ? 'Cadastrado por' : 'Operador'}</th>
      </tr>
    </thead>
    <tbody>${blocos}</tbody>
  </table>
  <div class="rodape">Total: ${registros.length} registro${registros.length !== 1 ? 's' : ''}</div>
  <script>window.onload = () => { window.print(); }</script>
</body>
</html>`

  const janela = window.open('', '_blank', 'width=900,height=900')
  janela.document.write(html)
  janela.document.close()
}

// ── Modal base ────────────────────────────────────────────────────────────────
function Modal({ titulo, onClose, children, largura = '520px' }) {
  useEffect(() => {
    function esc(e) { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', esc)
    return () => window.removeEventListener('keydown', esc)
  }, [onClose])
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <motion.div
        initial={{ opacity: 0, scale: 0.94, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.94, y: 12 }}
        transition={{ duration: 0.22, ease: 'easeOut' }}
        style={{ background: 'white', borderRadius: '16px', width: '100%', maxWidth: largura, boxShadow: '0 25px 60px rgba(0,0,0,0.3)', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ fontFamily: 'Sora, sans-serif', fontSize: '15px', fontWeight: '700', color: '#0f172a', margin: 0 }}>{titulo}</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer', color: '#64748b', lineHeight: 1, padding: '0 4px' }}>✕</button>
        </div>
        <div style={{ padding: '20px 24px', overflowY: 'auto', flex: 1 }}>{children}</div>
      </motion.div>
    </motion.div>
  )
}

// ── Autocomplete de paciente ──────────────────────────────────────────────────
function BuscaPaciente({ onSelect }) {
  const [termo, setTermo] = useState('')
  const [sugestoes, setSugestoes] = useState([])
  const [aberto, setAberto] = useState(false)
  const timer = useRef(null)

  function buscar(v) {
    setTermo(v)
    clearTimeout(timer.current)
    if (v.trim().length < 2) { setSugestoes([]); setAberto(false); return }
    timer.current = setTimeout(async () => {
      const soDigitos = v.replace(/\D/g, '')
      let query = supabase.from('pacientes').select('id, nome, cpf_cns, telefone, sexo, endereco, bairro').order('nome').limit(8)
      if (soDigitos.length >= 3 && !/[a-zA-ZÀ-ÿ]/.test(v)) {
        query = query.ilike('cpf_cns', `%${soDigitos}%`)
      } else {
        query = query.ilike('nome', `%${v.toUpperCase()}%`)
      }
      const { data } = await query
      setSugestoes(data || [])
      setAberto(true)
    }, 280)
  }

  function selecionar(p) {
    onSelect(p)
    setTermo('')
    setSugestoes([])
    setAberto(false)
  }

  function fmtCns(v) {
    if (!v) return ''
    const s = String(v).replace(/\D/g, '')
    if (s.length <= 11) return s.replace(/^(\d{3})(\d{3})(\d{3})(\d{0,2})/, '$1.$2.$3-$4').replace(/-$/, '')
    return s.replace(/^(\d{3})(\d{3})(\d{3})(\d{3})(\d{0,3})/, '$1.$2.$3.$4.$5').replace(/\.$/, '')
  }

  return (
    <div style={{ position: 'relative' }}>
      <label className="label-modern">Buscar paciente (nome ou CPF/CNS)</label>
      <input className="input-modern" type="text" placeholder="Digite para buscar na base..."
        value={termo} onChange={e => buscar(e.target.value)}
        onBlur={() => setTimeout(() => setAberto(false), 180)}
        style={{ width: '100%' }} />
      {aberto && sugestoes.length > 0 && (
        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'white', border: '1.5px solid #cbd5e1', borderRadius: '10px', boxShadow: '0 8px 24px rgba(0,0,0,0.12)', zIndex: 50, overflow: 'hidden', marginTop: '2px' }}>
          {sugestoes.map(p => (
            <button key={p.id} onMouseDown={() => selecionar(p)}
              style={{ display: 'block', width: '100%', textAlign: 'left', padding: '10px 14px', border: 'none', background: 'none', cursor: 'pointer', borderBottom: '1px solid #f1f5f9', fontFamily: 'DM Sans, sans-serif' }}
              onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
              onMouseLeave={e => e.currentTarget.style.background = 'none'}
            >
              <span style={{ fontWeight: '600', color: '#0f172a', fontSize: '13px', display: 'block' }}>{p.nome}</span>
              <span style={{ fontSize: '11px', color: '#64748b', fontFamily: 'monospace' }}>
                {fmtCns(p.cpf_cns)}{p.telefone ? ` · ${p.telefone}` : ''}
              </span>
            </button>
          ))}
        </div>
      )}
      {aberto && sugestoes.length === 0 && termo.length >= 2 && (
        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'white', border: '1.5px solid #e2e8f0', borderRadius: '10px', padding: '12px 14px', fontSize: '12px', color: '#94a3b8', marginTop: '2px', zIndex: 50 }}>
          Nenhum paciente encontrado na base.
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
export default function Especialidades() {
  const router = useRouter()
  const [usuario, setUsuario] = useState(null)

  // Navegação principal
  const [abaMain, setAbaMain] = useState('agendamento') // agendamento | relatorio
  const [esp, setEsp] = useState('ortopedia')
  const [mes, setMes] = useState(() => String(new Date().getMonth() + 1).padStart(2, '0'))
  const [ano, setAno] = useState(() => String(new Date().getFullYear()))

  // Dados
  const [agendamentos, setAgendamentos] = useState([])
  const [escala, setEscala] = useState([])
  const [profissionais, setProfissionais] = useState([]) // todos da especialidade ativa
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState({ txt: '', ok: true })

  // Formulário de agendamento
  const [mostrarForm, setMostrarForm] = useState(false)
  const [form, setForm] = useState({ paciente_nome: '', paciente_cns: '', telefone: '', sexo: '', endereco: '', bairro: '', data_consulta: '', tipo_exame: '', observacao: '', profissional_nome: '', data_atendimento: '', prioridade: '' })
  const [salvando, setSalvando] = useState(false)

  // Modal Gestão Unificado ('escala' | 'profissionais' | 'config' | null)
  const [modalGestao, setModalGestao] = useState(null)
  const [formProf, setFormProf] = useState({ nome: '', conselho_tipo: 'CRM', conselho_numero: '' })
  const [salvandoProf, setSalvandoProf] = useState(false)

  // Profissional ativo (selecionado no card da escala)
  const [profissionalAtivo, setProfissionalAtivo] = useState(null) // { id, profissional_nome, data_atendimento }

  // Modal escala
  const [salvandoEscala, setSalvandoEscala] = useState(false)
  const [profEscalaSel, setProfEscalaSel] = useState('')
  const [dataEscala, setDataEscala] = useState('')
  const [periodoEscala, setPeriodoEscala] = useState('')

  // Modal cancelamento
  const [modalCancel, setModalCancel] = useState({ show: false, id: null })
  const [motivoCancel, setMotivoCancel] = useState('')

  // Modal exclusão
  const [modalExcluir, setModalExcluir] = useState({ show: false, id: null })
  const [motivoExclusao, setMotivoExclusao] = useState('')

  // Modal visualização
  const [modalVer, setModalVer] = useState(null) // agendamento completo

  // Modal autorização
  const [modalAutorizar, setModalAutorizar] = useState(null) // agendamento a autorizar
  const [periodoAutorizar, setPeriodoAutorizar] = useState('')
  const [dataAtendimentoAutorizar, setDataAtendimentoAutorizar] = useState('')
  const [justificativaCota, setJustificativaCota] = useState('')

  // Modal edição
  const [modalEditar, setModalEditar] = useState({ show: false, id: null })
  const [formEditar, setFormEditar] = useState({ paciente_nome: '', paciente_cns: '', telefone: '', sexo: '', data_consulta: '', tipo_exame: '', observacao: '', profissional_nome: '', periodo: '', prioridade: '' })

  // Relatório
  const [relatorio, setRelatorio] = useState([])
  const [relDetalhes, setRelDetalhes] = useState([])
  const [relMes, setRelMes] = useState(() => String(new Date().getMonth() + 1).padStart(2, '0'))
  const [relAno, setRelAno] = useState(() => String(new Date().getFullYear()))
  const [relModoFiltro, setRelModoFiltro] = useState('mes') // 'mes' | 'periodo'
  const [relDataInicio, setRelDataInicio] = useState(() => `${new Date().getFullYear()}-01-01`)
  const [relDataFim, setRelDataFim] = useState(() => `${new Date().getFullYear()}-12-31`)
  const [relLoading, setRelLoading] = useState(false)
  const [relFiltroEsp, setRelFiltroEsp] = useState('')
  const [relFiltroStatus, setRelFiltroStatus] = useState('autorizado')
  const [relFiltroProf, setRelFiltroProf] = useState('')
  const [relFiltroPaciente, setRelFiltroPaciente] = useState('')
  const [relFiltroTipoUsg, setRelFiltroTipoUsg] = useState('')

  // Relatório SISREG
  const [sisregDados, setSisregDados] = useState([])
  const [sisregLoading, setSisregLoading] = useState(false)
  const [sisregFiltroDataInicio, setSisregFiltroDataInicio] = useState(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
  })
  const [sisregFiltroDataFim, setSisregFiltroDataFim] = useState(() => {
    const d = new Date()
    const ultimoDia = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${ultimoDia}`
  })
  const [sisregFiltroEsp, setSisregFiltroEsp] = useState('')
  const [sisregFiltroProc, setSisregFiltroProc] = useState('')
  const [sisregFiltroStatus, setSisregFiltroStatus] = useState('')
  const [sisregSincronizando, setSisregSincronizando] = useState(false)


  // Config dinâmica
  const [especialidades, setEspecialidades] = useState([])
  const [especialidadesConfig, setEspecialidadesConfig] = useState([])
  const [preparosDb, setPreparosDb] = useState(PREPARO_USG)
  const [preparosList, setPreparosList] = useState([])
  const [abaConfig, setAbaConfig] = useState('especialidades')
  // form nova especialidade
  const [formEsp, setFormEsp] = useState({ label: '', icon: '', cota: '30' })
  const [editandoEsp, setEditandoEsp] = useState(null) // slug da especialidade em edição, ou null
  const [salvandoEsp, setSalvandoEsp] = useState(false)
  // form novo preparo
  const [formPreparo, setFormPreparo] = useState({ especialidade_slug: 'usg', tipo_exame: '', instrucoes: '' })
  const [salvandoPreparo, setSalvandoPreparo] = useState(false)
  const [editandoPreparo, setEditandoPreparo] = useState(null) // id sendo editado
  // períodos
  const [periodos, setPeriodos] = useState([])
  const [formPeriodo, setFormPeriodo] = useState({ nome: '', horario: '' })
  const [salvandoPeriodo, setSalvandoPeriodo] = useState(false)

  // Config dinâmica de USG
  const [tiposUsgOrdem, setTiposUsgOrdem] = useState(TIPOS_USG_ORDEM)
  const [tiposUsg, setTiposUsg] = useState(TIPOS_USG)
  const [novoTipoUsg, setNovoTipoUsg] = useState('')
  const [salvandoTipoUsg, setSalvandoTipoUsg] = useState(false)

  useEffect(() => {
    const u = localStorage.getItem('sms_user')
    if (!u) { router.push('/'); return }
    setUsuario(JSON.parse(u))
    carregarConfig()
  }, [])

  async function carregarConfig() {
    try {
      const [resEsp, resPre, resPer] = await Promise.all([
        fetch('/api/config/especialidades'),
        fetch('/api/config/preparos'),
        fetch('/api/config/periodos')
      ])
      const dataEsp = await resEsp.json()
      const dataPre = await resPre.json()
      const dataPer = await resPer.json()
      if (dataPer.ok) setPeriodos(dataPer.data || [])
      if (Array.isArray(dataEsp) && dataEsp.length > 0) {
        setEspecialidadesConfig(dataEsp)
        const ativas = dataEsp.filter(e => e.ativo).map(e => ({ id: e.slug, label: e.label, icon: e.icon, cota: e.cota }))
        setEspecialidades(ativas)
        setEsp(prev => ativas.find(e => e.id === prev) ? prev : (ativas[0]?.id || prev))
      }
      if (Array.isArray(dataPre) && dataPre.length > 0) {
        setPreparosList(dataPre)
        const mapa = {}
        dataPre.filter(p => p.ativo).forEach(p => {
          if (p.tipo_exame) {
            mapa[String(p.tipo_exame).trim().toUpperCase()] = p.instrucoes
          }
          if (p.especialidade_slug && String(p.especialidade_slug).toLowerCase() !== 'usg') {
            mapa[String(p.especialidade_slug).trim().toUpperCase()] = p.instrucoes
          }
        })
        setPreparosDb(mapa)
      }

      try {
        const { data: cfgUsg } = await supabase
          .from('configuracoes')
          .select('valor')
          .eq('chave', 'especialidades_tipos_usg')
          .maybeSingle()
        if (cfgUsg?.valor && Array.isArray(cfgUsg.valor) && cfgUsg.valor.length > 0) {
          setTiposUsgOrdem(cfgUsg.valor)
          setTiposUsg([...cfgUsg.valor].sort((a, b) => a.localeCompare(b, 'pt-BR')))
        } else {
          setTiposUsgOrdem(TIPOS_USG_ORDEM)
          setTiposUsg(TIPOS_USG)
        }
      } catch (errUsg) {
        console.error('Erro ao carregar tipos de USG do banco:', errUsg)
        setTiposUsgOrdem(TIPOS_USG_ORDEM)
        setTiposUsg(TIPOS_USG)
      }
    } catch (_) { }
  }

  // Carregar dados ao mudar especialidade/mes/ano
  useEffect(() => {
    if (abaMain === 'agendamento') {
      setProfissionalAtivo(null)
      buscarAgendamentos(); buscarEscala(); buscarProfissionais()
    }
  }, [esp, abaMain])

  // Recarrega escala ao mudar mês/ano (a lista de agendamentos não filtra mais por mês)
  useEffect(() => {
    if (abaMain === 'agendamento') buscarEscala()
  }, [mes, ano])

  useEffect(() => { if (abaMain === 'relatorio') buscarRelatorio() }, [abaMain, relMes, relAno, relModoFiltro, relDataInicio, relDataFim])

  useEffect(() => {
    if (abaMain === 'relatorio_sisreg') {
      buscarRelatorioSisreg()
    }
  }, [abaMain, sisregFiltroDataInicio, sisregFiltroDataFim, sisregFiltroEsp, sisregFiltroStatus])

  function mostrarMsg(txt, ok = true) {
    setMsg({ txt, ok })
    setTimeout(() => setMsg({ txt: '', ok: true }), 5000)
  }

  // ── Busca de dados ────────────────────────────────────────────────────────
  async function buscarAgendamentos() {
    setLoading(true)
    try {
      const p = new URLSearchParams({ especialidade: esp })
      const res = await fetch('/api/especialidades?' + p)
      const json = await res.json()
      if (json.ok) setAgendamentos(json.data || [])
      else mostrarMsg('Erro: ' + json.error, false)
    } catch { mostrarMsg('Erro ao carregar agendamentos', false) }
    setLoading(false)
  }

  async function buscarEscala() {
    try {
      const p = new URLSearchParams({ especialidade: esp, mes, ano })
      const res = await fetch('/api/especialidades/escala?' + p)
      const json = await res.json()
      if (json.ok) setEscala(json.data || [])
    } catch { }
  }

  async function buscarProfissionais() {
    try {
      const p = new URLSearchParams({ especialidade: esp })
      const res = await fetch('/api/especialidades/profissionais?' + p)
      const json = await res.json()
      if (json.ok) setProfissionais(json.data || [])
    } catch { }
  }

  async function buscarRelatorio() {
    setRelLoading(true)
    try {
      const res = await fetch('/api/especialidades?incluir_excluidos=1')
      const json = await res.json()
      const todos = json.data || []

      // Filtra pelo intervalo selecionado:
      // - autorizados: usa data_atendimento (data real do exame)
      // - demais (pendente, negado, excluido): usa data_consulta (data da solicitação)
      const getDataRef = (r) => {
        if (r.status === 'autorizado') return r.data_atendimento || r.data_consulta || null
        return r.data_consulta || null
      }
      const pertenceAoMes = (r) => {
        if (r.status === 'pendente') return true
        const dataRef = getDataRef(r)
        if (relModoFiltro === 'periodo') {
          if (!dataRef) return false
          return dataRef >= relDataInicio && dataRef <= relDataFim
        }
        // modo mês
        if (!dataRef) return r.mes === relMes && r.ano === relAno
        const [anoD, mesD] = dataRef.split('-')
        return mesD === relMes && anoD === relAno
      }

      const filtrados = todos.filter(pertenceAoMes)

      // Resumo por especialidade
      const mapa = {}
      const EXAMES_PESO_DUPLO_REL = ['ARTICULAÇÃO']
      especialidades.forEach(e => { mapa[e.id] = { label: e.label, icon: e.icon, cota: e.cota, pendente: 0, autorizado: 0, negado: 0, excluido: 0 } })
      filtrados.forEach(r => {
        if (mapa[r.especialidade]) {
          const peso = (r.status === 'autorizado' && EXAMES_PESO_DUPLO_REL.includes(r.tipo_exame)) ? 2 : 1
          mapa[r.especialidade][r.status] = (mapa[r.especialidade][r.status] || 0) + peso
        }
      })
      setRelatorio(Object.values(mapa))
      setRelDetalhes(filtrados)
    } catch { mostrarMsg('Erro ao gerar relatório', false) }
    setRelLoading(false)
  }

  // ── Agendamento ───────────────────────────────────────────────────────────
  function preencherPaciente(p) {
    setForm(f => ({
      ...f,
      paciente_nome: p.nome,
      paciente_cns: p.cpf_cns || '',
      telefone: p.telefone || '',
      sexo: p.sexo || '',
      endereco: p.endereco || '',
      bairro: p.bairro || '',
      // limpa tipo de exame se o sexo mudou e o exame selecionado fosse incompatível
      tipo_exame: '',
    }))
  }

  async function buscarRelatorioSisreg() {
    setSisregLoading(true)
    try {
      let query = supabase
        .from('monitoramento_sisreg')
        .select('*')
        .order('data_solicitacao', { ascending: false })

      if (sisregFiltroDataInicio) {
        query = query.gte('data_solicitacao', `${sisregFiltroDataInicio}T00:00:00`)
      }
      if (sisregFiltroDataFim) {
        query = query.lte('data_solicitacao', `${sisregFiltroDataFim}T23:59:59`)
      }
      if (sisregFiltroStatus) {
        if (sisregFiltroStatus === 'SOLICITAÇÃO / CANCELADA') {
          query = query.ilike('status_solicitacao', '%SOLICITAÇÃO / CANCELADA%')
        } else if (sisregFiltroStatus === 'AGENDAMENTO / CANCELADO') {
          query = query.ilike('status_solicitacao', '%AGENDAMENTO / CANCELADO%')
        } else {
          query = query.eq('status_solicitacao', sisregFiltroStatus)
        }
      }
      if (sisregFiltroProc) {
        query = query.ilike('descricao_interna_procedimento', `%${sisregFiltroProc}%`)
      }
      if (sisregFiltroEsp) {
        const espObj = especialidades.find(e => e.id === sisregFiltroEsp)
        if (espObj) {
          query = query.ilike('descricao_interna_procedimento', `%${espObj.label}%`)
        }
      }

      const { data, error } = await query
      if (error) throw error
      setSisregDados(data || [])
    } catch (e) {
      mostrarMsg('Erro ao carregar dados do SISREG: ' + e.message, false)
    } finally {
      setSisregLoading(false)
    }
  }

  async function sincronizarSisreg() {
    if (!usuario?.usuario) {
      mostrarMsg('Erro: Usuário não autenticado.', false)
      return
    }
    setSisregSincronizando(true)
    try {
      const res = await fetch(`/api/whatsapp/sisreg/sync?userCpf=${usuario.usuario}`, {
        method: 'POST'
      })
      const data = await res.json()
      if (!data.ok) throw new Error(data.error || 'Erro na sincronização')
      
      mostrarMsg(`Sincronização concluída: ${data.total} registros processados.`)
      buscarRelatorioSisreg()
    } catch (e) {
      mostrarMsg('Erro ao sincronizar com o SISREG: ' + e.message, false)
    } finally {
      setSisregSincronizando(false)
    }
  }

  function exportarCsvSisreg(dados) {
    const headers = 'Nº;Código Solicitação;Data de Solicitação;Paciente;CPF/CNS;Procedimento;Situação\n'
    const rows = dados.map((r, i) => {
      const num = i + 1
      const codigo = r.codigo_solicitacao || ''
      const data = r.data_solicitacao ? new Date(r.data_solicitacao).toLocaleDateString('pt-BR') : ''
      const paciente = r.no_usuario || ''
      const cnsCpf = r.cpf_usuario || r.cns_usuario || ''
      const procedimento = r.descricao_interna_procedimento || ''
      const situacao = abbreviateStatus(r.status_solicitacao)
      
      const escape = (val) => `"${String(val).replace(/"/g, '""')}"`
      return `${num};${escape(codigo)};${escape(data)};${escape(paciente)};${escape(cnsCpf)};${escape(procedimento)};${escape(situacao)}`
    }).join('\n')
    
    const blob = new Blob(['\ufeff' + headers + rows], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.setAttribute('href', url)
    link.setAttribute('download', `relatorio_sisreg_${new Date().toISOString().slice(0,10)}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  async function salvarAgendamento() {
    const isUsg = esp === 'usg'
    if (!form.paciente_nome.trim()) { mostrarMsg('Informe o nome do paciente', false); return }
    if (!form.telefone.trim()) { mostrarMsg('Informe o telefone', false); return }
    if (!form.endereco || !form.bairro) {
      mostrarMsg('Atualize o endereço e bairro deste paciente na aba "Pacientes" antes de agendar.', false)
      return
    }
    if (!form.data_consulta) { mostrarMsg('Informe a data de solicitação', false); return }
    if (!form.tipo_exame) { mostrarMsg(isUsg ? 'Selecione o tipo de exame' : 'Selecione o tipo de consulta', false); return }
    if (escala.length > 0 && !form.profissional_nome) { mostrarMsg('Selecione o profissional', false); return }
    // Restrições por sexo (USG)
    if (isUsg && form.sexo) {
      const sexoM = ['M', 'MASCULINO', 'Masculino', 'm'].includes(form.sexo)
      const sexoF = ['F', 'FEMININO', 'Feminino', 'f'].includes(form.sexo)
      if (form.tipo_exame === 'TRANSVAGINAL' && !sexoF) {
        mostrarMsg('Exame de Transvaginal é exclusivo para pacientes do sexo feminino', false); return
      }
      if (['PRÓSTATA TRANSRETAL', 'PRÓSTATA ABDOMINAL'].includes(form.tipo_exame) && !sexoM) {
        mostrarMsg('Exame de Próstata é exclusivo para pacientes do sexo masculino', false); return
      }
    }
    setSalvando(true)
    try {
      const res = await fetch('/api/especialidades', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          especialidade: esp,
          paciente_nome: form.paciente_nome.trim().toUpperCase(),
          paciente_cns: form.paciente_cns.replace(/\D/g, '') || null,
          telefone: form.telefone,
          data_consulta: form.data_consulta,
          data_atendimento: form.data_atendimento || null,
          tipo_exame: form.tipo_exame || null,
          observacao: form.observacao.trim() || null,
          profissional_nome: form.profissional_nome || null,
          prioridade: form.prioridade || null,
          sexo: form.sexo || null,
          mes, ano,
          criado_por: usuario?.nome || null,
        })
      })
      const json = await res.json()
      if (!json.ok) throw new Error(json.error)
      mostrarMsg('Agendamento registrado')
      setForm({ paciente_nome: '', paciente_cns: '', telefone: '', sexo: '', data_consulta: '', tipo_exame: '', observacao: '', profissional_nome: '', data_atendimento: '', prioridade: '' })
      setMostrarForm(false)
      buscarAgendamentos()
    } catch (e) { mostrarMsg('' + e.message, false) }
    setSalvando(false)
  }

  // ── Status ────────────────────────────────────────────────────────────────
  async function confirmarAutorizar() {
    if (!dataAtendimentoAutorizar) { mostrarMsg('Informe a data de atendimento', false); return }
    if (!periodoAutorizar) { mostrarMsg('Selecione o período de atendimento', false); return }

    // 1. Verificar se existe escala cadastrada
    if (escala.length === 0) {
      mostrarMsg('Não é permitido autorizar agendamentos sem profissional ou escala cadastrada para esta especialidade.', false)
      return
    }

    // 2. Verificar se a data e o período selecionados correspondem a alguma entrada na escala
    const escalaValida = escala.find(e => {
      const dataBate = e.data_atendimento === dataAtendimentoAutorizar
      const escalaPeriodoNorm = String(e.periodo || '').trim().toUpperCase()
      const selecionadoPeriodoNorm = String(periodoAutorizar || '').trim().toUpperCase()
      return dataBate && (escalaPeriodoNorm === selecionadoPeriodoNorm)
    })

    if (!escalaValida) {
      mostrarMsg('A data ou período informados não constam na escala cadastrada para esta especialidade.', false)
      return
    }

    // 3. Verificar se a escala possui um profissional configurado
    if (!escalaValida.profissional_nome || !escalaValida.profissional_nome.trim()) {
      mostrarMsg('A escala selecionada não possui um profissional de saúde cadastrado.', false)
      return
    }

    // 4. Se for exame com jejum de 8h, impedir agendamento no período da tarde
    const exigeJejum = EXAMES_JEJUM.includes(modalAutorizar.tipo_exame)
    if (exigeJejum && periodoAutorizar && String(periodoAutorizar).toLowerCase().includes('tarde')) {
      mostrarMsg('Exames com jejum de 8h (como Abdomen Total/Superior) não podem ser agendados no período da tarde.', false)
      return
    }

    const datasEscala = Array.from(new Set(escala.map(item => item.data_atendimento)))
    const diasEscalaCount = datasEscala.length
    const cotaDiaria = diasEscalaCount > 0 ? Math.floor(espAtiva.cota / diasEscalaCount) : espAtiva.cota
    const usadosNoDia = agendamentos.filter(a => a.status === 'autorizado' && a.data_atendimento === dataAtendimentoAutorizar).reduce((acc, a) => acc + pesoCota(a), 0)
    const cotaEsgotada = usadosNoDia >= cotaDiaria

    const isAdmin = usuario?.perfil === 'admin'
    if (cotaEsgotada && !isAdmin) { mostrarMsg('Cota diária para esta data esgotada. Apenas o administrador pode autorizar.', false); return }
    if (cotaEsgotada && isAdmin && !justificativaCota.trim()) { mostrarMsg('Informe a justificativa para autorizar além da cota', false); return }
    const id = modalAutorizar.id
    try {
      const res = await fetch('/api/especialidades', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          id, 
          status: 'autorizado', 
          autorizado_por: usuario?.nome || null, 
          periodo: periodoAutorizar || null, 
          data_atendimento: dataAtendimentoAutorizar, 
          profissional_nome: escalaValida.profissional_nome || null,
          justificativa_cota: (cotaEsgotada && isAdmin) ? justificativaCota.trim() : null 
        })
      })
      const json = await res.json()
      if (!json.ok) throw new Error(json.error)
      const registroAtualizado = { 
        ...modalAutorizar, 
        status: 'autorizado', 
        motivo_cancelamento: null, 
        autorizado_por: usuario?.nome || null, 
        periodo: periodoAutorizar || null, 
        data_atendimento: dataAtendimentoAutorizar,
        profissional_nome: escalaValida.profissional_nome || null
      }
      setAgendamentos(prev => prev.map(a => a.id === id ? registroAtualizado : a))
      setModalAutorizar(null)
      setPeriodoAutorizar('')
      setDataAtendimentoAutorizar('')
      setJustificativaCota('')
      mostrarMsg('Agendamento autorizado')
      // Abre comprovante automaticamente
      imprimirComprovanteComDados(registroAtualizado, espAtiva.label)
    } catch (e) { mostrarMsg('' + e.message, false) }
  }

  // Busca dt_nasc do paciente e imprime o comprovante com a data de nascimento
  async function imprimirComprovanteComDados(ag, espLabel) {
    let dtNasc = null
    try {
      const cns = ag.paciente_cns
      if (cns) {
        const { data } = await supabase
          .from('pacientes')
          .select('dt_nasc')
          .eq('cpf_cns', cns)
          .maybeSingle()
        dtNasc = data?.dt_nasc || null
      }
    } catch (_) { }
    imprimirComprovante(ag, espLabel, undefined, preparosDb, dtNasc)
  }

  async function voltarPendente(id) {
    try {
      const res = await fetch('/api/especialidades', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status: 'pendente' })
      })
      const json = await res.json()
      if (!json.ok) throw new Error(json.error)
      setAgendamentos(prev => prev.map(a => a.id === id ? { ...a, status: 'pendente', motivo_cancelamento: null, autorizado_por: null, data_atendimento: null, periodo: null } : a))
      mostrarMsg('Solicitação devolvida para pendente')
    } catch (e) { mostrarMsg('' + e.message, false) }
  }

  async function confirmarCancelamento() {
    if (!motivoCancel.trim()) { mostrarMsg('Informe o motivo', false); return }
    try {
      const res = await fetch('/api/especialidades', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: modalCancel.id, status: 'negado', motivo_cancelamento: motivoCancel.trim() })
      })
      const json = await res.json()
      if (!json.ok) throw new Error(json.error)
      setAgendamentos(prev => prev.map(a => a.id === modalCancel.id ? { ...a, status: 'negado', motivo_cancelamento: motivoCancel.trim() } : a))
      setModalCancel({ show: false, id: null })
      setMotivoCancel('')
      mostrarMsg('Agendamento cancelado')
    } catch (e) { mostrarMsg('' + e.message, false) }
  }

  async function salvarEspecialidade() {
    if (!formEsp.label.trim()) { mostrarMsg('Informe o nome da especialidade', false); return }
    setSalvandoEsp(true)
    try {
      if (editandoEsp) {
        // Modo Edição
        const res = await fetch('/api/config/especialidades', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ slug: editandoEsp, label: formEsp.label.trim(), icon: formEsp.icon, cota: Number(formEsp.cota) || 30 })
        })
        const json = await res.json()
        if (json.error) throw new Error(json.error)
        setFormEsp({ label: '', icon: '', cota: '30' })
        setEditandoEsp(null)
        mostrarMsg('Especialidade atualizada')
      } else {
        // Modo Criação
        const res = await fetch('/api/config/especialidades', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ slug: formEsp.label, label: formEsp.label.trim(), icon: formEsp.icon, cota: Number(formEsp.cota) || 30 })
        })
        const json = await res.json()
        if (json.error) throw new Error(json.error)
        setFormEsp({ label: '', icon: '', cota: '30' })
        mostrarMsg('Especialidade cadastrada')
      }
      await carregarConfig()
    } catch (e) { mostrarMsg('' + e.message, false) }
    setSalvandoEsp(false)
  }

  async function toggleEspecialidade(slug, ativo) {
    try {
      await fetch('/api/config/especialidades', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug, ativo: !ativo })
      })
      await carregarConfig()
    } catch (e) { mostrarMsg('' + e.message, false) }
  }

  async function salvarPreparo() {
    if (!formPreparo.tipo_exame.trim() || !formPreparo.instrucoes.trim()) {
      mostrarMsg('Tipo de exame e instruções são obrigatórios', false); return
    }
    setSalvandoPreparo(true)
    try {
      const res = await fetch('/api/config/preparos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formPreparo)
      })
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      setFormPreparo({ especialidade_slug: formPreparo.especialidade_slug, tipo_exame: '', instrucoes: '' })
      setEditandoPreparo(null)
      mostrarMsg('Orientação salva')
      await carregarConfig()
    } catch (e) { mostrarMsg('' + e.message, false) }
    setSalvandoPreparo(false)
  }

  async function excluirPreparo(id) {
    if (!confirm('Remover esta orientação?')) return
    try {
      await fetch('/api/config/preparos?id=' + id, { method: 'DELETE' })
      mostrarMsg('Orientação removida')
      await carregarConfig()
    } catch (e) { mostrarMsg('' + e.message, false) }
  }

  async function salvarPeriodo() {
    if (!formPeriodo.nome.trim()) { mostrarMsg('Informe o nome do período', false); return }
    setSalvandoPeriodo(true)
    try {
      const res = await fetch('/api/config/periodos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nome: formPeriodo.nome.trim(), horario: formPeriodo.horario.trim() || null })
      })
      const json = await res.json()
      if (!json.ok) throw new Error(json.error)
      setFormPeriodo({ nome: '', horario: '' })
      mostrarMsg('Período cadastrado')
      await carregarConfig()
    } catch (e) { mostrarMsg('' + e.message, false) }
    setSalvandoPeriodo(false)
  }

  async function excluirPeriodo(id) {
    if (!confirm('Remover este período?')) return
    try {
      await fetch('/api/config/periodos?id=' + id, { method: 'DELETE' })
      mostrarMsg('Período removido')
      await carregarConfig()
    } catch (e) { mostrarMsg('' + e.message, false) }
  }

  async function salvarTiposUsgNoDb(novaLista) {
    if (!usuario?.usuario) {
      mostrarMsg('Erro: Usuário não autenticado.', false)
      return
    }
    if (usuario?.perfil !== 'admin') {
      mostrarMsg('Acesso negado. Apenas administradores podem alterar configurações.', false)
      return
    }
    setSalvandoTipoUsg(true)
    try {
      const res = await fetch('/api/config/geral', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          adminCpf: usuario.usuario,
          configs: {
            especialidades_tipos_usg: novaLista
          }
        })
      })
      const data = await res.json()
      if (!data.ok) throw new Error(data.error || 'Erro ao salvar tipos de USG')
      
      setTiposUsgOrdem(novaLista)
      setTiposUsg([...novaLista].sort((a, b) => a.localeCompare(b, 'pt-BR')))
      mostrarMsg('Tipos de Ultrassom atualizados com sucesso')
    } catch (e) {
      mostrarMsg('Erro ao salvar tipos de USG: ' + e.message, false)
    } finally {
      setSalvandoTipoUsg(false)
    }
  }

  async function handleAdicionarTipoUsg() {
    const nome = novoTipoUsg.trim().toUpperCase()
    if (!nome) return
    if (tiposUsgOrdem.includes(nome)) {
      mostrarMsg('Este tipo de ultrassom já existe', false)
      return
    }
    const novaLista = [...tiposUsgOrdem, nome]
    await salvarTiposUsgNoDb(novaLista)
    setNovoTipoUsg('')
  }

  async function handleExcluirTipoUsg(tipoExcluir) {
    if (!window.confirm(`Tem certeza que deseja excluir o tipo de ultrassom "${tipoExcluir}"?`)) return
    const novaLista = tiposUsgOrdem.filter(t => t !== tipoExcluir)
    await salvarTiposUsgNoDb(novaLista)
  }

  async function confirmarExclusao() {
    if (!motivoExclusao.trim()) { mostrarMsg('Informe o motivo', false); return }
    try {
      const res = await fetch('/api/especialidades', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: modalExcluir.id, status: 'excluido', motivo_exclusao: motivoExclusao.trim() })
      })
      const json = await res.json()
      if (!json.ok) throw new Error(json.error)
      setAgendamentos(prev => prev.filter(a => a.id !== modalExcluir.id))
      setModalExcluir({ show: false, id: null })
      setMotivoExclusao('')
      mostrarMsg('Agendamento excluído')
    } catch (e) { mostrarMsg('' + e.message, false) }
  }

  async function salvarEdicao() {
    if (!formEditar.paciente_nome.trim()) { mostrarMsg('Nome é obrigatório', false); return }
    if (!formEditar.telefone.trim()) { mostrarMsg('Telefone é obrigatório', false); return }
    if (!formEditar.data_consulta) { mostrarMsg('Data de solicitação é obrigatória', false); return }
    try {
      const res = await fetch('/api/especialidades', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: modalEditar.id,
          campos: {
            paciente_nome: formEditar.paciente_nome.trim(),
            paciente_cns: formEditar.paciente_cns || null,
            telefone: formEditar.telefone.replace(/\D/g, ''),
            sexo: formEditar.sexo || null,
            data_consulta: formEditar.data_consulta,
            tipo_exame: formEditar.tipo_exame || null,
            observacao: formEditar.observacao || null,
            profissional_nome: formEditar.profissional_nome || null,
            periodo: formEditar.periodo || null,
            prioridade: formEditar.prioridade || null,
          }
        })
      })
      const json = await res.json()
      if (!json.ok) throw new Error(json.error)
      setAgendamentos(prev => prev.map(a => a.id === modalEditar.id ? { ...a, ...json.data } : a))
      setModalEditar({ show: false, id: null })
      mostrarMsg('Agendamento atualizado')
    } catch (e) { mostrarMsg('' + e.message, false) }
  }

  // ── Profissionais ─────────────────────────────────────────────────────────
  async function salvarProfissional() {
    if (!formProf.nome.trim()) { mostrarMsg('Informe o nome', false); return }
    setSalvandoProf(true)
    try {
      const res = await fetch('/api/especialidades/profissionais', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ especialidade: esp, ...formProf })
      })
      const json = await res.json()
      if (!json.ok) throw new Error(json.error)
      mostrarMsg('Profissional cadastrado')
      setFormProf({ nome: '', conselho_tipo: 'CRM', conselho_numero: '' })
      buscarProfissionais()
    } catch (e) { mostrarMsg('' + e.message, false) }
    setSalvandoProf(false)
  }

  async function removerProfissional(id) {
    if (!confirm('Remover este profissional?')) return
    try {
      const res = await fetch('/api/especialidades/profissionais?id=' + id, { method: 'DELETE' })
      const json = await res.json()
      if (!json.ok) throw new Error(json.error)
      buscarProfissionais()
      buscarEscala()
    } catch (e) { mostrarMsg('' + e.message, false) }
  }

  // ── Escala ────────────────────────────────────────────────────────────────
  async function adicionarEscala() {
    if (!profEscalaSel) { mostrarMsg('Selecione um profissional', false); return }
    if (!dataEscala) { mostrarMsg('Informe a data de atendimento', false); return }
    setSalvandoEscala(true)
    const prof = profissionais.find(p => p.id === profEscalaSel)
    try {
      const res = await fetch('/api/especialidades/escala', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ especialidade: esp, profissional_id: prof.id, profissional_nome: prof.nome, mes, ano, data_atendimento: dataEscala, periodo: periodoEscala || null })
      })
      const json = await res.json()
      if (!json.ok) throw new Error(json.error)
      setProfEscalaSel('')
      setDataEscala('')
      buscarEscala()
    } catch (e) { mostrarMsg('' + e.message, false) }
    setSalvandoEscala(false)
  }

  async function removerEscala(id) {
    try {
      await fetch('/api/especialidades/escala?id=' + id, { method: 'DELETE' })
      setEscala(prev => prev.filter(e => e.id !== id))
    } catch (e) { mostrarMsg('' + e.message, false) }
  }

  // ── Cálculos de cota ──────────────────────────────────────────────────────
  const EXAMES_PESO_DUPLO = ['ARTICULAÇÃO']
  const pesoCota = (a) => EXAMES_PESO_DUPLO.includes(a.tipo_exame) ? 2 : 1
  const espAtiva = especialidades.find(e => e.id === esp) || especialidades[0] || ESPECIALIDADES[0]
  // Conta apenas autorizados com data_atendimento no mês/ano selecionado
  const autorizadosDoMes = agendamentos.filter(a => {
    if (a.status !== 'autorizado') return false
    const dataRef = a.data_atendimento || a.data_consulta
    if (!dataRef) return false
    const [anoD, mesD] = dataRef.split('-')
    return mesD === mes && anoD === ano
  })
  const autorizados = autorizadosDoMes.length
  const usados = autorizadosDoMes.reduce((acc, a) => acc + pesoCota(a), 0)
  const pct = Math.min(100, Math.round((usados / espAtiva.cota) * 100))

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <Layout usuario={usuario}>
      <div style={{ padding: '28px 32px', maxWidth: '1400px', margin: '0 auto' }}>



        {/* Cabeçalho */}
        <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h1 style={{ fontFamily: 'Sora, sans-serif', fontSize: '22px', fontWeight: '700', color: '#0f172a', margin: '0 0 4px' }}>Especialidades</h1>
            <p style={{ color: '#64748b', fontSize: '13px', margin: 0 }}>Solicitações e autorização de consultas e exames</p>
          </div>
          {abaMain === 'agendamento' && (
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', gap: '6px', alignSelf: 'flex-end', paddingBottom: '1px' }}>
                <button onClick={() => setModalGestao('profissionais')}
                  style={{ padding: '9px 14px', background: GRAD, border: 'none', borderRadius: '10px', color: 'white', fontSize: '12px', fontWeight: '700', cursor: 'pointer', fontFamily: 'Sora, sans-serif', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <UserCog size={13} /> Profissionais
                </button>
                <button onClick={() => setModalGestao('escala')}
                  style={{ padding: '9px 14px', background: GRAD, border: 'none', borderRadius: '10px', color: 'white', fontSize: '12px', fontWeight: '700', cursor: 'pointer', fontFamily: 'Sora, sans-serif', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <Calendar size={13} /> Escala
                </button>
                <button onClick={() => setModalGestao('config')}
                  style={{ padding: '9px 14px', background: 'linear-gradient(135deg, #374151, #6b7280)', border: 'none', borderRadius: '10px', color: 'white', fontSize: '12px', fontWeight: '700', cursor: 'pointer', fontFamily: 'Sora, sans-serif', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <Settings size={13} /> Configurações
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Abas principais */}
        <div style={{ display: 'flex', gap: '4px', borderBottom: '2px solid #e2e8f0', marginBottom: '20px' }}>
          {[
            { id: 'agendamento', label: 'Solicitações', Icon: CalendarDays }, 
            { id: 'relatorio', label: 'Relatório', Icon: BarChart2 },
            { id: 'relatorio_sisreg', label: 'Relatório SISREG', Icon: BarChart2 }
          ].map(t => (
            <button key={t.id} onClick={() => setAbaMain(t.id)}
              style={{ background: 'none', border: 'none', padding: '10px 18px', fontSize: '14px', fontWeight: '700', cursor: 'pointer', color: abaMain === t.id ? COR : '#64748b', borderBottom: 'none', marginBottom: '-2px', fontFamily: 'Sora, sans-serif', display: 'flex', alignItems: 'center', gap: '6px', position: 'relative', paddingBottom: '13px' }}>
              <t.Icon size={15} /> {t.label}
              {abaMain === t.id && (
                <motion.div layoutId="tab-indicator-esp"
                  style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '3px', background: COR, borderRadius: '2px 2px 0 0' }}
                  transition={{ duration: 0.25, ease: 'easeInOut' }} />
              )}
            </button>
          ))}
        </div>

        {msg.txt && (
          <div className={msg.ok ? 'status-ok' : 'status-err'} style={{
            position: 'fixed',
            top: '24px',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 999999,
            minWidth: '320px',
            maxWidth: '90%',
            boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.15), 0 8px 10px -6px rgba(0, 0, 0, 0.15)',
            textAlign: 'center'
          }}>{msg.txt}</div>
        )}

        {/* ── ABA: AGENDAMENTO ── */}
        {abaMain === 'agendamento' && (
          <>
            {/* Sub-abas especialidade */}
            <div style={{ display: 'flex', gap: '4px', marginBottom: '20px', borderBottom: '1px solid #e2e8f0', paddingBottom: '0', flexWrap: 'wrap' }}>
              {especialidades.length === 0
                ? <span style={{ padding: '8px 16px', fontSize: '13px', color: '#94a3b8', fontFamily: 'DM Sans, sans-serif' }}>Carregando…</span>
                : especialidades.map(e => (
                  <button key={e.id} onClick={() => setEsp(e.id)}
                    style={{ background: 'none', border: 'none', padding: '8px 16px', fontSize: '13px', fontWeight: '700', cursor: 'pointer', color: esp === e.id ? COR : '#64748b', borderBottom: esp === e.id ? `3px solid ${COR}` : '3px solid transparent', marginBottom: '-1px', fontFamily: 'Sora, sans-serif' }}>
                    {e.label}
                  </button>
                ))
              }
            </div>

            {/* Botão novo */}
            <div className="card" style={{ padding: '16px 20px', marginBottom: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button onClick={() => {
                  const hoje = new Date().toISOString().slice(0, 10)
                  if (!mostrarForm) {
                    setForm(f => ({
                      ...f,
                      data_consulta: hoje,
                      ...(profissionalAtivo ? { profissional_nome: profissionalAtivo.profissional_nome } : {})
                    }))
                  }
                  setMostrarForm(v => !v)
                }}
                  style={{ padding: '10px 20px', background: mostrarForm ? '#64748b' : GRAD, border: 'none', borderRadius: '10px', color: 'white', fontSize: '13px', fontWeight: '700', cursor: 'pointer', fontFamily: 'Sora, sans-serif' }}>
                  {mostrarForm ? '✕ Cancelar' : '+ Nova Solicitação'}
                </button>
              </div>

              {/* Formulário */}
              {mostrarForm && (
                <div style={{ marginTop: '20px', paddingTop: '20px', borderTop: '1px solid #e2e8f0' }}>
                  <p style={{ fontFamily: 'Sora, sans-serif', fontSize: '12px', fontWeight: '700', color: COR, textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 14px' }}>
                    Novo Agendamento — {espAtiva.icon} {espAtiva.label}
                  </p>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px', marginBottom: '14px' }}>
                    <div style={{ gridColumn: '1 / -1' }}>
                      <BuscaPaciente onSelect={preencherPaciente} />
                    </div>
                    <div style={{ gridColumn: '1 / -1' }}>
                      <label className="label-modern">Nome do Paciente *</label>
                      <input className="input-modern" type="text" placeholder="Nome completo (preenchido ao selecionar acima)"
                        value={form.paciente_nome}
                        onChange={e => setForm(f => ({ ...f, paciente_nome: e.target.value }))}
                        style={{ width: '100%' }} />
                    </div>
                    <div>
                      <label className="label-modern">CPF / CNS</label>
                      <input className="input-modern" type="text" placeholder="Preenchido automaticamente"
                        value={form.paciente_cns}
                        onChange={e => setForm(f => ({ ...f, paciente_cns: e.target.value }))}
                        style={{ width: '100%' }} />
                    </div>
                    <div>
                      <label className="label-modern">Telefone *</label>
                      <input className="input-modern" type="tel" placeholder="(63) 99999-9999"
                        value={form.telefone}
                        onChange={e => setForm(f => ({ ...f, telefone: fmtTelefone(e.target.value) }))}
                        style={{ width: '100%', borderColor: !form.telefone ? '#fca5a5' : undefined }} />
                    </div>
                    <div>
                      <label className="label-modern">Data de Solicitação *</label>
                      <input className="input-modern" type="date"
                        value={form.data_consulta}
                        onChange={e => setForm(f => ({ ...f, data_consulta: e.target.value }))}
                        style={{ width: '100%' }} />
                    </div>
                    <div>
                      <label className="label-modern">{esp === 'usg' ? 'Tipo de Exame *' : 'Tipo de Consulta'}</label>
                      <select className="input-modern" value={form.tipo_exame}
                        onChange={e => setForm(f => ({ ...f, tipo_exame: e.target.value }))}
                        style={{ width: '100%' }}>
                        <option value="">— Selecione —</option>
                        {(esp === 'usg' ? tiposUsg.filter(t => {
                          const sexoM = ['M', 'MASCULINO', 'Masculino', 'm'].includes(form.sexo)
                          const sexoF = ['F', 'FEMININO', 'Feminino', 'f'].includes(form.sexo)
                          if (!form.sexo) return true // sem sexo cadastrado → mostra tudo
                          if (t === 'TRANSVAGINAL') return sexoF
                          if (['PRÓSTATA TRANSRETAL', 'PRÓSTATA ABDOMINAL'].includes(t)) return sexoM
                          return true
                        }) : TIPOS_CONSULTA).map(t => (
                          <option key={t} value={t}>{t}</option>
                        ))}
                      </select>
                    </div>
                    {escala.length > 0 && (() => {
                      // Nomes únicos na escala
                      const profEscalaUnicos = [...new Map(escala.map(e => [e.profissional_nome, e])).values()]
                      return (
                        <div>
                          <label className="label-modern">Profissional</label>
                          <select className="input-modern"
                            value={form.profissional_nome}
                            onChange={e => {
                              const nome = e.target.value
                              const entradas = escala.filter(x => x.profissional_nome === nome)
                              // auto-fill: se só tiver uma data, preenche; senão limpa
                              const dataAuto = entradas.length === 1 ? (entradas[0].data_atendimento || '') : ''
                              setForm(f => ({ ...f, profissional_nome: nome, data_atendimento: dataAuto }))
                            }}
                            style={{ width: '100%' }}>
                            <option value="">— Selecione —</option>
                            {profEscalaUnicos.map(e => (
                              <option key={e.profissional_nome} value={e.profissional_nome}>{e.profissional_nome}</option>
                            ))}
                          </select>
                        </div>
                      )
                    })()}
                    <div style={{ gridColumn: '1 / -1' }}>
                      <label className="label-modern">Prioridade (Escala de Manchester)</label>
                      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '4px' }}>
                        {MANCHESTER.map(m => (
                          <button key={m.valor} type="button" onClick={() => setForm(f => ({ ...f, prioridade: f.prioridade === m.valor ? '' : m.valor }))}
                            style={{ padding: '5px 12px', borderRadius: '8px', border: `2px solid ${form.prioridade === m.valor ? m.borda : '#e2e8f0'}`, background: form.prioridade === m.valor ? m.bg : '#f8fafc', color: form.prioridade === m.valor ? m.cor : '#64748b', fontFamily: 'Sora, sans-serif', fontSize: '11px', fontWeight: '700', cursor: 'pointer', transition: 'all .15s' }}>
                            {m.label} <span style={{ fontWeight: '400', fontSize: '10px' }}>— {m.desc}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                    <div style={{ gridColumn: '1 / -1' }}>
                      <label className="label-modern">Observação</label>
                      <input className="input-modern" type="text" placeholder="Opcional"
                        value={form.observacao}
                        onChange={e => setForm(f => ({ ...f, observacao: e.target.value }))}
                        style={{ width: '100%' }} />
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <button className="btn-primary" style={{ background: GRAD }} onClick={salvarAgendamento} disabled={salvando}>
                      {salvando ? 'Salvando...' : <><Save size={13} style={{ display: 'inline', marginRight: '4px' }} /> Salvar</>}
                    </button>
                    <button className="btn-secondary" onClick={() => { setMostrarForm(false); setForm({ paciente_nome: '', paciente_cns: '', telefone: '', sexo: '', data_consulta: '', tipo_exame: '', observacao: '', profissional_nome: '', data_atendimento: '' }) }}>Cancelar</button>
                  </div>
                </div>
              )}
            </div>

            {/* Lista de agendamentos */}
            <div className="card esp-print-area" style={{ padding: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
                <h3 style={{ fontFamily: 'Sora, sans-serif', fontSize: '13px', fontWeight: '700', color: '#0f172a', margin: 0, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  {espAtiva.icon} {espAtiva.label} — Fila de Solicitações
                </h3>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
                  <span style={{ fontSize: '11px', fontWeight: '700', padding: '3px 8px', borderRadius: '20px', background: STATUS_STYLE.pendente.bg, color: STATUS_STYLE.pendente.cor, border: `1px solid ${STATUS_STYLE.pendente.borda}` }}>
                    Pendente: {agendamentos.filter(a => a.status === 'pendente').length}
                  </span>
                  {agendamentos.filter(a => a.status === 'pendente').length > 0 && (
                    <button className="no-print" onClick={() => window.print()}
                      style={{ padding: '5px 12px', background: '#1e293b', border: 'none', borderRadius: '8px', color: 'white', fontSize: '11px', fontWeight: '700', cursor: 'pointer', fontFamily: 'Sora, sans-serif', display: 'flex', alignItems: 'center', gap: '5px' }}>
                      <Printer size={12} /> Imprimir Lista
                    </button>
                  )}
                </div>
              </div>
              {/* Cabeçalho de impressão — oculto na tela */}
              <div className="print-header-esp" style={{ display: 'none', marginBottom: '16px', borderBottom: '2px solid #000', paddingBottom: '10px' }}>
                <p style={{ fontFamily: 'Arial, sans-serif', fontSize: '13px', fontWeight: '700', margin: '0 0 2px', textTransform: 'uppercase' }}>
                  SECRETARIA MUNICIPAL DE SAÚDE — {clientConfig.municipalityName.toUpperCase()}/{clientConfig.municipalityUF.toUpperCase()}
                </p>
                <p style={{ fontFamily: 'Arial, sans-serif', fontSize: '15px', fontWeight: '800', margin: '6px 0 2px', textTransform: 'uppercase' }}>
                  LISTA DE {esp === 'usg' ? 'EXAMES' : 'CONSULTAS'} — {espAtiva.label.toUpperCase()}
                </p>
                <p style={{ fontFamily: 'Arial, sans-serif', fontSize: '12px', margin: 0, color: '#333' }}>
                  Competência: {MESES[Number(mes) - 1]}/{ano}
                  {escala.length > 0 ? ` · Profissional(is): ${escala.map(e => `${e.profissional_nome}${e.data_atendimento ? ' (' + fmtData(e.data_atendimento) + ')' : ''}`).join(', ')}` : ''}
                </p>
              </div>

              {loading ? (
                <p style={{ color: '#64748b', fontSize: '13px', textAlign: 'center', padding: '24px 0' }}>Carregando...</p>
              ) : agendamentos.filter(a => a.status === 'pendente').length === 0 ? (
                <p style={{ color: '#94a3b8', fontSize: '13px', textAlign: 'center', padding: '32px 0', fontStyle: 'italic' }}>
                  Nenhuma solicitação pendente.
                </p>
              ) : (
                <>
                  <div className="screen-only" style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', minWidth: '700px', borderCollapse: 'collapse', tableLayout: 'fixed', fontFamily: 'Sora, sans-serif', fontSize: '12px' }}>
                      <colgroup>
                        <col style={{ width: '28px' }} />
                        <col style={{ width: '20%' }} />
                        <col style={{ width: '10%' }} />
                        <col style={{ width: '10%' }} />
                        <col style={{ width: '13%' }} />
                        <col style={{ width: '8%' }} />
                        <col style={{ width: '10%' }} />
                        <col style={{ width: '120px' }} />
                      </colgroup>
                      <thead>
                        <tr style={{ borderBottom: '2px solid #e2e8f0' }}>
                          {['#', 'Paciente', 'CPF/CNS', 'Telefone', 'Tipo', 'Data', 'Prioridade', 'Ações'].map(h => (
                            <th key={h} style={{ padding: '7px 8px', textAlign: 'left', fontSize: '10px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {(() => {
                          const sorted = [...agendamentos]
                            .filter(a => a.status === 'pendente')
                            .sort((a, b) => {
                              const d = (a.data_consulta || '').localeCompare(b.data_consulta || '')
                              if (d !== 0) return d
                              return (a.created_at || '').localeCompare(b.created_at || '')
                            })
                          const btn = (onClick, title, bg, borda, cor, label) => (
                            <button onClick={onClick} title={title}
                              style={{ padding: '3px 0', width: '26px', fontSize: '12px', fontWeight: '700', background: bg, border: `1px solid ${borda}`, borderRadius: '5px', color: cor, cursor: 'pointer', textAlign: 'center', lineHeight: 1 }}>
                              {label}
                            </button>
                          )
                          return sorted.map((a, i) => (
                            <tr key={a.id}
                              style={{ borderBottom: '1px solid #f1f5f9', cursor: 'pointer' }}
                              onClick={e => { if (!e.target.closest('button')) setModalVer(a) }}
                              onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                              <td style={{ padding: '8px', color: '#94a3b8', fontSize: '11px' }}>{i + 1}</td>
                              <td style={{ padding: '8px', fontWeight: '700', color: '#0f172a', fontSize: '12px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {a.paciente_nome}
                              </td>
                              <td style={{ padding: '8px', color: '#64748b', fontSize: '11px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.paciente_cns || '—'}</td>
                              <td style={{ padding: '8px', color: '#475569', fontSize: '11px' }}>{a.telefone || '—'}</td>
                              <td style={{ padding: '8px', fontSize: '11px', color: '#0f172a', fontWeight: a.tipo_exame ? '600' : '400', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.tipo_exame || '—'}</td>
                              <td style={{ padding: '8px', color: '#475569', fontSize: '11px', whiteSpace: 'nowrap' }}>{fmtData(a.data_consulta)}</td>
                              <td style={{ padding: '8px', fontSize: '11px' }}>
                                {(() => {
                                  const m = MANCHESTER.find(x => x.valor === a.prioridade)
                                  if (!m) return <span style={{ color: '#cbd5e1' }}>—</span>
                                  return <span style={{ padding: '3px 8px', borderRadius: '12px', background: m.bg, color: m.cor, border: `1px solid ${m.borda}`, fontWeight: '600', whiteSpace: 'nowrap', fontSize: '10px' }}>{m.label}</span>
                                })()}
                              </td>
                              <td style={{ padding: '6px 8px' }}>
                                <div style={{ display: 'flex', gap: '3px', alignItems: 'center', flexWrap: 'nowrap' }}>
                                  {btn(async () => {
                                    // Busca escala sem filtro de mês para pegar entradas futuras
                                    let escalaDisponivel = escala
                                    try {
                                      const res = await fetch(`/api/especialidades/escala?especialidade=${esp}`)
                                      const json = await res.json()
                                      if (json.ok && json.data?.length) {
                                        const hoje = new Date().toISOString().slice(0, 10)
                                        const futuras = json.data.filter(e => e.data_atendimento >= hoje)
                                        escalaDisponivel = futuras.length ? futuras : json.data
                                        setEscala(escalaDisponivel)
                                      }
                                    } catch { }
                                    const periodoInicial = a.periodo || ''
                                    const entradaEscala = periodoInicial
                                      ? escalaDisponivel.find(e => e.periodo === periodoInicial) || escalaDisponivel[0]
                                      : escalaDisponivel[0]
                                    setModalAutorizar(a)
                                    setPeriodoAutorizar(periodoInicial)
                                    setDataAtendimentoAutorizar(entradaEscala?.data_atendimento || '')
                                  }, 'Autorizar', '#dcfce7', '#86efac', '#166534', <Check size={11} />)}
                                  {btn(() => { setModalCancel({ show: true, id: a.id }); setMotivoCancel('') }, 'Negar', '#fee2e2', '#fca5a5', '#991b1b', <X size={11} />)}
                                  {btn(() => { setFormEditar({ paciente_nome: a.paciente_nome || '', paciente_cns: a.paciente_cns || '', telefone: a.telefone || '', sexo: a.sexo || '', data_consulta: a.data_consulta || '', tipo_exame: a.tipo_exame || '', observacao: a.observacao || '', profissional_nome: a.profissional_nome || '', periodo: a.periodo || '', prioridade: a.prioridade || '' }); setModalEditar({ show: true, id: a.id }) }, 'Alterar', '#eff6ff', '#93c5fd', '#1d4ed8', <Pencil size={11} />)}
                                  {btn(() => { setModalExcluir({ show: true, id: a.id }); setMotivoExclusao('') }, 'Excluir', '#f1f5f9', '#cbd5e1', '#64748b', <Trash2 size={11} />)}
                                </div>
                              </td>
                            </tr>
                          ))
                        })()}
                      </tbody>
                    </table>
                  </div>

                  {/* Tabela exclusiva para impressão — Fila de Solicitações (pendentes, por data de solicitação) */}
                  {agendamentos.filter(a => a.status === 'pendente').length > 0 && (() => {
                    const printSorted = [...agendamentos]
                      .filter(a => a.status === 'pendente')
                      .sort((a, b) =>
                        (a.data_consulta || '').localeCompare(b.data_consulta || '') || (a.created_at || '').localeCompare(b.created_at || '')
                      )
                    return (
                      <div className="print-only">
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'Arial, sans-serif', fontSize: '11px' }}>
                          <thead>
                            <tr style={{ borderBottom: '2px solid #000' }}>
                              {['#', 'Paciente', 'CPF/CNS', 'Telefone', 'Tipo', 'Data Solicitação'].map(h => (
                                <th key={h} style={{ padding: '5px 6px', textAlign: 'left', fontSize: '10px', fontWeight: '700', textTransform: 'uppercase' }}>{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {printSorted.map((a, i) => (
                              <tr key={a.id} style={{ borderBottom: '1px solid #ccc' }}>
                                <td style={{ padding: '5px 6px' }}>{i + 1}</td>
                                <td style={{ padding: '5px 6px', fontWeight: '700' }}>{a.paciente_nome}</td>
                                <td style={{ padding: '5px 6px' }}>{a.paciente_cns || '—'}</td>
                                <td style={{ padding: '5px 6px' }}>{a.telefone || '—'}</td>
                                <td style={{ padding: '5px 6px' }}>{a.tipo_exame || '—'}</td>
                                <td style={{ padding: '5px 6px', whiteSpace: 'nowrap' }}>{fmtData(a.data_consulta)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )
                  })()}
                </>
              )}
            </div>
          </>
        )}

        {/* ── ABA: RELATÓRIO ── */}
        {abaMain === 'relatorio' && (() => {
          // Filtros aplicados antes de filtrar por tipo de USG, para gerar o resumo total por tipo correto
          const detalhesSemTipoUsg = relDetalhes.filter(r => {
            if (!relFiltroStatus && r.status === 'pendente') return false
            if (relFiltroEsp && r.especialidade !== relFiltroEsp) return false
            if (relFiltroStatus && r.status !== relFiltroStatus) return false
            if (relFiltroProf && !r.profissional_nome?.toLowerCase().includes(relFiltroProf.toLowerCase())) return false
            if (relFiltroPaciente && !r.paciente_nome?.toLowerCase().includes(relFiltroPaciente.toLowerCase())) return false
            return true
          })

          const detalhesFiltrados = detalhesSemTipoUsg.filter(r => {
            if (relFiltroEsp === 'usg' && relFiltroTipoUsg && r.tipo_exame !== relFiltroTipoUsg) return false
            return true
          })

          // Gera resumo de USG por tipo
          const usgBreakdown = {}
          if (relFiltroEsp === 'usg') {
            tiposUsg.forEach(tipo => {
              usgBreakdown[tipo] = { label: tipo, pendente: 0, autorizado: 0, negado: 0, excluido: 0, total: 0 }
            })
            detalhesSemTipoUsg.forEach(r => {
              const tipo = r.tipo_exame || 'NÃO ESPECIFICADO'
              if (!usgBreakdown[tipo]) {
                usgBreakdown[tipo] = { label: tipo, pendente: 0, autorizado: 0, negado: 0, excluido: 0, total: 0 }
              }
              if (r.status in usgBreakdown[tipo]) {
                usgBreakdown[tipo][r.status]++
              }
              usgBreakdown[tipo].total++
            })
          }
          const usgList = Object.values(usgBreakdown).filter(x => x.total > 0 || tiposUsg.includes(x.label))

          return (
            <div>
              {/* Filtros */}
              <div className="card no-print" style={{ padding: '16px 20px', marginBottom: '16px' }}>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                  {/* Toggle Mês / Período */}
                  <div>
                    <label className="label-modern">Busca por</label>
                    <div style={{ display: 'flex', borderRadius: '8px', overflow: 'hidden', border: '1px solid #cbd5e1' }}>
                      {[['mes', 'Mês'], ['periodo', 'Período']].map(([val, label]) => (
                        <button key={val} onClick={() => setRelModoFiltro(val)}
                          style={{ padding: '6px 14px', fontSize: '11px', fontWeight: '700', fontFamily: 'Sora, sans-serif', cursor: 'pointer', border: 'none', background: relModoFiltro === val ? '#1e293b' : '#f8fafc', color: relModoFiltro === val ? '#fff' : '#64748b', transition: 'all .15s' }}>
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                  {relModoFiltro === 'mes' ? (
                    <>
                      <div>
                        <label className="label-modern">Mês</label>
                        <select className="input-modern" value={relMes} onChange={e => setRelMes(e.target.value)} style={{ width: '140px' }}>
                          {MESES.map((n, i) => <option key={i} value={String(i + 1).padStart(2, '0')}>{String(i + 1).padStart(2, '0')} — {n}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="label-modern">Ano</label>
                        <input className="input-modern" type="number" value={relAno} onChange={e => setRelAno(e.target.value)} min="2020" max="2099" style={{ width: '90px' }} />
                      </div>
                    </>
                  ) : (
                    <>
                      <div>
                        <label className="label-modern">De</label>
                        <input className="input-modern" type="date" value={relDataInicio} onChange={e => setRelDataInicio(e.target.value)} style={{ width: '145px' }} />
                      </div>
                      <div>
                        <label className="label-modern">Até</label>
                        <input className="input-modern" type="date" value={relDataFim} onChange={e => setRelDataFim(e.target.value)} style={{ width: '145px' }} />
                      </div>
                    </>
                  )}
                  <div>
                    <label className="label-modern">Paciente</label>
                    <input className="input-modern" type="text" placeholder="Buscar por nome..." value={relFiltroPaciente} onChange={e => setRelFiltroPaciente(e.target.value)} style={{ width: '180px' }} />
                  </div>
                  <div>
                    <label className="label-modern">Especialidade</label>
                    <select className="input-modern" value={relFiltroEsp} onChange={e => { setRelFiltroEsp(e.target.value); setRelFiltroTipoUsg(''); }} style={{ width: '160px' }}>
                      <option value="">Todas</option>
                      {especialidades.map(e => <option key={e.id} value={e.id}>{e.label}</option>)}
                    </select>
                  </div>
                  {relFiltroEsp === 'usg' && (
                    <div>
                      <label className="label-modern">Tipo de Ultrassom</label>
                      <select className="input-modern" value={relFiltroTipoUsg} onChange={e => setRelFiltroTipoUsg(e.target.value)} style={{ width: '160px' }}>
                        <option value="">Todos</option>
                        {tiposUsg.map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </div>
                  )}
                  <div>
                    <label className="label-modern">Status</label>
                    <select className="input-modern" value={relFiltroStatus} onChange={e => setRelFiltroStatus(e.target.value)} style={{ width: '140px' }}>
                      <option value="">Todos</option>
                      {Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="label-modern">Profissional</label>
                    <input className="input-modern" type="text" placeholder="Filtrar..." value={relFiltroProf} onChange={e => setRelFiltroProf(e.target.value)} style={{ width: '160px' }} />
                  </div>
                  <button className="btn-primary" style={{ background: GRAD, display: 'flex', alignItems: 'center', gap: '5px' }} onClick={buscarRelatorio}><RefreshCw size={13} /> Atualizar</button>
                  <button className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '5px' }} onClick={() => {
                    const espL = relFiltroEsp ? especialidades.find(e => e.id === relFiltroEsp)?.label : ''
                    const periodoLabel = relModoFiltro === 'periodo' ? `${relDataInicio} a ${relDataFim}` : MESES[Number(relMes) - 1]
                    const anoLabel = relModoFiltro === 'periodo' ? '' : relAno
                    imprimirRelatorio(detalhesFiltrados, periodoLabel, anoLabel, espL, periodos, relFiltroStatus, tiposUsgOrdem)
                  }}><Printer size={13} /> Imprimir Lista</button>
                </div>
              </div>

              <div className="card print-area" style={{ padding: '20px', marginBottom: '16px' }}>
                {/* Cabeçalho impressão */}
                <div className="print-title" style={{ display: 'none', marginBottom: '16px', borderBottom: '2px solid #000', paddingBottom: '10px' }}>
                  <p style={{ fontFamily: 'Arial', fontSize: '13px', fontWeight: '700', margin: '0 0 2px', textTransform: 'uppercase' }}>SECRETARIA MUNICIPAL DE SAÚDE — {clientConfig.municipalityName.toUpperCase()}/{clientConfig.municipalityUF.toUpperCase()}</p>
                  <p style={{ fontFamily: 'Arial', fontSize: '15px', fontWeight: '800', margin: '6px 0 2px' }}>RELATÓRIO DE ESPECIALIDADES</p>
                  <p style={{ fontFamily: 'Arial', fontSize: '12px', margin: 0, color: '#333' }}>
                    {relModoFiltro === 'periodo' ? `Período: ${relDataInicio} a ${relDataFim}` : `Competência: ${MESES[Number(relMes) - 1]}/${relAno}`}
                    {relFiltroEsp ? ` · ${especialidades.find(e => e.id === relFiltroEsp)?.label}` : ''}
                    {relFiltroEsp === 'usg' && relFiltroTipoUsg ? ` · ${relFiltroTipoUsg}` : ''}
                    {relFiltroStatus ? ` · ${STATUS_LABEL[relFiltroStatus]}` : ''}
                  </p>
                </div>

                <h3 style={{ fontFamily: 'Sora, sans-serif', fontSize: '14px', fontWeight: '700', color: '#0f172a', margin: '0 0 14px' }}>
                  Resumo — {relModoFiltro === 'periodo' ? `${relDataInicio} a ${relDataFim}` : `${MESES[Number(relMes) - 1]}/${relAno}`}
                </h3>
                {relLoading ? (
                  <p style={{ color: '#64748b', fontSize: '13px', textAlign: 'center', padding: '24px 0' }}>Carregando...</p>
                ) : (
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', marginBottom: '28px' }}>
                    <thead>
                      <tr style={{ background: GRAD, WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}>
                        {['Especialidade', 'Cota', 'Pendente', 'Autorizado', 'Negado', 'Excluído', 'Usados', '% Cota'].map(h => (
                          <th key={h} style={{ padding: '9px 12px', color: 'white', textAlign: 'left', fontFamily: 'Sora, sans-serif', fontSize: '11px', fontWeight: '700', letterSpacing: '0.05em' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {relatorio.filter(r => !relFiltroEsp || especialidades.find(e => e.id === relFiltroEsp)?.label === r.label).map((r, i) => {
                        const total = r.autorizado
                        const pct2 = Math.round((total / r.cota) * 100)
                        return (
                          <tr key={i} style={{ borderBottom: '1px solid #e2e8f0', background: i % 2 === 0 ? '#fff' : '#f8fafc', WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}>
                            <td style={{ padding: '9px 12px', fontWeight: '700', color: '#0f172a' }}>{r.icon} {r.label}</td>
                            <td style={{ padding: '9px 12px', color: '#475569', fontWeight: '600' }}>{r.cota}</td>
                            {['pendente', 'autorizado', 'negado', 'excluido'].map(s => (
                              <td key={s} style={{ padding: '9px 12px' }}>
                                <span style={{ background: STATUS_STYLE[s].bg, color: STATUS_STYLE[s].cor, padding: '2px 8px', borderRadius: '12px', fontSize: '12px', fontWeight: '700' }}>{r[s] || 0}</span>
                              </td>
                            ))}
                            <td style={{ padding: '9px 12px', fontWeight: '700', color: total >= r.cota ? '#dc2626' : '#0f172a' }}>{total}</td>
                            <td style={{ padding: '9px 12px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <div style={{ background: '#e2e8f0', borderRadius: '999px', height: '6px', width: '70px', overflow: 'hidden' }}>
                                  <div style={{ width: Math.min(100, pct2) + '%', height: '100%', borderRadius: '999px', background: pct2 >= 100 ? '#dc2626' : pct2 >= 80 ? '#f59e0b' : '#16a34a' }} />
                                </div>
                                <span style={{ fontSize: '12px', fontWeight: '700', color: pct2 >= 100 ? '#dc2626' : '#475569' }}>{pct2}%</span>
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                )}

                {/* Resumo de Ultrassons por Tipo */}
                {!relLoading && relFiltroEsp === 'usg' && (
                  <div style={{ marginBottom: '28px' }}>
                    <h3 style={{ fontFamily: 'Sora, sans-serif', fontSize: '14px', fontWeight: '700', color: '#0f172a', margin: '0 0 14px' }}>
                      Resumo de Ultrassons por Tipo
                    </h3>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                      <thead>
                        <tr style={{ background: GRAD, WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}>
                          {['Tipo de Ultrassom', 'Pendente', 'Autorizado', 'Negado', 'Excluído', 'Total'].map(h => (
                            <th key={h} style={{ padding: '9px 12px', color: 'white', textAlign: 'left', fontFamily: 'Sora, sans-serif', fontSize: '11px', fontWeight: '700', letterSpacing: '0.05em' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {usgList.map((r, i) => (
                          <tr key={i} style={{ borderBottom: '1px solid #e2e8f0', background: i % 2 === 0 ? '#fff' : '#f8fafc', WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}>
                            <td style={{ padding: '9px 12px', fontWeight: '700', color: '#0f172a' }}>{r.label}</td>
                            {['pendente', 'autorizado', 'negado', 'excluido'].map(s => (
                              <td key={s} style={{ padding: '9px 12px' }}>
                                <span style={{ background: STATUS_STYLE[s].bg, color: STATUS_STYLE[s].cor, padding: '2px 8px', borderRadius: '12px', fontSize: '12px', fontWeight: '700' }}>{r[s] || 0}</span>
                              </td>
                            ))}
                            <td style={{ padding: '9px 12px', fontWeight: '700', color: '#0f172a' }}>{r.total}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Tabela detalhada */}
                {detalhesFiltrados.length > 0 && (
                  <>
                    <h3 style={{ fontFamily: 'Sora, sans-serif', fontSize: '14px', fontWeight: '700', color: '#0f172a', margin: '0 0 12px', borderTop: '1px solid #e2e8f0', paddingTop: '16px' }}>
                      Detalhamento — {detalhesFiltrados.length} registro{detalhesFiltrados.length !== 1 ? 's' : ''}
                    </h3>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', tableLayout: 'fixed' }}>
                      <colgroup>
                        <col style={{ width: '32px' }} />
                        {!relFiltroEsp && <col style={{ width: '96px' }} />}
                        <col />
                        <col style={{ width: '90px' }} />
                        <col style={{ width: '100px' }} />
                        <col style={{ width: '70px' }} />
                        <col style={{ width: '100px' }} />
                        <col style={{ width: '100px' }} />
                        <col style={{ width: '80px' }} />
                        <col style={{ width: '84px' }} />
                        <col style={{ width: '90px' }} />
                        <col style={{ width: '92px' }} />
                      </colgroup>
                      <thead>
                        <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                          {['#', ...(!relFiltroEsp ? ['Especialidade'] : []), 'Paciente', 'Telefone', 'Tipo', 'Data', 'Período', 'Profissional', 'Prioridade', 'Status', 'Operador', 'Ações'].map(h => (
                            <th key={h} style={{ padding: '7px 8px', textAlign: 'left', fontFamily: 'Sora, sans-serif', fontSize: '10px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap', overflow: 'hidden' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {detalhesFiltrados.map((r, i) => {
                          const st = STATUS_STYLE[r.status] || STATUS_STYLE.pendente
                          const esp2 = especialidades.find(e => e.id === r.especialidade)
                          const motivo = r.status === 'negado' ? r.motivo_cancelamento : r.status === 'excluido' ? r.motivo_exclusao : null
                          const trunc = { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }
                          const btn2 = (onClick, title, bg, borda, cor, label) => (
                            <button onClick={onClick} title={title}
                              style={{ padding: '3px 0', width: '26px', fontSize: '12px', fontWeight: '700', background: bg, border: `1px solid ${borda}`, borderRadius: '5px', color: cor, cursor: 'pointer', textAlign: 'center', lineHeight: 1, flexShrink: 0 }}>
                              {label}
                            </button>
                          )
                          return (
                            <tr key={r.id}
                              style={{ borderBottom: '1px solid #f1f5f9', background: r.status === 'excluido' ? '#f8fafc' : 'white', cursor: r.status !== 'excluido' ? 'pointer' : 'default' }}
                              onClick={e => { if (r.status === 'excluido' || e.target.closest('button')) return; setFormEditar({ paciente_nome: r.paciente_nome || '', paciente_cns: r.paciente_cns || '', telefone: r.telefone || '', sexo: r.sexo || '', data_consulta: r.data_consulta || '', tipo_exame: r.tipo_exame || '', observacao: r.observacao || '', profissional_nome: r.profissional_nome || '', periodo: r.periodo || '', prioridade: r.prioridade || '' }); setModalEditar({ show: true, id: r.id }) }}
                              onMouseEnter={e => { if (r.status !== 'excluido') e.currentTarget.style.background = '#f8fafc' }}
                              onMouseLeave={e => { e.currentTarget.style.background = r.status === 'excluido' ? '#f8fafc' : 'white' }}>
                              <td style={{ padding: '7px 8px', color: '#94a3b8', fontSize: '11px' }}>{i + 1}</td>
                              {!relFiltroEsp && <td style={{ padding: '7px 8px', fontSize: '11px', ...trunc }} title={esp2?.label}>{esp2?.icon} {esp2?.label}</td>}
                              <td style={{ padding: '7px 8px', fontWeight: '600', color: '#0f172a', ...trunc }} title={r.paciente_nome}>{r.paciente_nome}</td>
                              <td style={{ padding: '7px 8px', color: '#64748b', fontSize: '11px', ...trunc }}>{r.telefone || '—'}</td>
                              <td style={{ padding: '7px 8px', fontSize: '11px', ...trunc }} title={r.tipo_exame}>{r.tipo_exame || '—'}</td>
                              <td style={{ padding: '7px 8px', color: '#475569', fontSize: '11px', whiteSpace: 'nowrap' }}>{fmtData(r.data_atendimento || r.data_consulta)}</td>
                              <td style={{ padding: '7px 8px', fontSize: '11px' }}>
                                {r.periodo ? <span style={{ background: '#e0f2fe', color: '#0369a1', padding: '1px 6px', borderRadius: '10px', fontWeight: '600', fontSize: '10px', whiteSpace: 'nowrap' }}>{r.periodo}</span> : <span style={{ color: '#cbd5e1' }}>—</span>}
                              </td>
                              <td style={{ padding: '7px 8px', fontSize: '11px', ...trunc }} title={r.profissional_nome}>{r.profissional_nome || '—'}</td>
                              <td style={{ padding: '7px 8px', fontSize: '11px' }}>
                                {(() => {
                                  const m = MANCHESTER.find(x => x.valor === r.prioridade)
                                  if (!m) return <span style={{ color: '#cbd5e1' }}>—</span>
                                  return <span style={{ padding: '2px 6px', borderRadius: '12px', background: m.bg, color: m.cor, border: `1px solid ${m.borda}`, fontWeight: '600', whiteSpace: 'nowrap', fontSize: '9px' }}>{m.label}</span>
                                })()}
                              </td>
                              <td style={{ padding: '7px 8px' }}>
                                <span title={motivo || ''} style={{ fontSize: '10px', fontWeight: '700', padding: '2px 6px', borderRadius: '12px', background: st.bg, color: st.cor, border: `1px solid ${st.borda}`, whiteSpace: 'nowrap', cursor: motivo ? 'help' : 'default' }}>
                                  {STATUS_LABEL[r.status]}{motivo ? ' *' : ''}
                                </span>
                              </td>
                              <td style={{ padding: '7px 8px', fontSize: '11px', color: '#475569', ...trunc }} title={r.status === 'autorizado' ? (r.autorizado_por || '') : (r.criado_por || '')}>
                                {r.status === 'autorizado' ? (r.autorizado_por || <span style={{ color: '#cbd5e1' }}>—</span>) : (r.criado_por || <span style={{ color: '#cbd5e1' }}>—</span>)}
                              </td>
                              <td style={{ padding: '5px 8px' }}>
                                <div style={{ display: 'flex', gap: '3px', alignItems: 'center' }}>
                                  {r.status !== 'excluido' && btn2(() => voltarPendente(r.id).then(() => buscarRelatorio()), 'Voltar para pendente', '#fef9c3', '#fde047', '#854d0e', '↩')}
                                  {r.status === 'autorizado' && btn2(() => imprimirComprovanteComDados(r, esp2?.label || r.especialidade), 'Imprimir comprovante', '#eff6ff', '#93c5fd', '#1d4ed8', <Printer size={11} />)}
                                  {r.status !== 'excluido' && btn2(() => { setModalExcluir({ show: true, id: r.id }); setMotivoExclusao('') }, 'Excluir', '#f1f5f9', '#cbd5e1', '#64748b', <Trash2 size={11} />)}
                                </div>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </>
                )}
              </div>
              <style dangerouslySetInnerHTML={{
                __html: `
              @media print {
                body * { visibility: hidden; }
                .print-area, .print-area * { visibility: visible; }
                .print-area { position: absolute; left: 0; top: 0; width: 100%; padding: 0 !important; border: none !important; box-shadow: none !important; }
                .print-title { display: block !important; }
                .no-print { display: none !important; }
              }
            `}} />
            </div>
          )
        })()}

        {abaMain === 'relatorio_sisreg' && (
          <div>
            {/* Filtros */}
            <div className="card no-print" style={{ padding: '16px 20px', marginBottom: '16px' }}>
              <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                <div>
                  <label className="label-modern" style={{ fontSize: '11px', fontWeight: '700', color: '#475569', marginBottom: '4px', display: 'block' }}>Período de Solicitação</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <input className="input-modern" type="date" value={sisregFiltroDataInicio} onChange={e => setSisregFiltroDataInicio(e.target.value)} style={{ width: '130px', fontSize: '12px', padding: '6px 8px' }} />
                    <span style={{ fontSize: '12px', color: '#64748b' }}>até</span>
                    <input className="input-modern" type="date" value={sisregFiltroDataFim} onChange={e => setSisregFiltroDataFim(e.target.value)} style={{ width: '130px', fontSize: '12px', padding: '6px 8px' }} />
                  </div>
                </div>
                
                <div>
                  <label className="label-modern" style={{ fontSize: '11px', fontWeight: '700', color: '#475569', marginBottom: '4px', display: 'block' }}>Especialidade (Filtro Rápido)</label>
                  <select className="input-modern" value={sisregFiltroEsp} onChange={e => setSisregFiltroEsp(e.target.value)} style={{ width: '160px', fontSize: '12px', padding: '6px 8px' }}>
                    <option value="">Todas</option>
                    {especialidades.map(e => <option key={e.id} value={e.id}>{e.label}</option>)}
                  </select>
                </div>

                <div>
                  <label className="label-modern" style={{ fontSize: '11px', fontWeight: '700', color: '#475569', marginBottom: '4px', display: 'block' }}>Procedimento (Busca Textual)</label>
                  <input className="input-modern" type="text" placeholder="Ex: UROLOGIA" value={sisregFiltroProc} onChange={e => setSisregFiltroProc(e.target.value.toUpperCase())} style={{ width: '180px', fontSize: '12px', padding: '6px 8px' }} />
                </div>

                <div>
                  <label className="label-modern" style={{ fontSize: '11px', fontWeight: '700', color: '#475569', marginBottom: '4px', display: 'block' }}>Situação</label>
                  <select className="input-modern" value={sisregFiltroStatus} onChange={e => setSisregFiltroStatus(e.target.value)} style={{ width: '180px', fontSize: '12px', padding: '6px 8px' }}>
                    <option value="">Todas</option>
                    <option value="SOLICITAÇÃO / PENDENTE / REGULADOR">Pendente Regulação</option>
                    <option value="SOLICITAÇÃO / AGENDADA / SOLICITANTE">Agendada</option>
                    <option value="SOLICITAÇÃO / AUTORIZADA / REGULADOR">Autorizada</option>
                    <option value="SOLICITAÇÃO / NEGADA / REGULADOR">Negada</option>
                    <option value="SOLICITAÇÃO / CANCELADA">Cancelada (Solicitação)</option>
                    <option value="AGENDAMENTO / CONFIRMADO / EXECUTANTE">Confirmada (Agendamento)</option>
                    <option value="AGENDAMENTO / CANCELADO">Cancelado (Agendamento)</option>
                    <option value="AGENDAMENTO / FALTA / EXECUTANTE">Falta</option>
                  </select>
                </div>

                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  <button className="btn-primary" style={{ background: GRAD, display: 'flex', alignItems: 'center', gap: '5px', padding: '8px 12px', fontSize: '12px', fontWeight: '700' }} onClick={buscarRelatorioSisreg} disabled={sisregLoading}>
                    <RefreshCw size={13} className={sisregLoading ? 'animate-spin' : ''} /> {sisregLoading ? 'Carregando...' : 'Filtrar'}
                  </button>
                  
                  <button className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '8px 12px', fontSize: '12px', fontWeight: '700' }} onClick={() => {
                    const labelPeriodo = `${fmtData(sisregFiltroDataInicio)} a ${fmtData(sisregFiltroDataFim)}`
                    const espL = sisregFiltroEsp ? especialidades.find(e => e.id === sisregFiltroEsp)?.label : (sisregFiltroProc || '')
                    const statusL = sisregFiltroStatus ? abbreviateStatus(sisregFiltroStatus) : ''
                    imprimirRelatorioSisreg(sisregDados, labelPeriodo, espL, statusL)
                  }} disabled={sisregDados.length === 0}>
                    <Printer size={13} /> Imprimir PDF
                  </button>

                  <button className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '8px 12px', fontSize: '12px', fontWeight: '700' }} onClick={() => exportarCsvSisreg(sisregDados)} disabled={sisregDados.length === 0}>
                    <Save size={13} /> Exportar CSV
                  </button>

                  <button className="btn-primary" style={{ background: 'linear-gradient(135deg, #10b981, #059669)', border: 'none', display: 'flex', alignItems: 'center', gap: '5px', padding: '8px 12px', fontSize: '12px', fontWeight: '700' }} onClick={sincronizarSisreg} disabled={sisregSincronizando}>
                    <RefreshCw size={13} className={sisregSincronizando ? 'animate-spin' : ''} /> {sisregSincronizando ? 'Sincronizando...' : 'Sincronizar SISREG'}
                  </button>
                </div>
              </div>
            </div>

            {/* Tabela de Resultados */}
            <div className="card" style={{ padding: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                <h3 style={{ fontFamily: 'Sora, sans-serif', fontSize: '15px', fontWeight: '700', color: '#0f172a', margin: 0 }}>
                  Solicitações Monitoradas no SISREG ({sisregDados.length})
                </h3>
              </div>

              {sisregLoading ? (
                <div style={{ textAlign: 'center', padding: '40px 0', color: '#64748b' }}>
                  <RefreshCw size={24} className="animate-spin" style={{ margin: '0 auto 10px' }} />
                  Carregando registros do banco...
                </div>
              ) : sisregDados.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 0', color: '#94a3b8', fontSize: '13px' }}>
                  Nenhuma solicitação encontrada para os filtros selecionados.
                </div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                    <thead>
                      <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                        <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: '700', color: '#475569', width: '5%' }}>Nº</th>
                        <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: '700', color: '#475569', width: '14%' }}>Cód. Solicitação</th>
                        <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: '700', color: '#475569', width: '12%' }}>Data Solic.</th>
                        <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: '700', color: '#475569', width: '22%' }}>Paciente</th>
                        <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: '700', color: '#475569', width: '14%' }}>CPF/CNS</th>
                        <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: '700', color: '#475569', width: '23%' }}>Procedimento</th>
                        <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: '700', color: '#475569', width: '10%' }}>Situação</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sisregDados.map((r, i) => {
                        const dataFmt = r.data_solicitacao ? r.data_solicitacao.slice(0, 10).split('-').reverse().join('/') : '—'
                        const cnsCpf = r.cpf_usuario || r.cns_usuario || '—'
                        const situacaoAbreviada = abbreviateStatus(r.status_solicitacao)
                        
                        return (
                          <tr key={r.codigo_solicitacao} style={{ borderBottom: '1px solid #e2e8f0', background: i % 2 === 0 ? '#fff' : '#f8fafc' }}>
                            <td style={{ padding: '10px 12px', color: '#64748b' }}>{i + 1}</td>
                            <td style={{ padding: '10px 12px', fontWeight: '700', color: '#0f172a' }}>{r.codigo_solicitacao}</td>
                            <td style={{ padding: '10px 12px', color: '#334155' }}>{dataFmt}</td>
                            <td style={{ padding: '10px 12px', fontWeight: '600', color: '#0f172a', textTransform: 'uppercase' }}>{r.no_usuario}</td>
                            <td style={{ padding: '10px 12px', color: '#475569', fontFamily: 'monospace' }}>{cnsCpf}</td>
                            <td style={{ padding: '10px 12px', color: '#334155', textTransform: 'uppercase', fontSize: '12px' }}>{r.descricao_interna_procedimento}</td>
                            <td style={{ padding: '10px 12px' }}>
                              <span style={{ 
                                background: r.status_solicitacao?.includes('PENDENTE') ? '#fef9c3' : r.status_solicitacao?.includes('CONFIRMADO') || r.status_solicitacao?.includes('AUTORIZADA') || r.status_solicitacao?.includes('AGENDADA') ? '#dcfce7' : '#fee2e2',
                                color: r.status_solicitacao?.includes('PENDENTE') ? '#854d0e' : r.status_solicitacao?.includes('CONFIRMADO') || r.status_solicitacao?.includes('AUTORIZADA') || r.status_solicitacao?.includes('AGENDADA') ? '#166534' : '#991b1b',
                                padding: '2px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: '700' 
                              }}>
                                {situacaoAbreviada}
                              </span>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

      {/* ── MODAL: CANCELAMENTO ── */}
      <AnimatePresence>
      {modalCancel.show && (
        <Modal titulo="Cancelar / Negar Agendamento" onClose={() => { setModalCancel({ show: false, id: null }); setMotivoCancel('') }}>
          <p style={{ fontSize: '13px', color: '#64748b', margin: '0 0 14px' }}>
            Informe o motivo do cancelamento. Este campo é <strong>obrigatório</strong>.
          </p>
          <label className="label-modern">Motivo *</label>
          <textarea className="input-modern" rows={3} placeholder="Ex: Paciente desistiu, sem vaga na referência, duplicidade..."
            value={motivoCancel}
            onChange={e => setMotivoCancel(e.target.value.toUpperCase())}
            style={{ width: '100%', resize: 'vertical', minHeight: '80px' }} />
          <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
            <button className="btn-primary"
              style={{ background: 'linear-gradient(135deg, #991b1b, #dc2626)' }}
              onClick={confirmarCancelamento}
              disabled={!motivoCancel.trim()}>
              ✗ Confirmar Cancelamento
            </button>
            <button className="btn-secondary" onClick={() => { setModalCancel({ show: false, id: null }); setMotivoCancel('') }}>Voltar</button>
          </div>
        </Modal>
      )}
      </AnimatePresence>

      <AnimatePresence>
      {/* ── MODAL: EDIÇÃO ── */}
      {modalEditar.show && (() => {
        const registroEditar = agendamentos.find(a => a.id === modalEditar.id) || relDetalhes.find(r => r.id === modalEditar.id)
        const espId = registroEditar?.especialidade
        const isUsgEdit = espId === 'usg'
        return (
          <Modal titulo="Alterar Agendamento" onClose={() => setModalEditar({ show: false, id: null })} largura="560px">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div style={{ gridColumn: '1 / -1' }}>
                <label className="label-modern">Nome do Paciente *</label>
                <input className="input-modern" type="text" value={formEditar.paciente_nome}
                  onChange={e => setFormEditar(f => ({ ...f, paciente_nome: e.target.value }))} style={{ width: '100%' }} />
              </div>
              <div>
                <label className="label-modern">CNS / CPF</label>
                <input className="input-modern" type="text" value={formEditar.paciente_cns}
                  onChange={e => setFormEditar(f => ({ ...f, paciente_cns: e.target.value }))} style={{ width: '100%' }} />
              </div>
              <div>
                <label className="label-modern">Telefone *</label>
                <input className="input-modern" type="tel" value={formEditar.telefone}
                  onChange={e => setFormEditar(f => ({ ...f, telefone: fmtTelefone(e.target.value) }))} style={{ width: '100%' }} />
              </div>
              <div>
                <label className="label-modern">Sexo</label>
                <select className="input-modern" value={
                  ['M', 'MASCULINO', 'Masculino', 'm'].includes(formEditar.sexo) ? 'M' : 
                  ['F', 'FEMININO', 'Feminino', 'f'].includes(formEditar.sexo) ? 'F' : ''
                } onChange={e => setFormEditar(f => ({ ...f, sexo: e.target.value, tipo_exame: '' }))} style={{ width: '100%' }}>
                  <option value="">— Não informado —</option>
                  <option value="M">Masculino</option>
                  <option value="F">Feminino</option>
                </select>
              </div>
              <div>
                <label className="label-modern">Data de Solicitação *</label>
                <input className="input-modern" type="date" value={formEditar.data_consulta}
                  onChange={e => setFormEditar(f => ({ ...f, data_consulta: e.target.value }))} style={{ width: '100%' }} />
              </div>
              {isUsgEdit && (
                <div style={{ gridColumn: '1 / -1' }}>
                  <label className="label-modern">Tipo de Exame</label>
                  <select className="input-modern" value={formEditar.tipo_exame} onChange={e => setFormEditar(f => ({ ...f, tipo_exame: e.target.value }))} style={{ width: '100%' }}>
                    <option value="">— Selecione —</option>
                    {tiposUsg.filter(t => {
                      if (formEditar.sexo === 'M' && t === 'TRANSVAGINAL') return false
                      if (formEditar.sexo === 'F' && (t === 'PRÓSTATA TRANSRETAL' || t === 'PRÓSTATA ABDOMINAL' || t === 'BOLSA ESCROTAL')) return false
                      return true
                    }).map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
              )}
              {!isUsgEdit && (
                <div>
                  <label className="label-modern">Tipo de Consulta</label>
                  <select className="input-modern" value={formEditar.tipo_exame} onChange={e => setFormEditar(f => ({ ...f, tipo_exame: e.target.value }))} style={{ width: '100%' }}>
                    <option value="">— Selecione —</option>
                    {TIPOS_CONSULTA.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
              )}
              <div>
                <label className="label-modern">Profissional</label>
                <input className="input-modern" type="text" value={formEditar.profissional_nome}
                  onChange={e => setFormEditar(f => ({ ...f, profissional_nome: e.target.value }))} style={{ width: '100%' }} />
              </div>
              {registroEditar?.status === 'autorizado' && (
                <div>
                  <label className="label-modern">Período</label>
                  <select className="input-modern" value={formEditar.periodo} onChange={e => setFormEditar(f => ({ ...f, periodo: e.target.value }))} style={{ width: '100%' }}>
                    <option value="">— Nenhum —</option>
                    {periodos.filter(p => p.ativo).map(p => (
                      <option key={p.id} value={p.nome}>{p.nome}{p.horario ? ` (${p.horario})` : ''}</option>
                    ))}
                  </select>
                </div>
              )}
              <div style={{ gridColumn: '1 / -1' }}>
                <label className="label-modern">Prioridade (Escala de Manchester)</label>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '4px' }}>
                  {MANCHESTER.map(m => (
                    <button key={m.valor} type="button"
                      onClick={() => setFormEditar(f => ({ ...f, prioridade: f.prioridade === m.valor ? '' : m.valor }))}
                      style={{
                        padding: '5px 12px', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: '600',
                        border: `2px solid ${formEditar.prioridade === m.valor ? m.borda : '#e2e8f0'}`,
                        background: formEditar.prioridade === m.valor ? m.bg : '#f8fafc',
                        color: formEditar.prioridade === m.valor ? m.cor : '#64748b',
                        transition: 'all 0.15s',
                      }}>
                      {m.label} <span style={{ fontWeight: '400', fontSize: '10px' }}>— {m.desc}</span>
                    </button>
                  ))}
                  {formEditar.prioridade && (
                    <button type="button" onClick={() => setFormEditar(f => ({ ...f, prioridade: '' }))}
                      style={{ padding: '5px 10px', borderRadius: '8px', cursor: 'pointer', fontSize: '11px', fontWeight: '500', border: '1px solid #e2e8f0', background: '#f1f5f9', color: '#64748b' }}>
                      Limpar
                    </button>
                  )}
                </div>
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label className="label-modern">Observação</label>
                <textarea className="input-modern" rows={2} value={formEditar.observacao}
                  onChange={e => setFormEditar(f => ({ ...f, observacao: e.target.value }))}
                  style={{ width: '100%', resize: 'vertical' }} />
              </div>
              {registroEditar?.criado_por && (
                <div style={{ gridColumn: '1 / -1', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '8px 12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '11px', color: '#64748b', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Cadastrado por:</span>
                  <span style={{ fontSize: '12px', color: '#0f172a', fontWeight: '700' }}>{registroEditar.criado_por}</span>
                </div>
              )}
            </div>
            <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
              <button className="btn-primary" style={{ background: 'linear-gradient(135deg, #1d4ed8, #2563eb)', display: 'flex', alignItems: 'center', gap: '6px' }} onClick={salvarEdicao}>
                <Save size={14} /> Salvar Alterações
              </button>
              <button className="btn-secondary" onClick={() => setModalEditar({ show: false, id: null })}>Cancelar</button>
            </div>
          </Modal>
        )
      })()}
      </AnimatePresence>

      <AnimatePresence>
      {/* ── MODAL: EXCLUSÃO ── */}
      {modalExcluir.show && (
        <Modal titulo="Excluir Agendamento" onClose={() => { setModalExcluir({ show: false, id: null }); setMotivoExclusao('') }}>
          <p style={{ fontSize: '13px', color: '#64748b', margin: '0 0 14px' }}>
            Informe o motivo da exclusão. Este campo é <strong>obrigatório</strong>.
          </p>
          <label className="label-modern">Motivo *</label>
          <textarea className="input-modern" rows={3} placeholder="Ex: Cadastro duplicado, erro de digitação..."
            value={motivoExclusao}
            onChange={e => setMotivoExclusao(e.target.value.toUpperCase())}
            style={{ width: '100%', resize: 'vertical', minHeight: '80px' }} />
          <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
            <button className="btn-primary"
              style={{ background: 'linear-gradient(135deg, #374151, #4b5563)' }}
              onClick={confirmarExclusao}
              disabled={!motivoExclusao.trim()}>
              <Trash2 size={14} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '5px' }} />Confirmar Exclusão
            </button>
            <button className="btn-secondary" onClick={() => { setModalExcluir({ show: false, id: null }); setMotivoExclusao('') }}>Cancelar</button>
          </div>
        </Modal>
      )}

      {/* ── MODAL: AUTORIZAÇÃO ── */}
      {modalAutorizar && (() => {
        const exigeJejum = EXAMES_JEJUM.includes(modalAutorizar.tipo_exame)
        const periodosDisponiveis = periodos.filter(p => {
          if (!p.ativo) return false
          if (exigeJejum && p.nome.toLowerCase().includes('tarde')) return false
          return true
        })
        const escalaFiltrada = exigeJejum
          ? escala.filter(e => !(e.periodo && String(e.periodo).toLowerCase().includes('tarde')))
          : escala
        const datasEscala = Array.from(new Set(escala.map(item => item.data_atendimento)))
        const diasEscalaCount = datasEscala.length
        const cotaDiaria = diasEscalaCount > 0 ? Math.floor(espAtiva.cota / diasEscalaCount) : espAtiva.cota
        
        const usadosNoDia = dataAtendimentoAutorizar 
          ? agendamentos.filter(a => a.status === 'autorizado' && a.data_atendimento === dataAtendimentoAutorizar).reduce((acc, a) => acc + pesoCota(a), 0)
          : 0
        
        const cotaEsgotada = usadosNoDia >= cotaDiaria
        const isAdmin = usuario?.perfil === 'admin'
        const fecharModal = () => { setModalAutorizar(null); setPeriodoAutorizar(''); setDataAtendimentoAutorizar(''); setJustificativaCota('') }
        return (
          <Modal titulo="Autorizar Agendamento" onClose={fecharModal}>
            <p style={{ fontSize: '13px', color: '#475569', margin: '0 0 16px' }}>
              Autorizando <strong>{modalAutorizar.paciente_nome}</strong> — {modalAutorizar.tipo_exame || 'Consulta'}
            </p>

            {/* Escala Disponível */}
            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '12px', marginBottom: '14px' }}>
              <h4 style={{ margin: '0 0 8px', fontSize: '12px', fontWeight: '700', color: '#334155', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span>📅</span> ESCALA DE ATENDIMENTO DISPONÍVEL ({escalaFiltrada.length})
              </h4>
              {escalaFiltrada.length === 0 ? (
                <p style={{ margin: 0, fontSize: '12px', color: '#64748b', fontStyle: 'italic' }}>
                  Nenhuma data de atendimento cadastrada na escala para esta especialidade neste mês.
                </p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '150px', overflowY: 'auto' }}>
                  {escalaFiltrada.map(e => {
                    const formatDt = e.data_atendimento ? fmtData(e.data_atendimento) : 'Data não informada'
                    const isSelected = dataAtendimentoAutorizar === e.data_atendimento && periodoAutorizar === e.periodo
                    return (
                      <div 
                        key={e.id} 
                        onClick={() => {
                          if (e.data_atendimento) setDataAtendimentoAutorizar(e.data_atendimento)
                          if (e.periodo) setPeriodoAutorizar(e.periodo)
                        }}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          padding: '8px 10px',
                          background: isSelected ? '#dcfce7' : '#ffffff',
                          border: isSelected ? '1px solid #22c55e' : '1px solid #e2e8f0',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          transition: 'all 0.15s ease'
                        }}
                        onMouseEnter={ev => {
                          if (!isSelected) ev.currentTarget.style.backgroundColor = '#f1f5f9'
                        }}
                        onMouseLeave={ev => {
                          if (!isSelected) ev.currentTarget.style.backgroundColor = '#ffffff'
                        }}
                      >
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <span style={{ fontSize: '12px', fontWeight: '700', color: '#0f172a' }}>
                            {formatDt}
                          </span>
                          <span style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                            👨‍⚕️ {e.profissional_nome || 'Profissional não informado'}
                          </span>
                        </div>
                        {e.periodo && (
                          <span style={{ fontSize: '10px', color: '#0369a1', background: '#e0f2fe', padding: '2px 8px', borderRadius: '12px', fontWeight: '700' }}>
                            {e.periodo.toUpperCase()}
                          </span>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
              <p style={{ margin: '8px 0 0', fontSize: '11px', color: '#64748b', fontStyle: 'italic' }}>
                💡 Clique em uma das escalas acima para preencher automaticamente a data e o período.
              </p>
            </div>

            {/* Cota e Saldo do Dia */}
            {dataAtendimentoAutorizar && (
              (() => {
                const saldo = cotaDiaria - usadosNoDia
                const isVermelho = saldo <= 0
                return (
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr 1fr',
                    gap: '10px',
                    background: isVermelho ? '#fef2f2' : '#f0fdf4',
                    border: isVermelho ? '1px solid #fca5a5' : '1px solid #bbf7d0',
                    borderRadius: '8px',
                    padding: '10px 14px',
                    marginBottom: '14px',
                    textAlign: 'center'
                  }}>
                    <div>
                      <span style={{ display: 'block', fontSize: '10px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Cota do Dia</span>
                      <span style={{ fontSize: '15px', fontWeight: '800', color: '#0f172a', display: 'block', marginTop: '2px' }}>{cotaDiaria}</span>
                    </div>
                    <div>
                      <span style={{ display: 'block', fontSize: '10px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Agendados</span>
                      <span style={{ fontSize: '15px', fontWeight: '800', color: '#0f172a', display: 'block', marginTop: '2px' }}>{usadosNoDia}</span>
                    </div>
                    <div>
                      <span style={{ display: 'block', fontSize: '10px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Saldo do Dia</span>
                      <span style={{ 
                        fontSize: '15px', 
                        fontWeight: '800', 
                        color: isVermelho ? '#dc2626' : '#16a34a',
                        display: 'block',
                        marginTop: '2px'
                      }}>
                        {saldo}
                      </span>
                    </div>
                  </div>
                )
              })()
            )}

            {/* Aviso de cota esgotada */}
            {cotaEsgotada && !isAdmin && (
              <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: '8px', padding: '10px 14px', marginBottom: '14px', fontSize: '12px', color: '#991b1b', fontWeight: '600' }}>
                Cota diária para esta data esgotada ({usadosNoDia}/{cotaDiaria}). Somente o administrador pode autorizar novos agendamentos nesta data.
              </div>
            )}
            {cotaEsgotada && isAdmin && (
              <div style={{ background: '#fff7ed', border: '1px solid #fb923c', borderRadius: '8px', padding: '10px 14px', marginBottom: '14px', fontSize: '12px', color: '#7c2d12', fontWeight: '600' }}>
                Cota diária para esta data esgotada ({usadosNoDia}/{cotaDiaria}). Como administrador você pode autorizar, mas é necessário justificar.
              </div>
            )}

            {exigeJejum && (
              <div style={{ background: '#fff7ed', border: '1px solid #fb923c', borderRadius: '8px', padding: '8px 12px', marginBottom: '14px', fontSize: '12px', color: '#7c2d12' }}>
                <strong>Exame com jejum de 8h</strong> — período da tarde não disponível.
              </div>
            )}

            {/* Bloqueia os campos se não-admin com cota cheia */}
            {(!cotaEsgotada || isAdmin) && (
              <>
                <div style={{ marginBottom: '14px' }}>
                  <label className="label-modern">Data e Período de Atendimento (da Escala) *</label>
                  <select 
                    className="input-modern" 
                    value={dataAtendimentoAutorizar && periodoAutorizar ? `${dataAtendimentoAutorizar}|${periodoAutorizar}` : ''}
                    onChange={e => {
                      const val = e.target.value
                      if (val) {
                        const [dt, per] = val.split('|')
                        setDataAtendimentoAutorizar(dt)
                        setPeriodoAutorizar(per)
                      } else {
                        setDataAtendimentoAutorizar('')
                        setPeriodoAutorizar('')
                      }
                    }}
                    style={{ width: '100%' }}
                  >
                    <option value="">— Selecione uma data/período da escala —</option>
                    {escalaFiltrada.map(e => {
                      const formatDt = e.data_atendimento ? fmtData(e.data_atendimento) : 'Data não informada'
                      const val = `${e.data_atendimento}|${e.periodo}`
                      return (
                        <option key={e.id} value={val}>
                          {formatDt} — {e.periodo ? e.periodo.toUpperCase() : 'SEM PERÍODO'} ({e.profissional_nome || 'Sem profissional'})
                        </option>
                      )
                    })}
                  </select>
                </div>

                {/* Justificativa — obrigatória apenas quando cota esgotada e admin */}
                {cotaEsgotada && isAdmin && (
                  <div style={{ marginBottom: '14px' }}>
                    <label className="label-modern">Justificativa *</label>
                    <textarea className="input-modern" rows={2} value={justificativaCota}
                      onChange={e => setJustificativaCota(e.target.value)}
                      placeholder="Informe o motivo para autorizar além da cota..."
                      style={{ width: '100%', resize: 'vertical' }} />
                  </div>
                )}
              </>
            )}

            <div style={{ display: 'flex', gap: '10px' }}>
              {(!cotaEsgotada || isAdmin) && (
                <button className="btn-primary" style={{ background: 'linear-gradient(135deg, #166534, #16a34a)' }} onClick={confirmarAutorizar}>
                  <Check size={13} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '5px' }} />Confirmar Autorização
                </button>
              )}
              <button className="btn-secondary" onClick={fecharModal}>Cancelar</button>
            </div>
          </Modal>
        )
      })()}

      {/* ── MODAL: VISUALIZAÇÃO ── */}
      {modalVer && (() => {
        const a = modalVer
        const st = STATUS_STYLE[a.status] || STATUS_STYLE.pendente
        const campo = (label, valor) => valor ? (
          <div style={{ marginBottom: '12px' }}>
            <p style={{ fontSize: '10px', fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 2px' }}>{label}</p>
            <p style={{ fontSize: '13px', color: '#0f172a', margin: 0, fontWeight: '500' }}>{valor}</p>
          </div>
        ) : null
        return (
          <Modal titulo="Dados do Agendamento" onClose={() => setModalVer(null)}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 24px' }}>
              {campo('Paciente', a.paciente_nome)}
              {campo('CPF / CNS', a.paciente_cns)}
              {campo('Telefone', a.telefone)}
              {campo('Sexo', a.sexo)}
              {campo('Tipo', a.tipo_exame)}
              {campo('Data de solicitação', fmtData(a.data_consulta))}
              {campo('Profissional', a.profissional_nome)}
              {campo('Período', a.periodo)}
              {campo('Criado por', a.criado_por)}
              {a.status === 'autorizado' && campo('Regulador', a.autorizado_por)}
            </div>
            {a.observacao && (
              <div style={{ margin: '4px 0 12px' }}>
                <p style={{ fontSize: '10px', fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 2px' }}>Observação</p>
                <p style={{ fontSize: '13px', color: '#0f172a', margin: 0 }}>{a.observacao}</p>
              </div>
            )}
            {a.status === 'negado' && a.motivo_cancelamento && (
              <div style={{ margin: '4px 0 12px' }}>
                <p style={{ fontSize: '10px', fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 2px' }}>Motivo do cancelamento</p>
                <p style={{ fontSize: '13px', color: '#991b1b', margin: 0, fontStyle: 'italic' }}>{a.motivo_cancelamento}</p>
              </div>
            )}
            <div style={{ marginTop: '8px', paddingTop: '12px', borderTop: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '11px', fontWeight: '700', padding: '3px 10px', borderRadius: '20px', background: st.bg, color: st.cor, border: `1px solid ${st.borda}` }}>
                {STATUS_LABEL[a.status]}
              </span>
              <button className="btn-secondary" onClick={() => setModalVer(null)}>Fechar</button>
            </div>
          </Modal>
        )
      })()}
      </AnimatePresence>

      <AnimatePresence>
      {/* ── MODAL UNIFICADO: GESTÃO DA ESPECIALIDADE ── */}
      {modalGestao && (
        <Modal 
          titulo={`Gestão — ${espAtiva.label}`} 
          onClose={() => {
            setModalGestao(null)
            setEditandoEsp(null)
            setFormEsp({ label: '', icon: '', cota: '30' })
            setEditandoPreparo(null)
            setFormPreparo({ especialidade_slug: 'usg', tipo_exame: '', instrucoes: '' })
          }} 
          largura={modalGestao === 'config' ? '700px' : '640px'}
        >
          {/* Abas Principais */}
          <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', borderBottom: '1px solid #e2e8f0', paddingBottom: '12px', flexWrap: 'wrap' }}>
            {[
              ['escala', <><Calendar size={13} style={{display:'inline',verticalAlign:'middle',marginRight:'5px'}} />Escala (Agenda)</>],
              ['profissionais', <><UserCog size={13} style={{display:'inline',verticalAlign:'middle',marginRight:'5px'}} />Profissionais</>],
              ['config', <><Settings size={13} style={{display:'inline',verticalAlign:'middle',marginRight:'5px'}} />Configurações</>]
            ].map(([id, lbl]) => (
              <button key={id} onClick={() => setModalGestao(id)} style={{
                background: modalGestao === id ? 'linear-gradient(135deg, #166534, #16a34a)' : 'none',
                color: modalGestao === id ? 'white' : '#64748b',
                border: modalGestao === id ? 'none' : '1px solid #e2e8f0',
                borderRadius: '8px', padding: '8px 16px', fontSize: '13px', fontWeight: '700',
                cursor: 'pointer', fontFamily: 'Sora, sans-serif'
              }}>{lbl}</button>
            ))}
          </div>

          {/* ABA: ESCALA */}
          {modalGestao === 'escala' && (
            <>
              {/* Seletor de mês/ano dentro da escala */}
              <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end', marginBottom: '16px', padding: '10px 14px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                <div>
                  <label className="label-modern">Mês</label>
                  <select className="input-modern" value={mes} onChange={e => setMes(e.target.value)} style={{ width: '140px' }}>
                    {MESES.map((n, i) => (
                      <option key={i} value={String(i + 1).padStart(2, '0')}>{String(i + 1).padStart(2, '0')} — {n}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label-modern">Ano</label>
                  <input className="input-modern" type="number" value={ano} onChange={e => setAno(e.target.value)} min="2020" max="2099" style={{ width: '90px' }} />
                </div>
              </div>

              {(() => {
                const datasEscala = Array.from(new Set(escala.map(item => item.data_atendimento)))
                const diasEscalaCount = datasEscala.length
                const cotaDiaria = diasEscalaCount > 0 ? Math.floor(espAtiva.cota / diasEscalaCount) : espAtiva.cota
                return (
                  <div style={{ marginBottom: '16px', padding: '12px 16px', background: '#eff6ff', borderRadius: '8px', border: '1px solid #bfdbfe', fontSize: '13px', color: '#1e3a8a', fontFamily: 'Sora, sans-serif' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                      <div><strong>Cota Mensal:</strong> {espAtiva.cota}</div>
                      <div><strong>Dias na Escala:</strong> {diasEscalaCount}</div>
                      <div><strong>Cota Diária Calculada:</strong> <span style={{ fontWeight: '800', color: '#1d4ed8' }}>{cotaDiaria}</span> por dia</div>
                    </div>
                  </div>
                )
              })()}

              {profissionais.length === 0 ? (
                <p style={{ color: '#64748b', fontSize: '13px', padding: '14px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                  Nenhum profissional cadastrado. Cadastre profissionais primeiro na aba <strong>Profissionais</strong> acima.
                </p>
              ) : (
                <div style={{ marginBottom: '20px', padding: '14px', background: '#f0fdf4', borderRadius: '10px', border: '1px solid #bbf7d0' }}>
                  <p style={{ fontFamily: 'Sora, sans-serif', fontSize: '11px', fontWeight: '700', color: '#065f46', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 10px' }}>Adicionar à escala</p>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', marginBottom: '10px' }}>
                    <div>
                      <label className="label-modern">Profissional *</label>
                      <select className="input-modern" value={profEscalaSel} onChange={e => setProfEscalaSel(e.target.value)} style={{ width: '100%' }}>
                        <option value="">— Selecione —</option>
                        {profissionais.map(p => (
                          <option key={p.id} value={p.id}>{p.nome}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="label-modern">Data de Atendimento *</label>
                      <input className="input-modern" type="date" value={dataEscala} onChange={e => setDataEscala(e.target.value)} style={{ width: '100%' }} />
                    </div>
                    <div>
                      <label className="label-modern">Período</label>
                      <select className="input-modern" value={periodoEscala} onChange={e => setPeriodoEscala(e.target.value)} style={{ width: '100%' }}>
                        <option value="">— Selecione —</option>
                        {periodos.filter(p => p.ativo).map(p => (
                          <option key={p.id} value={p.nome}>{p.nome}{p.horario ? ` (${p.horario})` : ''}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <button className="btn-primary" style={{ background: 'linear-gradient(135deg, #065f46, #047857)' }}
                    onClick={adicionarEscala} disabled={salvandoEscala || !profEscalaSel || !dataEscala}>
                    {salvandoEscala ? 'Salvando...' : '+ Adicionar à Escala'}
                  </button>
                </div>
              )}

              <p style={{ fontFamily: 'Sora, sans-serif', fontSize: '11px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 10px' }}>Na escala</p>
              {escala.length === 0
                ? <p style={{ color: '#94a3b8', fontSize: '13px', fontStyle: 'italic' }}>Nenhum profissional escalado para este período.</p>
                : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '240px', overflowY: 'auto' }}>
                    {escala.map(e => (
                      <div key={e.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', borderRadius: '8px', background: '#f0fdf4', border: '1px solid #bbf7d0' }}>
                        <div>
                          <span style={{ fontWeight: '700', fontSize: '13px', color: '#166534' }}>👨‍⚕️ {e.profissional_nome}</span>
                          {e.data_atendimento && (
                            <span style={{ fontSize: '12px', color: '#047857', marginLeft: '10px', fontWeight: '600' }}>
                              {fmtData(e.data_atendimento)}
                            </span>
                          )}
                          {e.periodo && (
                            <span style={{ fontSize: '11px', color: '#0369a1', marginLeft: '8px', background: '#e0f2fe', padding: '1px 7px', borderRadius: '10px', fontWeight: '600' }}>
                              {e.periodo}
                            </span>
                          )}
                        </div>
                        <button onClick={() => removerEscala(e.id)}
                          style={{ padding: '4px 10px', fontSize: '11px', background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: '6px', color: '#991b1b', cursor: 'pointer', fontWeight: '700' }}>
                          Remover
                        </button>
                      </div>
                    ))}
                  </div>
                )
              }
            </>
          )}

          {/* ABA: PROFISSIONAIS */}
          {modalGestao === 'profissionais' && (
            <>
              {/* Formulário */}
              <div style={{ marginBottom: '20px', padding: '16px', background: '#f8fafc', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                <p style={{ fontFamily: 'Sora, sans-serif', fontSize: '12px', fontWeight: '700', color: COR, textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 12px' }}>Adicionar profissional</p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: '10px', alignItems: 'end' }}>
                  <div>
                    <label className="label-modern">Nome *</label>
                    <input className="input-modern" type="text" placeholder="Nome completo"
                      value={formProf.nome} onChange={e => setFormProf(f => ({ ...f, nome: e.target.value }))} style={{ width: '100%' }} />
                  </div>
                  <div>
                    <label className="label-modern">Conselho</label>
                    <select className="input-modern" value={formProf.conselho_tipo} onChange={e => setFormProf(f => ({ ...f, conselho_tipo: e.target.value }))} style={{ width: '90px' }}>
                      {CONSELHOS.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="label-modern">Número</label>
                    <input className="input-modern" type="text" placeholder="Ex: 12345"
                      value={formProf.conselho_numero} onChange={e => setFormProf(f => ({ ...f, conselho_numero: e.target.value }))} style={{ width: '100px' }} />
                  </div>
                </div>
                <button className="btn-primary" style={{ background: GRAD, marginTop: '12px' }} onClick={salvarProfissional} disabled={salvandoProf}>
                  {salvandoProf ? 'Salvando...' : '+ Adicionar'}
                </button>
              </div>

              {/* Lista */}
              <p style={{ fontFamily: 'Sora, sans-serif', fontSize: '11px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 10px' }}>Profissionais cadastrados</p>
              {profissionais.length === 0
                ? <p style={{ color: '#94a3b8', fontSize: '13px', textAlign: 'center', padding: '16px 0' }}>Nenhum profissional cadastrado para {espAtiva.label}.</p>
                : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '240px', overflowY: 'auto' }}>
                    {profissionais.map(p => (
                      <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', borderRadius: '8px', background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                        <div>
                          <span style={{ fontWeight: '700', fontSize: '13px', color: '#0f172a' }}>{p.nome}</span>
                          {p.conselho_numero && (
                            <span style={{ fontSize: '11px', color: '#64748b', marginLeft: '8px' }}>{p.conselho_tipo} {p.conselho_numero}</span>
                          )}
                        </div>
                        <button onClick={() => removerProfissional(p.id)}
                          style={{ padding: '4px 10px', fontSize: '11px', background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: '6px', color: '#991b1b', cursor: 'pointer', fontWeight: '700' }}>
                          Remover
                        </button>
                      </div>
                    ))}
                  </div>
                )
              }
            </>
          )}

          {/* ABA: CONFIGURAÇÕES */}
          {modalGestao === 'config' && (
            <>
              {/* Sub-abas de Configuração */}
              <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', borderBottom: '1px solid #e2e8f0', paddingBottom: '12px', flexWrap: 'wrap' }}>
                {[
                  ['especialidades', <><Stethoscope size={13} style={{display:'inline',verticalAlign:'middle',marginRight:'5px'}} />Especialidades</>],
                  ['preparos', <><FlaskConical size={13} style={{display:'inline',verticalAlign:'middle',marginRight:'5px'}} />Orientações</>],
                  ['periodos', <><Clock size={13} style={{display:'inline',verticalAlign:'middle',marginRight:'5px'}} />Períodos</>],
                  ['tipos_usg', <><Settings size={13} style={{display:'inline',verticalAlign:'middle',marginRight:'5px'}} />Tipos de USG</>]
                ].map(([id, lbl]) => (
                  <button key={id} onClick={() => setAbaConfig(id)} style={{
                    background: abaConfig === id ? '#d97706' : 'none',
                    color: abaConfig === id ? 'white' : '#64748b',
                    border: abaConfig === id ? 'none' : '1px solid #e2e8f0',
                    borderRadius: '8px', padding: '7px 16px', fontSize: '13px', fontWeight: '600',
                    cursor: 'pointer', fontFamily: 'DM Sans, sans-serif'
                  }}>{lbl}</button>
                ))}
              </div>

              {abaConfig === 'especialidades' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {/* Lista */}
                  <div>
                    <p style={{ fontSize: '12px', fontWeight: '700', color: '#475569', margin: '0 0 8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Especialidades cadastradas</p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '200px', overflowY: 'auto' }}>
                      {especialidadesConfig.map(e => (
                        <div key={e.slug} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 12px', background: e.ativo ? '#f0fdf4' : '#f8fafc', borderRadius: '8px', border: `1px solid ${e.ativo ? '#bbf7d0' : '#e2e8f0'}` }}>
                          <span style={{ fontSize: '18px' }}>{e.icon}</span>
                          <span style={{ flex: 1, fontWeight: '600', fontSize: '13px', color: e.ativo ? '#166534' : '#94a3b8' }}>{e.label}</span>
                          <span style={{ fontSize: '11px', color: '#94a3b8' }}>cota {e.cota}</span>
                          
                          <button onClick={() => {
                            setEditandoEsp(e.slug)
                            setFormEsp({ label: e.label, icon: e.icon, cota: String(e.cota) })
                          }} style={{
                            background: '#eff6ff', border: 'none', borderRadius: '6px',
                            padding: '4px 8px', fontSize: '11px', cursor: 'pointer',
                            color: '#1d4ed8', display: 'inline-flex', alignItems: 'center', gap: '4px'
                          }} title="Editar">
                            <Pencil size={11} />
                          </button>

                          <button onClick={() => toggleEspecialidade(e.slug, e.ativo)} style={{
                            background: e.ativo ? '#fee2e2' : '#dcfce7', border: 'none', borderRadius: '6px',
                            padding: '4px 10px', fontSize: '11px', fontWeight: '700', cursor: 'pointer',
                            color: e.ativo ? '#991b1b' : '#166534'
                          }}>{e.ativo ? 'Desativar' : 'Reativar'}</button>
                        </div>
                      ))}
                    </div>
                  </div>
                  {/* Nova especialidade / Editar especialidade */}
                  <div style={{ background: '#f8fafc', borderRadius: '10px', padding: '14px', border: '1px solid #e2e8f0' }}>
                    <p style={{ fontSize: '12px', fontWeight: '700', color: '#475569', margin: '0 0 10px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      {editandoEsp ? 'Editar especialidade' : 'Nova especialidade'}
                    </p>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 60px 80px auto', gap: '8px', alignItems: 'end' }}>
                      <div><label className="label-modern">Nome</label><input className="input-modern" placeholder="Ex.: Cardiologia" value={formEsp.label} onChange={e => setFormEsp(f => ({ ...f, label: e.target.value }))} /></div>
                      <div><label className="label-modern">Ícone</label><input className="input-modern" value={formEsp.icon || ''} onChange={e => setFormEsp(f => ({ ...f, icon: e.target.value }))} style={{ textAlign: 'center' }} /></div>
                      <div><label className="label-modern">Cota/mês</label><input className="input-modern" type="number" min="1" value={formEsp.cota} onChange={e => setFormEsp(f => ({ ...f, cota: e.target.value }))} /></div>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        {editandoEsp && (
                          <button className="btn-secondary" style={{ padding: '9px 14px' }} onClick={() => {
                            setEditandoEsp(null)
                            setFormEsp({ label: '', icon: '', cota: '30' })
                          }}>
                            Cancelar
                          </button>
                        )}
                        <button className="btn-primary" style={{ background: GRAD, padding: '9px 14px' }} onClick={salvarEspecialidade} disabled={salvandoEsp}>
                          {salvandoEsp ? '...' : editandoEsp ? 'Salvar' : '+ Adicionar'}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {abaConfig === 'preparos' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {/* Lista de preparos */}
                  <div>
                    <p style={{ fontSize: '12px', fontWeight: '700', color: '#475569', margin: '0 0 8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Orientações cadastradas</p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '200px', overflowY: 'auto' }}>
                      {preparosList.length === 0 && <p style={{ fontSize: '12px', color: '#94a3b8' }}>Nenhuma orientação cadastrada ainda.</p>}
                      {preparosList.map(p => (
                        <div key={p.id} style={{ padding: '8px 12px', background: '#fffbeb', borderRadius: '8px', border: '1px solid #fde68a' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                            <div style={{ flex: 1 }}>
                              <span style={{ fontWeight: '700', fontSize: '12px', color: '#b45309', display: 'block' }}>{p.tipo_exame} <span style={{ fontWeight: '400', color: '#d97706' }}>({p.especialidade_slug.toUpperCase()})</span></span>
                              <span style={{ fontSize: '11px', color: '#92400e', display: 'block', marginTop: '2px' }}>{p.instrucoes}</span>
                            </div>
                            <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
                              <button onClick={() => { setEditandoPreparo(p.id); setFormPreparo({ especialidade_slug: p.especialidade_slug, tipo_exame: p.tipo_exame, instrucoes: p.instrucoes }) }} style={{ background: '#eff6ff', border: '1px solid #93c5fd', borderRadius: '6px', padding: '3px 8px', fontSize: '11px', cursor: 'pointer', color: '#1d4ed8', display: 'flex', alignItems: 'center' }}><Pencil size={11} /></button>
                              <button onClick={() => excluirPreparo(p.id)} title="Excluir" style={{ background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: '6px', padding: '3px 8px', fontSize: '11px', cursor: 'pointer', color: '#991b1b', display:'inline-flex', alignItems:'center' }}><Trash2 size={11} /></button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Formulário */}
                  <div style={{ background: '#f8fafc', borderRadius: '10px', padding: '14px', border: '1px solid #e2e8f0' }}>
                    <p style={{ fontSize: '12px', fontWeight: '700', color: '#475569', margin: '0 0 10px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      {editandoPreparo ? 'Editando orientação' : 'Nova orientação'}
                    </p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                        <div>
                          <label className="label-modern">Especialidade</label>
                          <select className="input-modern" value={formPreparo.especialidade_slug} onChange={e => setFormPreparo(f => ({ ...f, especialidade_slug: e.target.value }))}>
                            {especialidades.map(e => <option key={e.id} value={e.id}>{e.label}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="label-modern">Tipo de exame</label>
                          <input className="input-modern" placeholder="Ex.: ABDOMEN TOTAL" value={formPreparo.tipo_exame} onChange={e => setFormPreparo(f => ({ ...f, tipo_exame: e.target.value.toUpperCase() }))} />
                        </div>
                      </div>
                      <div>
                        <label className="label-modern">Instruções de orientação</label>
                        <textarea className="input-modern" rows={3} placeholder="Ex.: JEJUM DE 8 HORAS..." value={formPreparo.instrucoes} onChange={e => setFormPreparo(f => ({ ...f, instrucoes: e.target.value }))} style={{ resize: 'vertical' }} />
                      </div>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        {editandoPreparo && (
                          <button className="btn-secondary" onClick={() => { setEditandoPreparo(null); setFormPreparo({ especialidade_slug: 'usg', tipo_exame: '', instrucoes: '' }) }}>
                            Cancelar
                          </button>
                        )}
                        <button className="btn-primary" style={{ background: GRAD }} onClick={salvarPreparo} disabled={salvandoPreparo}>
                          {salvandoPreparo ? 'Salvando...' : editandoPreparo ? 'Salvar alteração' : '+ Adicionar orientação'}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {abaConfig === 'periodos' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div>
                    <p style={{ fontSize: '12px', fontWeight: '700', color: '#475569', margin: '0 0 8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Períodos cadastrados</p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '200px', overflowY: 'auto' }}>
                      {periodos.length === 0 && <p style={{ fontSize: '12px', color: '#94a3b8' }}>Nenhum período cadastrado ainda.</p>}
                      {periodos.map(p => (
                        <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 12px', background: '#f0f9ff', borderRadius: '8px', border: '1px solid #bae6fd' }}>
                          <div style={{ flex: 1 }}>
                            <span style={{ fontWeight: '700', fontSize: '13px', color: '#0369a1' }}>{p.nome}</span>
                            {p.horario && <span style={{ fontSize: '11px', color: '#0ea5e9', marginLeft: '8px' }}>{p.horario}</span>}
                          </div>
                          <button onClick={() => excluirPeriodo(p.id)} style={{ background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: '6px', padding: '3px 8px', fontSize: '11px', cursor: 'pointer', color: '#991b1b', display: 'inline-flex', alignItems: 'center' }}>
                            <Trash2 size={11} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div style={{ background: '#f8fafc', borderRadius: '10px', padding: '14px', border: '1px solid #e2e8f0' }}>
                    <p style={{ fontSize: '12px', fontWeight: '700', color: '#475569', margin: '0 0 10px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Novo período</p>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: '8px', alignItems: 'end' }}>
                      <div>
                        <label className="label-modern">Nome *</label>
                        <input className="input-modern" placeholder="Ex.: Manhã" value={formPeriodo.nome} onChange={e => setFormPeriodo(f => ({ ...f, nome: e.target.value }))} />
                      </div>
                      <div>
                        <label className="label-modern">Horário</label>
                        <input className="input-modern" placeholder="Ex.: 07:00 - 12:00" value={formPeriodo.horario} onChange={e => setFormPeriodo(f => ({ ...f, horario: e.target.value }))} />
                      </div>
                      <button className="btn-primary" style={{ background: GRAD, padding: '9px 14px' }} onClick={salvarPeriodo} disabled={salvandoPeriodo}>
                        {salvandoPeriodo ? '...' : '+ Adicionar'}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {abaConfig === 'tipos_usg' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div>
                    <p style={{ fontSize: '12px', fontWeight: '700', color: '#475569', margin: '0 0 8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Tipos de Ultrassom Cadastrados</p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '200px', overflowY: 'auto' }}>
                      {tiposUsgOrdem.length === 0 && <p style={{ fontSize: '12px', color: '#94a3b8' }}>Nenhum tipo de ultrassom cadastrado ainda.</p>}
                      {tiposUsgOrdem.map(t => (
                        <div key={t} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 12px', background: '#f0fdf4', borderRadius: '8px', border: '1px solid #bbf7d0' }}>
                          <div style={{ flex: 1 }}>
                            <span style={{ fontWeight: '700', fontSize: '13px', color: '#166534' }}>{t}</span>
                          </div>
                          <button onClick={() => handleExcluirTipoUsg(t)} style={{ background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: '6px', padding: '3px 8px', fontSize: '11px', cursor: 'pointer', color: '#991b1b', display: 'inline-flex', alignItems: 'center' }}>
                            <Trash2 size={11} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div style={{ background: '#f8fafc', borderRadius: '10px', padding: '14px', border: '1px solid #e2e8f0' }}>
                    <p style={{ fontSize: '12px', fontWeight: '700', color: '#475569', margin: '0 0 10px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Novo Tipo de Ultrassom</p>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '8px', alignItems: 'end' }}>
                      <div>
                        <label className="label-modern">Nome *</label>
                        <input className="input-modern" placeholder="Ex.: USG OBSTÉTRICA COM DOPPLER" value={novoTipoUsg} onChange={e => setNovoTipoUsg(e.target.value)} />
                      </div>
                      <button className="btn-primary" style={{ background: GRAD, padding: '9px 14px' }} onClick={handleAdicionarTipoUsg} disabled={salvandoTipoUsg}>
                        {salvandoTipoUsg ? '...' : '+ Adicionar'}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </Modal>
      )}
      </AnimatePresence>

      <style dangerouslySetInnerHTML={{
        __html: `
        .print-only { display: none; }
        @media print {
          body * { visibility: hidden; }
          .esp-print-area, .esp-print-area * { visibility: visible; }
          .esp-print-area { position: absolute; left: 0; top: 0; width: 100%; padding: 0 !important; border: none !important; box-shadow: none !important; }
          .no-print { display: none !important; }
          .print-header-esp { display: block !important; }
          .print-only { display: block !important; }
          .screen-only { display: none !important; }
        }
      `}} />
      </div>
    </Layout>
  )
}
