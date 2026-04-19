'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Layout from '@/components/Layout'
import { abrirJanelaImpressaoComTitulo } from '@/lib/printHeader'
import { Settings, ClipboardList, Users, Printer, CalendarDays, Calendar } from 'lucide-react'

const SERVIDORES_ESTADO = [
  { nome: 'RENILDA TELES DE FRAGA',   cargo: 'TÉC. DE ENFERMAGEM' },
  { nome: 'SHEILA ZAVARESE SECCHIN',  cargo: 'CIRURGIÃ DENTISTA'  },
]

export default function Frequencia() {
  const router = useRouter()
  const [usuario, setUsuario] = useState(null)
  const [servidores, setServidores] = useState([])
  const [escalaIds, setEscalaIds] = useState([])
  const [portalInfo, setPortalInfo] = useState({ atualizacao: '', carregando: false })
  const [sincronizando, setSincronizando] = useState(false)
  const [servidorId, setServidorId] = useState('')
  const [mes, setMes] = useState(String(new Date().getMonth() + 1).padStart(2, '0'))
  const [ano, setAno] = useState(String(new Date().getFullYear()))
  const [facultativos, setFacultativos] = useState([])
  const [feriados, setFeriados] = useState([])
  const [novoFacDia, setNovoFacDia] = useState('')
  const [novoFacDesc, setNovoFacDesc] = useState('')
  const [novoFerDia, setNovoFerDia] = useState('')
  const [novoFerMes, setNovoFerMes] = useState('')
  const [novoFerDesc, setNovoFerDesc] = useState('')
  const [tipoPeriodo, setTipoPeriodo] = useState('competencia_23_22')
  const [msg, setMsg] = useState({ txt: '', ok: true })
  const [modalCadastro, setModalCadastro] = useState(false)
  const [modalModo, setModalModo] = useState('cadastrar') // 'cadastrar' | 'alterar'
  const [formCadastro, setFormCadastro] = useState({ nome: '', funcao: '', matricula: '', nivel: 'EFETIVO', situacao: '' })
  const [salvandoCadastro, setSalvandoCadastro] = useState(false)
  const [funcoesExistentes, setFuncoesExistentes] = useState([])
  const [modalRelatorio, setModalRelatorio] = useState(false)
  const [grupoRelatorio, setGrupoRelatorio] = useState('com_matricula')
  // Servidores do Estado
  const [servEstadoIdx, setServEstadoIdx] = useState('')
  const [escalaAberta, setEscalaAberta] = useState(false)
  const [mesEstado, setMesEstado] = useState(String(new Date().getMonth() + 1).padStart(2, '0'))
  const [anoEstado, setAnoEstado] = useState(String(new Date().getFullYear()))

  const nomesMeses = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho',
                      'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']
  const mesNum = Number(mes)
  const anoNum = Number(ano)
  const mesPrev = mesNum === 1 ? 12 : mesNum - 1
  const anoPrev = mesNum === 1 ? anoNum - 1 : anoNum
  const servidorAtual = servidores.find(s => String(s.id) === String(servidorId))
  const emEscala = servidorAtual ? escalaIds.some(mat => mat === servidorAtual.matricula) : false
  const emEscalaLista = servidores.filter(s => escalaIds.some(mat => mat === s.matricula))

  useEffect(() => {
    const u = localStorage.getItem('sms_user')
    if (!u) { router.push('/'); return }
    setUsuario(JSON.parse(u))
    carregarServidores()
    carregarEscala()
    carregarInfoPortal()
    carregarFuncoesExistentes()
  }, [])

  useEffect(() => {
    carregarFacultativos()
    carregarFeriados()
  }, [mes, ano])

  async function carregarFuncoesExistentes() {
    const { data } = await supabase.from('servidores').select('funcao').order('funcao')
    const unicas = [...new Set((data || []).map(s => s.funcao).filter(Boolean))].sort()
    setFuncoesExistentes(unicas)
  }

  async function carregarServidores() {
    const { data } = await supabase.from('servidores').select('*').order('nome')
    const ativos = (data || []).filter((servidor) => {
      if (!Object.prototype.hasOwnProperty.call(servidor, 'status')) return true
      const status = String(servidor.status || '').trim().toUpperCase()
      return !status || status === 'ATIVO'
    })
    setServidores(ativos)
  }

  async function carregarEscala() {
    const resp = await fetch('/api/escala')
    const data = await resp.json()
    setEscalaIds((data || []).map(e => e.matricula))
  }

  async function carregarFacultativos() {
    const resp = await fetch(`/api/facultativos?mes=${mesNum}&ano=${anoNum}`)
    const data = await resp.json()
    setFacultativos(Array.isArray(data) ? data : [])
  }

  async function carregarFeriados() {
    const resp = await fetch(`/api/feriados?ano=${anoNum}`)
    const data = await resp.json()
    setFeriados(Array.isArray(data) ? data : [])
  }

  async function carregarInfoPortal() {
    setPortalInfo(prev => ({ ...prev, carregando: true }))

    try {
      const resposta = await fetch('/api/frequencia/transparencia', { cache: 'no-store' })
      const json = await resposta.json()

      if (!resposta.ok || !json.ok) {
        throw new Error(json.error || 'Não foi possível consultar o portal.')
      }

      setPortalInfo({ atualizacao: json.atualizacao || '', carregando: false })
    } catch {
      setPortalInfo({ atualizacao: '', carregando: false })
    }
  }

  function mostrarMsg(txt, ok = true) {
    setMsg({ txt, ok })
    setTimeout(() => setMsg({ txt: '', ok: true }), 3000)
  }

  async function sincronizarServidoresPortal() {
    setSincronizando(true)

    try {
      const resposta = await fetch('/api/frequencia/transparencia', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ano: Number(ano),
          mes: Number(mes)
        })
      })

      const json = await resposta.json()

      if (!resposta.ok || !json.ok) {
        throw new Error(json.error || 'Erro ao sincronizar servidores.')
      }

      await carregarServidores()
      await carregarInfoPortal()

      mostrarMsg(
        `Portal ${json.competencia}: ${json.totalInseridos} inseridos, ${json.totalAtualizados} atualizados e ${json.totalInativos} inativos.`,
        true
      )
    } catch (error) {
      mostrarMsg(error.message || 'Erro ao sincronizar servidores.', false)
    } finally {
      setSincronizando(false)
    }
  }

  async function adicionarEscala() {
    if (!servidorId || !servidorAtual) { mostrarMsg('Selecione um servidor', false); return }
    const mat = servidorAtual.matricula
    if (escalaIds.some(m => m === mat)) { mostrarMsg('Servidor já está na ESCALA', false); return }
    const resp = await fetch('/api/escala', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ matricula: mat, nome: servidorAtual.nome })
    })
    const json = await resp.json()
    if (!resp.ok) {
      mostrarMsg('Erro ao adicionar à ESCALA: ' + (json.error || resp.status), false)
    } else {
      setEscalaIds(prev => [...prev, mat])
      mostrarMsg('✅ Adicionado à ESCALA')
    }
  }

  async function removerEscala() {
    if (!servidorId || !servidorAtual) { mostrarMsg('Selecione um servidor', false); return }
    const mat = servidorAtual.matricula
    const resp = await fetch('/api/escala', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ matricula: mat, nome: servidorAtual.nome, remover: true })
    })
    const json = await resp.json()
    if (!resp.ok) {
      mostrarMsg('Erro ao remover da ESCALA: ' + (json.error || resp.status), false)
    } else {
      setEscalaIds(prev => prev.filter(m => m !== mat))
      mostrarMsg('✅ Removido da ESCALA')
    }
  }

  async function adicionarFacultativo() {
    if (!novoFacDia || !novoFacDesc) return
    const resp = await fetch('/api/facultativos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dia: novoFacDia, mes: mesNum, ano: anoNum, descricao: novoFacDesc })
    })
    const json = await resp.json()
    if (!resp.ok) { mostrarMsg('Erro: ' + (json.error || resp.status), false); return }
    setNovoFacDia(''); setNovoFacDesc('')
    await carregarFacultativos()
  }

  async function removerFacultativo(id) {
    await fetch(`/api/facultativos?id=${id}`, { method: 'DELETE' })
    await carregarFacultativos()
  }

  async function adicionarFeriado() {
    if (!novoFerDia || !novoFerMes || !novoFerDesc) return
    const resp = await fetch('/api/feriados', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dia: novoFerDia, mes: novoFerMes, ano: anoNum, descricao: novoFerDesc })
    })
    const json = await resp.json()
    if (!resp.ok) { mostrarMsg('Erro: ' + (json.error || resp.status), false); return }
    setNovoFerDia(''); setNovoFerMes(''); setNovoFerDesc('')
    await carregarFeriados()
  }

  async function removerFeriado(id) {
    await fetch(`/api/feriados?id=${id}`, { method: 'DELETE' })
    await carregarFeriados()
  }

  function abrirModalCadastrar() {
    setFormCadastro({ nome: '', funcao: '', matricula: '', nivel: 'EFETIVO', situacao: '' })
    setModalModo('cadastrar')
    setModalCadastro(true)
  }

  function abrirModalAlterar() {
    if (!servidorAtual) { mostrarMsg('Selecione um servidor para alterar', false); return }
    setFormCadastro({
      nome: servidorAtual.nome || '',
      funcao: servidorAtual.funcao || '',
      matricula: servidorAtual.matricula || '',
      nivel: servidorAtual.nivel || 'EFETIVO',
      situacao: servidorAtual.situacao || ''
    })
    setModalModo('alterar')
    setModalCadastro(true)
  }

  async function salvarServidor(e) {
    e.preventDefault()
    const { nome, funcao, matricula, nivel, situacao } = formCadastro
    if (!nome.trim() || !funcao.trim() || !matricula.trim()) {
      mostrarMsg('Preencha nome, função e matrícula', false); return
    }
    setSalvandoCadastro(true)

    let resp, json
    if (modalModo === 'alterar') {
      resp = await fetch(`/api/servidores/frequencia/${servidorId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nome: nome.toUpperCase().trim(), funcao: funcao.toUpperCase().trim(), matricula: matricula.trim(), nivel, situacao: situacao.trim() })
      })
      json = await resp.json()
      setSalvandoCadastro(false)
      if (!resp.ok) {
        mostrarMsg('Erro ao alterar: ' + (json.error || resp.status), false)
      } else {
        mostrarMsg(`✅ ${json.nome} atualizado com sucesso`)
        setModalCadastro(false)
        await carregarServidores()
        await carregarFuncoesExistentes()
      }
    } else {
      resp = await fetch('/api/servidores/frequencia', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nome: nome.toUpperCase().trim(), funcao: funcao.toUpperCase().trim(), matricula: matricula.trim(), nivel, situacao: situacao.trim() })
      })
      json = await resp.json()
      setSalvandoCadastro(false)
      if (!resp.ok) {
        mostrarMsg('Erro ao cadastrar: ' + (json.error || resp.status), false)
      } else {
        mostrarMsg(`✅ ${json.nome} cadastrado com sucesso`)
        setModalCadastro(false)
        setFormCadastro({ nome: '', funcao: '', matricula: '', nivel: 'EFETIVO', situacao: '' })
        await carregarServidores()
        await carregarFuncoesExistentes()
      }
    }
  }

  async function excluirServidor() {
    if (!servidorId || !servidorAtual) { mostrarMsg('Selecione um servidor para excluir', false); return }
    if (!confirm(`Excluir "${servidorAtual.nome}" (${servidorAtual.matricula})? Esta ação não pode ser desfeita.`)) return
    const resp = await fetch(`/api/servidores/frequencia/${servidorId}`, { method: 'DELETE' })
    const json = await resp.json()
    if (!resp.ok) {
      mostrarMsg('Erro ao excluir: ' + (json.error || resp.status), false)
    } else {
      mostrarMsg(`✅ ${json.nome} excluído com sucesso`)
      setServidorId('')
      await carregarServidores()
      await carregarEscala()
    }
  }

  function gerarDias() {
    if (tipoPeriodo === 'mes_inteiro') {
      const ultimoDia = new Date(anoNum, mesNum, 0).getDate()
      const dias = []
      for (let d = 1; d <= ultimoDia; d++) {
        dias.push({ dia: d, mes: mesNum, ano: anoNum })
      }
      return dias
    }
    // competencia_23_22: do dia 23 do mês anterior ao dia 22 do mês atual
    const ultimoDiaMesPrev = new Date(anoNum, mesNum - 1, 0).getDate()
    const dias = []
    for (let d = 23; d <= ultimoDiaMesPrev; d++) {
      dias.push({ dia: d, mes: mesPrev, ano: anoPrev })
    }
    for (let d = 1; d <= 22; d++) {
      dias.push({ dia: d, mes: mesNum, ano: anoNum })
    }
    return dias
  }

  function calcularPascoa(ano) {
    const a = ano % 19
    const b = Math.floor(ano / 100)
    const c = ano % 100
    const d = Math.floor(b / 4)
    const e = b % 4
    const f = Math.floor((b + 8) / 25)
    const g = Math.floor((b - f + 1) / 3)
    const h = (19 * a + b - d - g + 15) % 30
    const i = Math.floor(c / 4)
    const k = c % 4
    const l = (32 + 2 * e + 2 * i - h - k) % 7
    const m = Math.floor((a + 11 * h + 22 * l) / 451)
    const mes = Math.floor((h + l - 7 * m + 114) / 31)
    const dia = ((h + l - 7 * m + 114) % 31) + 1
    return new Date(ano, mes - 1, dia)
  }

  function getTipoDia(dia, mesD, anoD) {
    const diaSem = new Date(anoD, mesD - 1, dia).getDay()
    if (diaSem === 0) return 'DOMINGO'
    if (diaSem === 6) return 'SÁBADO'
    // Feriados nacionais fixos
    const fixos = [[1,1],[21,4],[1,5],[7,9],[12,10],[2,11],[15,11],[20,11],[25,12]]
    if (fixos.some(([d, m]) => d === dia && m === mesD)) return 'FERIADO'
    // Feriados móveis (Páscoa)
    const pascoa = calcularPascoa(anoD)
    const somarDias = (base, n) => { const r = new Date(base); r.setDate(r.getDate() + n); return r }
    const moveis = [
      somarDias(pascoa, -48), // Segunda de Carnaval
      somarDias(pascoa, -47), // Terça de Carnaval
      somarDias(pascoa, -2),  // Sexta-feira Santa
      somarDias(pascoa, 60),  // Corpus Christi
    ]
    if (moveis.some(mv => mv.getFullYear() === anoD && mv.getMonth() + 1 === mesD && mv.getDate() === dia)) return 'FERIADO'
    // Feriados do banco
    if (feriados.some(f => f.dia === dia && f.mes === mesD)) return 'FERIADO'
    // Facultativos
    const fac = facultativos.find(f => f.dia === dia && f.mes === mesD && f.ano === anoD)
    if (fac) return fac.descricao
    return null
  }

  function gerarLinhasDias(dias, tipoFolha) {
    return dias.map(({ dia, mes: mesD, ano: anoD }) => {
      const tipo = getTipoDia(dia, mesD, anoD)
      const isEspecial = tipo !== null
      const bg = isEspecial ? 'background:#f0f0f0;' : ''
      let celulas
      if (tipoFolha === 'escala') {
        celulas = '<td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td>'
      } else if (isEspecial) {
        celulas = `<td style="text-align:center;font-weight:bold;font-size:9px;">${tipo}</td><td></td><td style="text-align:center;font-weight:bold;font-size:9px;">${tipo}</td><td></td><td style="text-align:center;font-weight:bold;font-size:9px;">${tipo}</td><td></td><td style="text-align:center;font-weight:bold;font-size:9px;">${tipo}</td><td></td><td></td><td></td>`
      } else {
        celulas = '<td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td>'
      }
      return `<tr style="${bg}"><td style="text-align:center;font-weight:bold;">${dia}</td>${celulas}</tr>`
    }).join('')
  }

  function gerarBlocoServidor(servidor, tipoFolha, linhas, mesRefLabel, logoUrl, pageBreak) {
    return `
  <div style="${pageBreak ? 'page-break-after:always;' : ''}">
    <div class="topo"><img src="${logoUrl}" alt="Logo SMS" onerror="this.style.display='none'" /></div>
    <div class="info-box">
      <div class="info-left">
        <p><strong>FOLHA DE FREQUÊNCIA</strong></p>
        <p><strong>NOME:</strong> ${servidor.nome}</p>
        <p><strong>LOTAÇÃO:</strong> SECRETARIA MUNICIPAL DE SAÚDE</p>
        <p><strong>FUNÇÃO:</strong> ${servidor.funcao || ''}</p>
        <p><strong>MATRÍCULA:</strong> ${servidor.matricula || ''}</p>
      </div>
      <div class="info-right">
        <p><strong>FUNDO MUN. SAÚDE DE CONCEIÇÃO DO TO</strong></p>
        <p><strong>CNPJ:</strong> 11.419.212/0001-24</p>
        <p><strong>MÊS REF:</strong> ${mesRefLabel}</p>
      </div>
    </div>
    <table>
      <thead>
        <tr>
          <th rowspan="2" style="width:5%">DIA</th>
          <th rowspan="2" style="width:9%">ENTRADA</th>
          <th rowspan="2" style="width:7%">HORA</th>
          <th rowspan="2" style="width:9%">SAÍDA</th>
          <th rowspan="2" style="width:7%">HORA</th>
          <th rowspan="2" style="width:9%">ENTRADA</th>
          <th rowspan="2" style="width:7%">HORA</th>
          <th rowspan="2" style="width:9%">SAÍDA</th>
          <th rowspan="2" style="width:7%">HORA</th>
          <th colspan="2" style="width:17%;background:#d0d0d0;">HORA EXTRA</th>
        </tr>
        <tr>
          <th style="width:8%;background:#d0d0d0;">ENTRADA</th>
          <th style="width:8%;background:#d0d0d0;">SAÍDA</th>
        </tr>
      </thead>
      <tbody>${linhas}</tbody>
    </table>
    <div class="footer">
      <strong>CÓDIGO AFASTAMENTO:</strong> 002 - ACIDENTE DE TRABALHO; 003 - LICENÇA MATERNIDADE (120 DIAS); 004 - SERVIÇO MILITAR; 024 - JUSTIÇA ELEITORAL; 027 - LICENÇA ADOÇÃO; 036 - LICENÇA ACOMPANHAMENTO; 044 - ATESTADO MÉDICO; 046 - LICENÇA ADMINISTRATIVA; 065 - LICENÇA NOJO; 150 - FALTAS COMPENSADAS; 151 - ABONO ASSIDUIDADE; 152 - CASAMENTO (05 DIAS); 153 - LICENÇA PATERNIDADE (05 DIAS); 154 - DOAÇÃO SANGUE; 155 - JURADO DE TRIBUNAL; 156 - DEPOR NA JUSTIÇA; 157 - ATIVIDADE SINDICAL; 158 - COMPARECIMENTO NA JUSTIÇA; 159 - CELEBRAÇÃO DE CASAMENTO (JUIZ DE PAZ); 160 - COMPENSAÇÃO DE HORAS EXTRAS; 161 - FALTAS NÃO ABONADAS; 162 - FALTAS INJUSTIFICADAS; 163 - SUSPENSÃO CONVERTIDAS EM MULTAS; 164 - EXAME VESTIBULAR; 165 - LICENÇA ADMINISTRATIVA NÃO REMUNERADA; 167 - LICENÇA BENEFÍCIO; 168 - BENEFÍCIO NÃO REMUNERADO; 169 - OUTRO AFASTAMENTO; 170 - CONTRATO SOB JÚDICE; 171 - INVALIDEZ TEMPORÁRIA; 172 - ADVERTÊNCIA.
    </div>
    <div class="justificativas">JUSTIFICATIVAS:</div>
    <div class="assinaturas">
      <div class="ass-linha"><div class="linha">ASSINATURA</div></div>
      <div class="ass-linha"><div class="linha">ASSINATURA E CARIMBO DO CHEFE IMEDIATO</div></div>
    </div>
  </div>`
  }

  function montarJanela(titulo, blocos) {
    const css = `
      body { font-family: Arial, sans-serif; font-size: 10px; margin: 3mm 8mm 8mm 8mm; color: #000; }
      .topo { text-align: center; margin-bottom: 3px; }
      .topo img { height: 60px; }
      .info-box { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 6px; }
      .info-left p, .info-right p { margin: 2px 0; font-size: 10px; }
      .info-right { text-align: right; }
      table { width: 100%; border-collapse: collapse; }
      th, td { border: 1px solid #000; padding: 2px 3px; font-size: 9px; height: 18px; }
      th { background: #e0e0e0; text-align: center; font-weight: bold; }
      td { text-align: center; }
      td:first-child { font-weight: bold; }
      .footer { font-size: 7.5px; margin-top: 8px; border: 1px solid #000; padding: 4px; line-height: 1.4; }
      .justificativas { font-size: 9px; margin-top: 6px; font-weight: bold; }
      .assinaturas { display: flex; justify-content: space-around; margin-top: 40px; }
      .ass-linha { text-align: center; }
      .ass-linha .linha { border-top: 1px solid #000; width: 220px; margin: 0 auto; padding-top: 4px; font-size: 9px; }
      @page { size: A4 portrait; margin: 4mm 8mm 8mm 8mm; }
    `
    return `<!doctype html><html><head><meta charset="utf-8"><title>${titulo}</title><style>${css}</style></head><body>${blocos.join('')}</body></html>`
  }

  function abrirImpressao(html, titulo) {
    const blob = new Blob([html], { type: 'text/html; charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const janela = window.open(url, '_blank')
    janela.addEventListener('load', () => {
      janela.document.title = titulo
      janela.print()
      URL.revokeObjectURL(url)
    })
  }

  function calcularMesRefLabel() {
    const mesPrevNome = nomesMeses[mesPrev - 1].toUpperCase()
    const mesAtualNome = nomesMeses[mesNum - 1].toUpperCase()
    return tipoPeriodo === 'mes_inteiro'
      ? `${mesAtualNome} - ${anoNum}`
      : `${mesPrevNome}/${mesAtualNome} - ${anoNum}`
  }

  function imprimirFolha(tipoFolha) {
    if (!servidorAtual) { alert('Selecione um servidor!'); return }
    if (isInativo(servidorAtual)) { mostrarMsg('Servidor inativo não pode ser impresso', false); return }
    const dias = gerarDias()
    const mesRefLabel = calcularMesRefLabel()
    const logoUrl = `${window.location.origin}/logo.jpg`
    const linhas = gerarLinhasDias(dias, tipoFolha)
    const bloco = gerarBlocoServidor(servidorAtual, tipoFolha, linhas, mesRefLabel, logoUrl, false)
    const titulo = `Folha de Frequência - ${servidorAtual.nome}`
    abrirImpressao(montarJanela(titulo, [bloco]), titulo)
  }

  const isInativo = (s) => String(s.situacao || '').trim().toLowerCase() === 'inativo'

  function imprimirEscala() {
    const lista = emEscalaLista.filter(s => !isInativo(s))
    if (!lista.length) { mostrarMsg('Nenhum profissional ativo na ESCALA', false); return }
    const dias = gerarDias()
    const mesRefLabel = calcularMesRefLabel()
    const logoUrl = `${window.location.origin}/logo.jpg`
    const linhasVazias = gerarLinhasDias(dias, 'escala')
    const blocos = lista.map((srv, i) =>
      gerarBlocoServidor(srv, 'escala', linhasVazias, mesRefLabel, logoUrl, i < lista.length - 1)
    )
    const titulo = 'Folhas de Frequência — ESCALA'
    abrirImpressao(montarJanela(titulo, blocos), titulo)
  }

  function imprimirNormal() {
    const normais = servidores.filter(s => !escalaIds.some(mat => mat === s.matricula) && !isInativo(s))
    if (!normais.length) { mostrarMsg('Nenhum profissional ativo fora da ESCALA', false); return }
    const dias = gerarDias()
    const mesRefLabel = calcularMesRefLabel()
    const logoUrl = `${window.location.origin}/logo.jpg`
    const blocos = normais.map((srv, i) => {
      const linhas = gerarLinhasDias(dias, 'normal')
      return gerarBlocoServidor(srv, 'normal', linhas, mesRefLabel, logoUrl, i < normais.length - 1)
    })
    const titulo = 'Folhas de Frequência — NORMAL'
    abrirImpressao(montarJanela(titulo, blocos), titulo)
  }

  function imprimirRelatorioMensal() {
    const temMatricula = (s) => s.matricula && String(s.matricula).trim() !== ''
    const base = servidores.filter(s => !isInativo(s))
    const lista = grupoRelatorio === 'com_matricula'
      ? base.filter(s => temMatricula(s))
      : base.filter(s => !temMatricula(s))

    if (!lista.length) {
      mostrarMsg('Nenhum servidor encontrado para o grupo selecionado', false)
      setModalRelatorio(false)
      return
    }

    let periodoLabel
    if (tipoPeriodo === 'mes_inteiro') {
      const ultimoDia = new Date(anoNum, mesNum, 0).getDate()
      periodoLabel = `01 A ${ultimoDia} DE ${nomesMeses[mesNum - 1].toUpperCase()} DE ${anoNum}`
    } else {
      periodoLabel = `23 DE ${nomesMeses[mesPrev - 1].toUpperCase()} A 22 DE ${nomesMeses[mesNum - 1].toUpperCase()} DE ${anoNum}`
    }

    const corpoDB = lista.map((s, i) => `<tr>
      <td style="text-align:center;width:3%;">${i + 1}</td>
      <td style="font-weight:bold;width:27%;">${s.nome}</td>
      <td style="width:22%;">${s.funcao || ''}</td>
      <td style="text-align:center;"></td>
      <td style="text-align:center;"></td>
      <td style="text-align:center;"></td>
      <td style="text-align:center;"></td>
      <td style="text-align:center;"></td>
      <td style="text-align:center;"></td>
    </tr>`).join('')

    const conteudo = `
      <table style="width:100%;border-collapse:collapse;margin-bottom:16px;">
        <thead>
          <tr>
            <th style="width:3%;">Nº</th>
            <th style="width:27%;text-align:left;">FUNCIONÁRIO</th>
            <th style="width:22%;text-align:left;">FUNÇÃO</th>
            <th style="width:8%;">FALTAS<br>JUSTIFICADAS</th>
            <th style="width:8%;">ATESTADOS</th>
            <th style="width:9%;">FALTA NÃO<br>JUSTIFICADA</th>
            <th style="width:8%;">FÉRIAS</th>
            <th style="width:8%;">LICENÇA</th>
            <th style="width:7%;">HORAS<br>EXTRAS</th>
          </tr>
        </thead>
        <tbody>${corpoDB}</tbody>
      </table>

      <div style="border:1px solid #000;padding:6px 8px;min-height:60px;margin-bottom:32px;">
        <p style="font-weight:700;font-size:10px;margin:0 0 4px;">OBSERVAÇÃO</p>
      </div>

      <div style="text-align:center;margin-top:48px;">
        <div style="display:inline-block;border-top:1px solid #000;padding-top:6px;min-width:320px;">
          <p style="font-weight:700;font-size:10px;margin:0;text-transform:uppercase;">Assinatura e Carimbo do Chefe Imediato</p>
        </div>
      </div>
    `

    setModalRelatorio(false)
    abrirJanelaImpressaoComTitulo(
      `Relatório de Frequência — ${periodoLabel}`,
      'Relatório de Frequência',
      `Referência de ${periodoLabel}`,
      conteudo
    )
  }

  async function imprimirFolhaPonto() {
    if (servEstadoIdx === '') { alert('Selecione um servidor!'); return }
    const srv = SERVIDORES_ESTADO[servEstadoIdx]
    const mesN = Number(mesEstado)
    const anoN = Number(anoEstado)
    const nomeMes = nomesMeses[mesN - 1].toUpperCase()
    const ultimoDia = new Date(anoN, mesN, 0).getDate()
    const diasSemana = ['DOMINGO','SEGUNDA','TERÇA','QUARTA','QUINTA','SEXTA','SÁBADO']

    // Busca feriados e facultativos para o mês/ano do estado (independente da seção principal)
    const [respFer, respFac] = await Promise.all([
      fetch(`/api/feriados?ano=${anoN}`),
      fetch(`/api/facultativos?mes=${mesN}&ano=${anoN}`)
    ])
    const feriadosEstado   = await respFer.json().catch(() => [])
    const facultativosEstado = await respFac.json().catch(() => [])

    function getTipoDiaEstado(dia, mesD, anoD) {
      const diaSem = new Date(anoD, mesD - 1, dia).getDay()
      if (diaSem === 0) return 'DOMINGO'
      if (diaSem === 6) return 'SÁBADO'
      const fixos = [[1,1],[21,4],[1,5],[7,9],[12,10],[2,11],[15,11],[20,11],[25,12]]
      if (fixos.some(([d, m]) => d === dia && m === mesD)) return 'FERIADO'
      const pascoa = calcularPascoa(anoD)
      const somarDias = (base, n) => { const r = new Date(base); r.setDate(r.getDate() + n); return r }
      const moveis = [
        somarDias(pascoa, -48), somarDias(pascoa, -47),
        somarDias(pascoa, -2),  somarDias(pascoa, 60),
      ]
      if (moveis.some(mv => mv.getFullYear() === anoD && mv.getMonth() + 1 === mesD && mv.getDate() === dia)) return 'FERIADO'
      if (Array.isArray(feriadosEstado) && feriadosEstado.some(f => f.dia === dia && f.mes === mesD)) return 'FERIADO'
      const fac = Array.isArray(facultativosEstado) && facultativosEstado.find(f => f.dia === dia && f.mes === mesD && f.ano === anoD)
      if (fac) return fac.descricao
      return null
    }

    const linhas = []
    for (let d = 1; d <= ultimoDia; d++) {
      const diaSem = new Date(anoN, mesN - 1, d).getDay()
      const nomeDia = diasSemana[diaSem]
      const tipo = getTipoDiaEstado(d, mesN, anoN)
      const isEspecial = tipo !== null
      const bgRow = (diaSem === 0 || diaSem === 6) ? 'background:#f0f0f0;' : ''
      let celulas
      if (isEspecial) {
        const txt = `<td style="text-align:center;font-size:9px;font-weight:bold;">${tipo}</td><td></td>`
        celulas = txt + txt + txt + txt
      } else {
        celulas = '<td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td>'
      }
      linhas.push(`<tr style="${bgRow}">
        <td style="text-align:center;font-weight:bold;">${d}</td>
        <td style="text-align:center;font-weight:bold;">${nomeDia}</td>
        ${celulas}
      </tr>`)
    }

    const logoUrl = `${window.location.origin}/logo.jpg`
    const html = `<!doctype html><html><head><meta charset="utf-8">
      <title>Folha de Ponto - ${srv.nome}</title>
      <style>
        body { font-family: Arial, sans-serif; font-size: 10px; margin: 3mm 8mm 8mm 8mm; color: #000; }
        .cabecalho { display: flex; align-items: flex-start; gap: 12px; margin-bottom: 4px; }
        .cabecalho img { height: 60px; }
        .cabecalho-texto { font-size: 10px; line-height: 1.6; }
        table { width: 100%; border-collapse: collapse; }
        th, td { border: 1px solid #000; padding: 2px 3px; font-size: 9px; height: 18px; }
        th { background: #e0e0e0; text-align: center; font-weight: bold; }
        td { text-align: center; }
        .assinaturas { display: flex; justify-content: space-around; margin-top: 40px; }
        .ass-linha { text-align: center; }
        .ass-linha .linha { border-top: 1px solid #000; width: 220px; margin: 0 auto; padding-top: 4px; font-size: 9px; font-weight: bold; }
        @page { size: A4 portrait; margin: 4mm 8mm 8mm 8mm; }
      </style>
    </head><body>
      <div class="cabecalho">
        <img src="${logoUrl}" onerror="this.style.display='none'" />
        <div class="cabecalho-texto">
          Avenida Sebastião de Brito, Centro, 181<br>
          Conceição do Tocantins – Tocantins &nbsp; CEP: 77.305-000<br>
          Tel.: +55 63 3381-1309<br>
          conceicaodotocantins170560@gmail.com
        </div>
      </div>

      <div style="text-align:center;font-weight:bold;font-size:9px;margin:2px 0;">FUNDO MUNICIPAL DE SAÚDE</div>
      <div style="text-align:center;font-weight:bold;font-size:9px;margin:2px 0;">PREFEITURA MUNICIPAL DE CONCEIÇÃO DO TOCANTINS</div>
      <div style="text-align:center;font-weight:bold;font-size:9px;margin:2px 0;">SECRETARIA MUNICIPAL DE SAÚDE</div>

      <div style="text-align:center;background:#d0d0d0;padding:5px;font-weight:bold;font-size:11px;margin:6px 0;border:1px solid #000;">
        FOLHA DE PONTO
      </div>

      <table style="width:100%;border-collapse:collapse;margin-bottom:4px;font-size:9px;">
        <tr>
          <td style="border:1px solid #000;padding:3px 6px;font-weight:bold;width:16%;white-space:nowrap;">SERVIDOR:</td>
          <td style="border:1px solid #000;padding:3px 6px;font-weight:bold;width:52%;">${srv.nome}</td>
          <td rowspan="3" style="border:1px solid #000;padding:3px 6px;font-weight:bold;width:32%;text-align:center;vertical-align:middle;">FREQUÊNCIA: ${nomeMes} / ${anoN}</td>
        </tr>
        <tr>
          <td style="border:1px solid #000;padding:3px 6px;font-weight:bold;white-space:nowrap;">LOTAÇÃO:</td>
          <td style="border:1px solid #000;padding:3px 6px;font-weight:bold;">FUNDO MUN. DE SAÚDE DE CONCEIÇÃO DO TO</td>
        </tr>
        <tr>
          <td style="border:1px solid #000;padding:3px 6px;font-weight:bold;white-space:nowrap;">CARGO:</td>
          <td style="border:1px solid #000;padding:3px 6px;font-weight:bold;">${srv.cargo}</td>
        </tr>
      </table>

      <table>
        <thead>
          <tr>
            <th rowspan="2" style="width:5%;">DIA</th>
            <th rowspan="2" style="width:11%;">DIAS DA<br>SEMANA</th>
            <th colspan="4" style="width:42%;">1º TURNO</th>
            <th colspan="4" style="width:42%;">2º TURNO</th>
          </tr>
          <tr>
            <th>HORA</th><th>ASSINATURA</th><th>HORA</th><th>ASSINATURA</th>
            <th>HORA</th><th>ASSINATURA</th><th>HORA</th><th>ASSINATURA</th>
          </tr>
        </thead>
        <tbody>${linhas.join('')}</tbody>
      </table>

      <div class="assinaturas">
        <div class="ass-linha"><div class="linha">Carimbo e assinatura do Servidor</div></div>
        <div class="ass-linha"><div class="linha">Carimbo e assinatura da chefia</div></div>
      </div>
    </body></html>`

    abrirImpressao(html, `Folha de Ponto — ${srv.nome} — ${nomeMes}/${anoN}`)
  }

  const inp = 'input-modern'
  const lbl = 'label-modern'

  return (
    <Layout usuario={usuario}>
      <div style={{ padding: '28px', maxWidth: '1000px', margin: '0 auto' }}>

        <div style={{ marginBottom: '24px' }}>
          <h1 style={{ fontFamily: 'Sora, sans-serif', fontSize: '22px', fontWeight: '700', color: '#0f172a', margin: '0 0 4px' }}>
            Frequência de Servidores
          </h1>
          <p style={{ color: '#000000', fontSize: '13px', margin: 0 }}>
            Folha de frequência mensal — Secretaria Municipal de Saúde
          </p>
        </div>

        {msg.txt && (
          <div className={msg.ok ? 'status-ok' : 'status-err'} style={{ marginBottom: '16px' }}>
            {msg.txt}
          </div>
        )}

        <div className="card" style={{ padding: '20px', marginBottom: '20px', border: '1px solid #bae6fd' }}>
          <h3 style={{ fontFamily: 'Sora, sans-serif', fontSize: '13px', fontWeight: '700',
            color: '#0284c7', margin: '0 0 12px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            <Settings size={13} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '6px' }} />Ações
          </h3>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center', marginBottom: '10px' }}>
            <button className="btn-primary"
              style={{ background: 'linear-gradient(135deg, #0284c7, #38bdf8)', width: '130px', whiteSpace: 'nowrap' }}
              onClick={sincronizarServidoresPortal}
              disabled={sincronizando}>
              {sincronizando ? 'Sincronizando...' : 'Sincronizar'}
            </button>
            <button className="btn-primary"
              style={{ background: 'linear-gradient(135deg, #0284c7, #38bdf8)' }}
              onClick={abrirModalCadastrar}>
              Cadastrar
            </button>
            <button className="btn-primary"
              style={{ background: 'linear-gradient(135deg, #0284c7, #38bdf8)' }}
              onClick={abrirModalAlterar}
              disabled={!servidorAtual}>
              Alterar
            </button>
            <button className="btn-danger" onClick={excluirServidor}>
              Excluir
            </button>
            <div style={{ width: '1px', height: '28px', background: '#e2e8f0' }} />
            <button className="btn-primary"
              style={{ background: 'linear-gradient(135deg, #0284c7, #38bdf8)' }}
              onClick={() => imprimirFolha(emEscala ? 'escala' : 'normal')}
              disabled={!servidorAtual}>
              Imprimir
            </button>
            <button className="btn-primary"
              style={{ background: 'linear-gradient(135deg, #0284c7, #38bdf8)' }}
              onClick={imprimirEscala}>
              Escala
            </button>
            <button className="btn-primary"
              style={{ background: 'linear-gradient(135deg, #0284c7, #38bdf8)' }}
              onClick={imprimirNormal}>
              Normal
            </button>
            <button className="btn-primary"
              style={{ background: 'linear-gradient(135deg, #0284c7, #38bdf8)' }}
              onClick={() => setModalRelatorio(true)}>
              Relatório mensal
            </button>
          </div>
          <div style={{ fontSize: '12px', color: '#475569' }}>
            {portalInfo.carregando
              ? 'Consultando data de atualização do portal...'
              : `Última atualização do portal: ${portalInfo.atualizacao || 'não disponível'}`}
          </div>
        </div>

        {/* Selecionar Servidor e Competência */}
        <div className="card" style={{ padding: '20px', marginBottom: '20px' }}>
          <h3 style={{ fontFamily: 'Sora, sans-serif', fontSize: '13px', fontWeight: '700',
            color: '#0284c7', margin: '0 0 16px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            <ClipboardList size={13} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '6px' }} />Selecionar Servidor e Competência
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 2fr', gap: '12px', alignItems: 'end' }}>
            <div>
              <label className={lbl}>Servidor (BASE FP)</label>
              <select className={inp} value={servidorId} onChange={e => setServidorId(e.target.value)}>
                <option value="">-- Selecione --</option>
                {servidores.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.nome}{s.matricula ? ` (${s.matricula})` : ''}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={lbl}>Mês</label>
              <select className={inp} value={mes} onChange={e => setMes(e.target.value)}>
                {nomesMeses.map((n, i) => (
                  <option key={i} value={String(i + 1).padStart(2, '0')}>
                    {String(i + 1).padStart(2, '0')} — {n}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={lbl}>Ano</label>
              <input className={inp} type="number" value={ano}
                onChange={e => setAno(e.target.value)} min="2020" max="2099" />
            </div>
            <div>
              <label className={lbl}>Período</label>
              <select className={inp} value={tipoPeriodo} onChange={e => setTipoPeriodo(e.target.value)}>
                <option value="competencia_23_22">23 do mês anterior a 22</option>
                <option value="mes_inteiro">Mês inteiro (01 ao último dia)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Profissionais em ESCALA */}
        <div className="card" style={{ padding: '20px', marginBottom: '20px', border: '1px solid #bae6fd' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', marginBottom: escalaAberta ? '12px' : 0 }}
            onClick={() => setEscalaAberta(v => !v)}>
            <h3 style={{ fontFamily: 'Sora, sans-serif', fontSize: '13px', fontWeight: '700',
              color: '#0284c7', margin: 0, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              <Users size={13} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '6px' }} />Profissionais em ESCALA — Folha em Branco
              <span style={{ marginLeft: '10px', fontSize: '12px', color: '#64748b', fontWeight: '400', textTransform: 'none' }}>
                ({emEscalaLista.length} profissional{emEscalaLista.length !== 1 ? 'is' : ''})
              </span>
            </h3>
            <span style={{ fontSize: '18px', color: '#0284c7', userSelect: 'none' }}>{escalaAberta ? '▲' : '▼'}</span>
          </div>

          {escalaAberta && (
            <>
              <p style={{ fontSize: '12px', color: '#64748b', margin: '0 0 12px' }}>
                Selecione o servidor acima e use os botões para incluir ou remover da lista de ESCALA.
                A lista fica salva permanentemente no sistema e é usada como critério de impressão:
                <strong> ESCALA → folha em branco</strong> | <strong>demais → folha normal (Seg–Sex + feriados)</strong>.
              </p>

              {servidorAtual && (
                <div style={{ background: '#e0f2fe', border: '1px solid #bae6fd', borderRadius: '8px',
                  padding: '8px 14px', marginBottom: '12px', fontSize: '13px', color: '#0284c7', fontWeight: '600' }}>
                  Servidor selecionado: {servidorAtual.nome} ({servidorAtual.matricula})
                  {emEscala && <span style={{ marginLeft: '12px', color: '#38bdf8' }}>✓ Em ESCALA</span>}
                </div>
              )}

              <div style={{ display: 'flex', gap: '10px', marginBottom: '14px' }}>
                <button onClick={adicionarEscala} className="btn-primary"
                  style={{ background: 'linear-gradient(135deg, #0284c7, #38bdf8)' }}>
                  + Adicionar à ESCALA
                </button>
                <button onClick={removerEscala} className="btn-danger">
                  − Remover da ESCALA
                </button>
              </div>

              <div style={{ fontSize: '13px', color: '#0284c7', marginBottom: '6px', fontWeight: '600' }}>
                {emEscalaLista.length} profissional(is) em ESCALA → receberão folha em branco:
              </div>
              <div style={{ border: '1px solid #bae6fd', borderRadius: '8px', maxHeight: '160px',
                overflowY: 'auto', background: 'white', padding: '8px 12px' }}>
                {emEscalaLista.length === 0 ? (
                  <p style={{ color: '#94a3b8', fontSize: '12px', margin: 0 }}>Nenhum servidor na ESCALA</p>
                ) : (
                  emEscalaLista.map((s, i) => (
                    <p key={s.id} style={{ margin: '2px 0', fontSize: '13px', color: '#0284c7' }}>
                      {i + 1}. {s.nome} ({s.matricula || s.id})
                    </p>
                  ))
                )}
              </div>
            </>
          )}
        </div>


        {/* ── Servidores do Estado ── */}
        <div className="card" style={{ padding: '20px', marginBottom: '20px', border: '1px solid #bae6fd' }}>
          <h3 style={{ fontFamily: 'Sora, sans-serif', fontSize: '13px', fontWeight: '700',
            color: '#0284c7', margin: '0 0 16px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            <ClipboardList size={13} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '6px' }} />Folha de Ponto — Servidores do Estado
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr auto', gap: '12px', alignItems: 'end' }}>
            <div>
              <label className={lbl}>Servidor</label>
              <select className={inp} value={servEstadoIdx} onChange={e => setServEstadoIdx(e.target.value === '' ? '' : Number(e.target.value))}>
                <option value="">— Selecione o servidor —</option>
                {SERVIDORES_ESTADO.map((s, i) => (
                  <option key={i} value={i}>{s.nome} — {s.cargo}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={lbl}>Mês</label>
              <select className={inp} value={mesEstado} onChange={e => setMesEstado(e.target.value)}>
                {nomesMeses.map((n, i) => (
                  <option key={i} value={String(i + 1).padStart(2, '0')}>
                    {String(i + 1).padStart(2, '0')} — {n}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={lbl}>Ano</label>
              <input className={inp} type="number" value={anoEstado}
                onChange={e => setAnoEstado(e.target.value)} min="2020" max="2099" />
            </div>
            <button
              className="btn-primary"
              style={{ background: 'linear-gradient(135deg, #0284c7, #38bdf8)', whiteSpace: 'nowrap' }}
              onClick={imprimirFolhaPonto}>
              <Printer size={14} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '5px' }} />Imprimir
            </button>
          </div>
          <p style={{ fontSize: '11px', color: '#64748b', margin: '10px 0 0' }}>
            Gera a folha de ponto mensal completa (mês inteiro) no formato do Estado, com dias da semana e feriados marcados automaticamente.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>

          {/* Dia Facultativo */}
          <div className="card" style={{ padding: '20px' }}>
            <h3 style={{ fontFamily: 'Sora, sans-serif', fontSize: '13px', fontWeight: '700',
              color: '#0284c7', margin: '0 0 16px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              <CalendarDays size={13} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '6px' }} />Dia Facultativo — {nomesMeses[mesNum - 1]}/{anoNum}
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr auto', gap: '8px', alignItems: 'end', marginBottom: '12px' }}>
              <div>
                <label className={lbl}>Dia</label>
                <input className={inp} type="number" min="1" max="31" placeholder="Ex.: 12"
                  value={novoFacDia} onChange={e => setNovoFacDia(e.target.value)} />
              </div>
              <div>
                <label className={lbl}>Descrição</label>
                <input className={inp} placeholder="Ex.: PONTO FACULTATIVO"
                  value={novoFacDesc} onChange={e => setNovoFacDesc(e.target.value.toUpperCase())} />
              </div>
              <button className="btn-primary" style={{ background: 'linear-gradient(135deg, #0284c7, #38bdf8)',padding: '9px 14px' }} onClick={adicionarFacultativo}>
                Adicionar
              </button>
            </div>
            <div>
              {facultativos.length === 0 ? (
                <p style={{ color: '#94a3b8', fontSize: '12px' }}>Nenhum dia facultativo cadastrado</p>
              ) : facultativos.map(f => (
                <div key={f.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '6px 10px', background: '#f8fafc', borderRadius: '6px', marginBottom: '4px', fontSize: '12px' }}>
                  <span>Dia {f.dia} — {f.descricao}</span>
                  <button className="btn-danger" style={{ padding: '3px 10px', fontSize: '11px' }}
                    onClick={() => removerFacultativo(f.id)}>Remover</button>
                </div>
              ))}
            </div>
          </div>

          {/* Feriados */}
          <div className="card" style={{ padding: '20px' }}>
            <h3 style={{ fontFamily: 'Sora, sans-serif', fontSize: '13px', fontWeight: '700',
              color: '#0284c7', margin: '0 0 16px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              <Calendar size={13} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '6px' }} />Feriados Locais — {anoNum}
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: '70px 70px 1fr auto', gap: '8px', alignItems: 'end', marginBottom: '12px' }}>
              <div>
                <label className={lbl}>Dia</label>
                <input className={inp} type="number" min="1" max="31" placeholder="Dia"
                  value={novoFerDia} onChange={e => setNovoFerDia(e.target.value)} />
              </div>
              <div>
                <label className={lbl}>Mês</label>
                <input className={inp} type="number" min="1" max="12" placeholder="Mês"
                  value={novoFerMes} onChange={e => setNovoFerMes(e.target.value)} />
              </div>
              <div>
                <label className={lbl}>Descrição</label>
                <input className={inp} placeholder="Ex.: ANIVERSÁRIO DA CIDADE"
                  value={novoFerDesc} onChange={e => setNovoFerDesc(e.target.value.toUpperCase())} />
              </div>
              <button className="btn-primary" style={{ background: 'linear-gradient(135deg, #0284c7, #38bdf8)',padding: '9px 14px' }} onClick={adicionarFeriado}>+</button>
            </div>
            <div style={{ fontSize: '11px', color: '#94a3b8', marginBottom: '8px' }}>
              * Feriados nacionais já reconhecidos automaticamente: fixos (1/1, 21/4, 1/5, 7/9, 12/10, 2/11, 15/11, 20/11, 25/12) e móveis (2ª e 3ª de Carnaval, Sexta-feira Santa, Corpus Christi)
            </div>
            <div>
              {feriados.length === 0 ? (
                <p style={{ color: '#94a3b8', fontSize: '12px' }}>Nenhum feriado local cadastrado</p>
              ) : feriados.map(f => (
                <div key={f.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '6px 10px', background: '#f8fafc', borderRadius: '6px', marginBottom: '4px', fontSize: '12px' }}>
                  <span>{String(f.dia).padStart(2,'0')}/{String(f.mes).padStart(2,'0')} — {f.descricao}</span>
                  <button className="btn-danger" style={{ padding: '3px 10px', fontSize: '11px' }}
                    onClick={() => removerFeriado(f.id)}>×</button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Modal Cadastrar Servidor */}
      {modalCadastro && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }}>
          <div style={{
            background: 'white', borderRadius: '16px', padding: '32px',
            width: '100%', maxWidth: '480px', boxShadow: '0 20px 60px rgba(0,0,0,0.3)'
          }}>
            <h2 style={{ fontFamily: 'Sora, sans-serif', fontSize: '18px', fontWeight: '700',
              color: '#0f172a', margin: '0 0 24px' }}>
              {modalModo === 'alterar' ? 'Alterar Servidor' : 'Cadastrar Servidor'}
            </h2>

            <form onSubmit={salvarServidor} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

              <div>
                <label className={lbl}>NOME</label>
                <input className={inp} placeholder="Nome completo do servidor"
                  value={formCadastro.nome}
                  onChange={e => setFormCadastro(f => ({ ...f, nome: e.target.value }))} />
              </div>

              <div>
                <label className={lbl}>FUNÇÃO / CARGO</label>
                <input className={inp} placeholder="Digite ou selecione um cargo"
                  list="lista-funcoes"
                  value={formCadastro.funcao}
                  onChange={e => setFormCadastro(f => ({ ...f, funcao: e.target.value }))} />
                <datalist id="lista-funcoes">
                  {funcoesExistentes.map(fn => <option key={fn} value={fn} />)}
                </datalist>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label className={lbl}>MATRÍCULA</label>
                  <input className={inp} placeholder="Ex.: 3705"
                    value={formCadastro.matricula}
                    onChange={e => setFormCadastro(f => ({ ...f, matricula: e.target.value }))} />
                </div>
                <div>
                  <label className={lbl}>NÍVEL</label>
                  <select className={inp} value={formCadastro.nivel}
                    onChange={e => setFormCadastro(f => ({ ...f, nivel: e.target.value }))}>
                    <option value="EFETIVO">EFETIVO</option>
                    <option value="CONTRATO">CONTRATO</option>
                    <option value="COMISSÃO">COMISSÃO</option>
                    <option value="PRESTADOR">PRESTADOR</option>
                  </select>
                </div>
              </div>

              <div>
                <label className={lbl}>SITUAÇÃO</label>
                <select className={inp} value={formCadastro.situacao}
                  onChange={e => setFormCadastro(f => ({ ...f, situacao: e.target.value }))}>
                  <option value="">— Não informado —</option>
                  <option value="Afastado">Afastado</option>
                  <option value="Atestado">Atestado</option>
                  <option value="Ativo">Ativo</option>
                  <option value="Férias">Férias</option>
                  <option value="Inativo">Inativo</option>
                  <option value="Licença">Licença</option>
                </select>
              </div>

              <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
                <button type="button" className="btn-secondary" style={{ flex: 1 }}
                  onClick={() => { setModalCadastro(false); setFormCadastro({ nome: '', funcao: '', matricula: '', nivel: 'EFETIVO', situacao: '' }) }}>
                  CANCELAR
                </button>
                <button type="submit" className="btn-primary" style={{ flex: 1 }}
                  disabled={salvandoCadastro}>
                  {salvandoCadastro
                    ? (modalModo === 'alterar' ? 'SALVANDO...' : 'CADASTRANDO...')
                    : (modalModo === 'alterar' ? 'SALVAR ALTERAÇÕES' : 'CADASTRAR')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Relatório Mensal */}
      {modalRelatorio && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }}>
          <div style={{
            background: 'white', borderRadius: '16px', padding: '32px',
            width: '100%', maxWidth: '420px', boxShadow: '0 20px 60px rgba(0,0,0,0.3)'
          }}>
            <h2 style={{ fontFamily: 'Sora, sans-serif', fontSize: '18px', fontWeight: '700',
              color: '#0f172a', margin: '0 0 8px' }}>Relatório Mensal</h2>
            <p style={{ fontSize: '13px', color: '#64748b', margin: '0 0 24px' }}>
              Selecione o grupo que deseja imprimir:
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '28px' }}>
              {[
                { valor: 'com_matricula', titulo: 'Servidores', desc: 'Todos os servidores com matrícula cadastrada' },
                { valor: 'prestadores',   titulo: 'Prestadores', desc: 'Profissionais sem matrícula no sistema' },
              ].map(op => (
                <label key={op.valor} style={{
                  display: 'flex', alignItems: 'flex-start', gap: '12px',
                  padding: '14px 16px', borderRadius: '10px', cursor: 'pointer',
                  border: `2px solid ${grupoRelatorio === op.valor ? '#0284c7' : '#e2e8f0'}`,
                  background: grupoRelatorio === op.valor ? '#e0f2fe' : '#f8fafc',
                  transition: 'all 0.15s'
                }}>
                  <input type="radio" name="grupo" value={op.valor}
                    checked={grupoRelatorio === op.valor}
                    onChange={() => setGrupoRelatorio(op.valor)}
                    style={{ marginTop: '2px', accentColor: '#0284c7' }} />
                  <div>
                    <p style={{ margin: '0 0 2px', fontWeight: '700', fontSize: '13px',
                      color: '#0f172a', fontFamily: 'Sora, sans-serif' }}>{op.titulo}</p>
                    <p style={{ margin: 0, fontSize: '12px', color: '#64748b' }}>{op.desc}</p>
                  </div>
                </label>
              ))}
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
              <button className="btn-secondary" style={{ flex: 1 }}
                onClick={() => setModalRelatorio(false)}>
                CANCELAR
              </button>
              <button className="btn-primary"
                style={{ flex: 1, background: 'linear-gradient(135deg, #0284c7, #38bdf8)' }}
                onClick={imprimirRelatorioMensal}>
                IMPRIMIR
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  )
}
