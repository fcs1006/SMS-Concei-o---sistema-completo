'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Layout from '@/components/Layout'
import { abrirJanelaImpressao } from '@/lib/printHeader'

const COR = '#818cf8'
const COR_BG = 'rgba(129,140,248,0.15)'
const GRAD = 'linear-gradient(135deg, #4f46e5, #818cf8)'

const UNIDADES = ['un', 'cx', 'pct', 'kg', 'g', 'L', 'mL', 'rolo', 'par', 'resma', 'frasco', 'ampola', 'blister']

const DIAS_ALERTA_VENCIMENTO = 30

const FORM_PRODUTO_VAZIO = {
  nome: '', codigo_barras: '', unidade: 'un', quantidade_atual: '',
  quantidade_minima: '', categoria_id: '', descricao: '', localizacao: '',
  data_validade: ''
}

function diasParaVencer(dataValidade) {
  if (!dataValidade) return null
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0)
  const val = new Date(dataValidade + 'T00:00:00')
  return Math.floor((val - hoje) / 86400000)
}

function statusValidade(dataValidade) {
  const dias = diasParaVencer(dataValidade)
  if (dias === null) return null
  if (dias < 0)  return { label: 'Vencido',          cor: '#ef4444', bg: 'rgba(239,68,68,0.1)',   dias }
  if (dias === 0) return { label: 'Vence hoje',       cor: '#ef4444', bg: 'rgba(239,68,68,0.1)',   dias }
  if (dias <= DIAS_ALERTA_VENCIMENTO) return { label: `Vence em ${dias}d`, cor: '#f59e0b', bg: 'rgba(245,158,11,0.1)', dias }
  return { label: `Válido (${dias}d)`, cor: '#10b981', bg: 'rgba(16,185,129,0.1)', dias }
}
const DESTINOS_SAIDA = ['Abilio', 'Academia', 'Farmácia', 'Francisco', 'Laboratório', 'Secretaria', 'Urgência', 'Vigilancia', 'Outro setor']
const ORIGENS_ENTRADA = ['Compra', 'Doação', 'Transferência interna', 'Devolução', 'Outro']

const FORM_MOV_VAZIO = { tipo: 'entrada', quantidade: '', motivo: '', produto_id: '', destino: '', observacao: '' }

function badgeCategoria(cat) {
  if (!cat) return null
  return (
    <span style={{
      background: (cat.cor || '#6b7280') + '22',
      color: cat.cor || '#6b7280',
      border: `1px solid ${cat.cor || '#6b7280'}44`,
      borderRadius: '6px', padding: '2px 8px',
      fontSize: '11px', fontWeight: '600', whiteSpace: 'nowrap'
    }}>{cat.nome}</span>
  )
}

function chipTipo(tipo) {
  const cfg = {
    entrada: { bg: 'rgba(16,185,129,0.12)', cor: '#10b981', label: '▲ Entrada' },
    saida:   { bg: 'rgba(239,68,68,0.12)',  cor: '#ef4444', label: '▼ Saída' },
    ajuste:  { bg: 'rgba(245,158,11,0.12)', cor: '#f59e0b', label: '⟳ Ajuste' },
  }
  const c = cfg[tipo] || cfg.ajuste
  return (
    <span style={{ background: c.bg, color: c.cor, borderRadius: '6px', padding: '2px 10px', fontSize: '12px', fontWeight: '600' }}>
      {c.label}
    </span>
  )
}

function statusEstoque(prod) {
  if (!prod.ativo) return { label: 'Inativo', cor: '#6b7280', bg: 'rgba(107,114,128,0.1)' }
  if (prod.quantidade_atual <= 0) return { label: 'Zerado', cor: '#ef4444', bg: 'rgba(239,68,68,0.1)' }
  if (prod.quantidade_atual <= prod.quantidade_minima) return { label: 'Crítico', cor: '#f59e0b', bg: 'rgba(245,158,11,0.1)' }
  return { label: 'OK', cor: '#10b981', bg: 'rgba(16,185,129,0.1)' }
}

export default function Almoxarifado() {
  const router = useRouter()
  const [usuario, setUsuario] = useState(null)
  const [aba, setAba] = useState('dashboard')
  const [carregando, setCarregando] = useState(true)

  // Dashboard
  const [stats, setStats] = useState({ total: 0, criticos: 0, zerados: 0, entradasHoje: 0, saidasHoje: 0, vencendo: 0, vencidos: 0 })
  const [alertasVencimento, setAlertasVencimento] = useState([])
  const [alertas, setAlertas] = useState([])
  const [ultimasMovs, setUltimasMovs] = useState([])

  // Produtos
  const [produtos, setProdutos] = useState([])
  const [categorias, setCategorias] = useState([])
  const [busca, setBusca] = useState('')
  const [filtroCat, setFiltroCat] = useState('')
  const [filtroAtivo, setFiltroAtivo] = useState('true')

  // Modal produto
  const [modalProduto, setModalProduto] = useState(false)
  const [editandoProduto, setEditandoProduto] = useState(null)
  const [formProduto, setFormProduto] = useState(FORM_PRODUTO_VAZIO)
  const [salvandoProduto, setSalvandoProduto] = useState(false)
  const [erroProduto, setErroProduto] = useState('')

  // Modal categoria
  const [modalCategoria, setModalCategoria] = useState(false)
  const [formCategoria, setFormCategoria] = useState({ nome: '', cor: '#6366f1' })
  const [editandoCategoria, setEditandoCategoria] = useState(null)
  const [salvandoCat, setSalvandoCat] = useState(false)

  // Movimentações
  const [movimentacoes, setMovimentacoes] = useState([])
  const [filtroMov, setFiltroMov] = useState({ tipo: '', produto_id: '', de: '', ate: '' })
  const [carregandoMovs, setCarregandoMovs] = useState(false)

  // Modal movimentação
  const [modalMov, setModalMov] = useState(false)
  const [formMov, setFormMov] = useState(FORM_MOV_VAZIO)
  const [produtoMovendo, setProdutoMovendo] = useState(null)
  const [salvandoMov, setSalvandoMov] = useState(false)
  const [erroMov, setErroMov] = useState('')

  // Relatório
  const [relTipo, setRelTipo] = useState('estoque')
  const [relDe, setRelDe] = useState('')
  const [relAte, setRelAte] = useState('')
  const [relCategoria, setRelCategoria] = useState('')
  const [relDados, setRelDados] = useState(null)
  const [gerandoRel, setGerandoRel] = useState(false)

  // Scanner
  const videoRef = useRef(null)
  const scanTimerRef = useRef(null)
  const detectorRef = useRef(null)
  const streamRef = useRef(null)
  const [scannerAtivo, setScannerAtivo] = useState(false)
  const [barcodeSuportado, setBarcodeSuportado] = useState(false)
  const [erroCamera, setErroCamera] = useState('')
  const [codigoManual, setCodigoManual] = useState('')
  const [produtoScaneado, setProdutoScaneado] = useState(null)
  const [buscandoCodigo, setBuscandoCodigo] = useState(false)
  const [scanFlash, setScanFlash] = useState(false)

  // ─── Init ──────────────────────────────────────────────────────────────
  useEffect(() => {
    const u = localStorage.getItem('sms_user')
    if (!u) { router.push('/'); return }
    setUsuario(JSON.parse(u))
    setBarcodeSuportado('BarcodeDetector' in window)
    carregarTudo()
  }, [])

  useEffect(() => {
    if (aba !== 'scanner') pararCamera()
  }, [aba])

  // Recarrega categorias sempre que o modal de produto abrir
  useEffect(() => {
    if (modalProduto) carregarCategorias()
  }, [modalProduto])

  useEffect(() => {
    return () => pararCamera()
  }, [])

  // ─── Dados ─────────────────────────────────────────────────────────────
  async function carregarTudo() {
    setCarregando(true)
    // Executa independentemente — falha em uma não cancela as outras
    await Promise.allSettled([carregarCategorias(), carregarProdutos(), carregarDashboard(), carregarMovimentacoes()])
    setCarregando(false)
  }

  async function carregarCategorias() {
    try {
      const res = await fetch('/api/almoxarifado/categorias')
      if (!res.ok) return
      const json = await res.json()
      if (json.ok && Array.isArray(json.data)) setCategorias(json.data)
    } catch (_) {}
  }

  async function carregarProdutos(params = {}) {
    const qs = new URLSearchParams()
    if (params.busca ?? busca) qs.set('busca', params.busca ?? busca)
    if (params.categoria ?? filtroCat) qs.set('categoria', params.categoria ?? filtroCat)
    const ativoVal = params.ativo ?? filtroAtivo
    if (ativoVal !== '') qs.set('ativo', ativoVal)

    const res = await fetch('/api/almoxarifado/produtos?' + qs)
    const json = await res.json()
    if (json.ok) setProdutos(json.data)
  }

  async function carregarDashboard() {
    const hoje = new Date().toISOString().split('T')[0]

    // Um único fetch para todos os produtos (usa service role, sem problema de RLS)
    const [resProds, reMovs] = await Promise.all([
      fetch('/api/almoxarifado/produtos?ativo=true'),
      fetch('/api/almoxarifado/movimentacoes?de=' + hoje + '&limit=200')
    ])
    const jsonProds = await resProds.json()
    const jsonMovs  = await reMovs.json()

    const todosProdos = jsonProds.ok ? jsonProds.data : []
    const movsHoje    = jsonMovs.ok  ? jsonMovs.data  : []

    const total       = todosProdos.length
    const criticos    = todosProdos.filter(p => p.quantidade_atual > 0 && p.quantidade_atual <= p.quantidade_minima).length
    const zerados     = todosProdos.filter(p => p.quantidade_atual <= 0).length
    const entradasHoje = movsHoje.filter(m => m.tipo === 'entrada').length
    const saidasHoje   = movsHoje.filter(m => m.tipo === 'saida').length

    setAlertas(todosProdos.filter(p => p.quantidade_atual <= p.quantidade_minima))

    const vencAlertas = todosProdos.filter(p => {
      const dias = diasParaVencer(p.data_validade)
      return dias !== null && dias <= DIAS_ALERTA_VENCIMENTO
    })
    const vencidos = vencAlertas.filter(p => diasParaVencer(p.data_validade) < 0).length
    const vencendo = vencAlertas.filter(p => diasParaVencer(p.data_validade) >= 0).length

    setAlertasVencimento(vencAlertas)
    setStats({ total, criticos, zerados, entradasHoje, saidasHoje, vencendo, vencidos })

    // últimas movimentações recentes via supabase (apenas leitura, ok se RLS permitir ou for desabilitado)
    const { data: recentes } = await supabase
      .from('movimentacoes_estoque')
      .select('*, produtos_estoque(nome, unidade)')
      .order('created_at', { ascending: false })
      .limit(15)
    setUltimasMovs(recentes || [])
  }

  async function carregarMovimentacoes(params = {}) {
    setCarregandoMovs(true)
    const qs = new URLSearchParams({ limit: '200' })
    const f = { ...filtroMov, ...params }
    if (f.tipo) qs.set('tipo', f.tipo)
    if (f.produto_id) qs.set('produto_id', f.produto_id)
    if (f.de) qs.set('de', f.de)
    if (f.ate) qs.set('ate', f.ate)

    const res = await fetch('/api/almoxarifado/movimentacoes?' + qs)
    const json = await res.json()
    if (json.ok) setMovimentacoes(json.data)
    setCarregandoMovs(false)
  }

  // ─── Produtos CRUD ─────────────────────────────────────────────────────
  function abrirNovoProduto() {
    setEditandoProduto(null)
    setFormProduto(FORM_PRODUTO_VAZIO)
    setErroProduto('')
    setModalProduto(true)
  }

  function abrirEditarProduto(p) {
    setEditandoProduto(p)
    setFormProduto({
      nome: p.nome || '',
      codigo_barras: p.codigo_barras || '',
      unidade: p.unidade || 'un',
      quantidade_atual: String(p.quantidade_atual ?? ''),
      quantidade_minima: String(p.quantidade_minima ?? ''),
      categoria_id: p.categoria_id || '',
      descricao: p.descricao || '',
      localizacao: p.localizacao || '',
      data_validade: p.data_validade || '',
    })
    setErroProduto('')
    setModalProduto(true)
  }

  async function salvarProduto() {
    if (!formProduto.nome.trim()) { setErroProduto('Nome é obrigatório'); return }
    if (!formProduto.unidade) { setErroProduto('Unidade é obrigatória'); return }
    if (!editandoProduto && (formProduto.quantidade_atual === '' || formProduto.quantidade_atual === null)) { setErroProduto('Quantidade inicial é obrigatória'); return }
    if (formProduto.quantidade_minima === '' || formProduto.quantidade_minima === null) { setErroProduto('Quantidade mínima é obrigatória'); return }
    if (!formProduto.categoria_id) { setErroProduto('Categoria é obrigatória'); return }
    setSalvandoProduto(true); setErroProduto('')
    try {
      const payload = { ...formProduto }
      if (editandoProduto) payload.id = editandoProduto.id
      const res = await fetch('/api/almoxarifado/produtos', {
        method: editandoProduto ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      const json = await res.json()
      if (!json.ok) { setErroProduto(json.error); return }
      setModalProduto(false)
      await Promise.all([carregarProdutos(), carregarDashboard()])
    } finally { setSalvandoProduto(false) }
  }

  async function inativarProduto(p) {
    if (!confirm(`Desativar "${p.nome}"?`)) return
    await fetch('/api/almoxarifado/produtos', {
      method: 'DELETE', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: p.id })
    })
    await Promise.all([carregarProdutos(), carregarDashboard()])
  }

  async function reativarProduto(p) {
    await fetch('/api/almoxarifado/produtos', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...p, id: p.id, ativo: true, categoria_id: p.categoria_id || null })
    })
    await Promise.all([carregarProdutos(), carregarDashboard()])
  }

  // ─── Categorias ────────────────────────────────────────────────────────
  function abrirNovaCategoria() {
    setEditandoCategoria(null)
    setFormCategoria({ nome: '', cor: '#6366f1' })
    setModalCategoria(true)
  }

  function abrirEditarCategoria(cat) {
    setEditandoCategoria(cat)
    setFormCategoria({ nome: cat.nome, cor: cat.cor || '#6366f1' })
    setModalCategoria(true)
  }

  async function salvarCategoria() {
    if (!formCategoria.nome.trim()) return
    setSalvandoCat(true)
    try {
      const res = await fetch('/api/almoxarifado/categorias', {
        method: editandoCategoria ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editandoCategoria ? { ...formCategoria, id: editandoCategoria.id } : formCategoria)
      })
      const json = await res.json()
      if (!json.ok) { alert('Erro ao salvar categoria: ' + json.error); setSalvandoCat(false); return }
    } catch(e) { alert('Erro de rede: ' + e.message); setSalvandoCat(false); return }
    setSalvandoCat(false)
    setModalCategoria(false)
    setEditandoCategoria(null)
    setFormCategoria({ nome: '', cor: '#6366f1' })
    await carregarCategorias()
  }

  async function excluirCategoria(cat) {
    if (!confirm(`Excluir a categoria "${cat.nome}"?\n\nOs produtos vinculados ficarão sem categoria.`)) return
    const res = await fetch('/api/almoxarifado/categorias', {
      method: 'DELETE', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: cat.id })
    })
    const json = await res.json()
    if (!json.ok) { alert('Erro ao excluir: ' + json.error); return }
    await Promise.all([carregarCategorias(), carregarProdutos()])
  }

  // ─── Movimentação ──────────────────────────────────────────────────────
  function abrirMovimentacao(produto, tipo = 'entrada') {
    setProdutoMovendo(produto)
    setFormMov({ tipo, quantidade: '', motivo: '', produto_id: produto.id })
    setErroMov('')
    setModalMov(true)
  }

  async function registrarMovimentacao() {
    if (!formMov.quantidade || Number(formMov.quantidade) <= 0) {
      setErroMov('Informe uma quantidade válida'); return
    }
    setSalvandoMov(true); setErroMov('')
    try {
      const res = await fetch('/api/almoxarifado/movimentacoes', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...formMov, usuario_nome: usuario?.nome || '', destino: formMov.destino, observacao: formMov.observacao })
      })
      const json = await res.json()
      if (!json.ok) { setErroMov(json.error); return }
      setModalMov(false)
      setProdutoScaneado(null)
      await Promise.all([carregarProdutos(), carregarDashboard(), carregarMovimentacoes()])
    } finally { setSalvandoMov(false) }
  }

  // ─── Relatório ─────────────────────────────────────────────────────────
  async function gerarRelatorio() {
    setGerandoRel(true)
    setRelDados([])
    try {
      const tiposProduto = ['estoque', 'vencendo', 'vencidos', 'criticos', 'zerados']
      if (tiposProduto.includes(relTipo)) {
        const qs = new URLSearchParams({ ativo: 'true' })
        if (relCategoria) qs.set('categoria', relCategoria)
        const res = await fetch('/api/almoxarifado/produtos?' + qs)
        const json = await res.json()
        let dados = json.ok ? json.data : []
        if (relTipo === 'vencendo') dados = dados.filter(p => { const d = diasParaVencer(p.data_validade); return d !== null && d >= 0 && d <= DIAS_ALERTA_VENCIMENTO })
        if (relTipo === 'vencidos') dados = dados.filter(p => { const d = diasParaVencer(p.data_validade); return d !== null && d < 0 })
        if (relTipo === 'criticos') dados = dados.filter(p => p.quantidade_atual > 0 && p.quantidade_atual <= p.quantidade_minima)
        if (relTipo === 'zerados')  dados = dados.filter(p => p.quantidade_atual <= 0)
        setRelDados(dados)
      } else {
        const qs = new URLSearchParams({ limit: '1000' })
        if (relDe)  qs.set('de', relDe)
        if (relAte) qs.set('ate', relAte)
        const res = await fetch('/api/almoxarifado/movimentacoes?' + qs)
        const json = await res.json()
        setRelDados(json.ok ? json.data : [])
      }
    } finally { setGerandoRel(false) }
  }

  function imprimirRelatorio() {
    const hoje = new Date().toLocaleDateString('pt-BR')
    const periodo = relDe || relAte
      ? `Período: ${relDe ? new Date(relDe + 'T12:00:00').toLocaleDateString('pt-BR') : '—'} a ${relAte ? new Date(relAte + 'T12:00:00').toLocaleDateString('pt-BR') : '—'}`
      : `Emitido em: ${hoje}`

    const titulosRel = {
      estoque:       'RELATÓRIO DE ESTOQUE ATUAL',
      movimentacoes: 'RELATÓRIO DE MOVIMENTAÇÕES',
      consolidado:   'RELATÓRIO CONSOLIDADO POR PRODUTO',
      vencendo:      'PRODUTOS VENCENDO EM 30 DIAS',
      vencidos:      'PRODUTOS VENCIDOS',
      criticos:      'ESTOQUE CRÍTICO — ABAIXO DO MÍNIMO',
      zerados:       'PRODUTOS COM ESTOQUE ZERADO',
    }
    const titulo = titulosRel[relTipo]

    let corpo = ''

    if (relTipo === 'estoque') {
      // agrupa por categoria
      const grupos = {}
      relDados.forEach(p => {
        const cat = p.categorias_estoque?.nome || 'Sem categoria'
        if (!grupos[cat]) grupos[cat] = []
        grupos[cat].push(p)
      })
      let totalProd = 0
      Object.entries(grupos).sort().forEach(([cat, prods]) => {
        corpo += `<tr class="grupo"><td colspan="6">${cat}</td></tr>`
        prods.forEach(p => {
          const st = statusEstoqueTexto(p)
          const sv = p.data_validade ? statusValidadeTexto(p.data_validade) : ''
          const dataFmt = p.data_validade ? new Date(p.data_validade + 'T12:00:00').toLocaleDateString('pt-BR') : '—'
          corpo += `<tr>
            <td>${p.nome}</td>
            <td>${p.categorias_estoque?.nome || '—'}</td>
            <td style="text-align:center">${p.unidade}</td>
            <td style="text-align:right;font-weight:700;color:${st.cor}">${p.quantidade_atual}</td>
            <td style="text-align:right">${p.quantidade_minima}</td>
            <td style="text-align:center">${dataFmt}${sv ? ' ' + sv : ''}</td>
          </tr>`
          totalProd++
        })
      })
      corpo = `
        <table>
          <thead><tr>
            <th>Produto</th><th>Categoria</th>
            <th style="text-align:center">Unid.</th>
            <th style="text-align:right">Estoque</th>
            <th style="text-align:right">Mínimo</th>
            <th style="text-align:center">Vencimento</th>
          </tr></thead>
          <tbody>${corpo}</tbody>
        </table>
        <p style="margin-top:12px;font-size:12px"><strong>Total de produtos: ${totalProd}</strong></p>`
    }

    else if (relTipo === 'movimentacoes') {
      const entradas = relDados.filter(m => m.tipo === 'entrada').length
      const saidas   = relDados.filter(m => m.tipo === 'saida').length
      const ajustes  = relDados.filter(m => m.tipo === 'ajuste').length
      relDados.forEach(m => {
        const tipo = m.tipo === 'entrada' ? '▲ Entrada' : m.tipo === 'saida' ? '▼ Saída' : '⟳ Ajuste'
        const cor  = m.tipo === 'entrada' ? '#16a34a'  : m.tipo === 'saida'  ? '#dc2626' : '#ca8a04'
        corpo += `<tr>
          <td style="white-space:nowrap">${new Date(m.created_at).toLocaleString('pt-BR')}</td>
          <td>${m.produtos_estoque?.nome || '—'}</td>
          <td style="color:${cor};font-weight:700">${tipo}</td>
          <td style="text-align:right">${m.quantidade_antes}</td>
          <td style="text-align:right;font-weight:700;color:${cor}">${m.tipo === 'saida' ? '−' : '+'}${m.quantidade}</td>
          <td style="text-align:right">${m.quantidade_depois}</td>
          <td>${m.destino || m.motivo || '—'}</td>
          <td>${m.observacao || '—'}</td>
          <td>${m.usuario_nome || '—'}</td>
        </tr>`
      })
      corpo = `
        <table>
          <thead><tr>
            <th>Data/Hora</th><th>Produto</th><th>Tipo</th>
            <th style="text-align:right">Antes</th>
            <th style="text-align:right">Qtd</th>
            <th style="text-align:right">Depois</th>
            <th>Origem/Destino</th><th>Observação</th><th>Usuário</th>
          </tr></thead>
          <tbody>${corpo}</tbody>
        </table>
        <p style="margin-top:12px;font-size:12px">
          <strong>Total: ${relDados.length} registros</strong> &nbsp;|&nbsp;
          Entradas: ${entradas} &nbsp;|&nbsp; Saídas: ${saidas} &nbsp;|&nbsp; Ajustes: ${ajustes}
        </p>`
    }

    else if (relTipo === 'consolidado') {
      const mapa = {}
      relDados.forEach(m => {
        const nome = m.produtos_estoque?.nome || '—'
        if (!mapa[nome]) mapa[nome] = { entradas: 0, saidas: 0, ajustes: 0 }
        if (m.tipo === 'entrada') mapa[nome].entradas += Number(m.quantidade)
        else if (m.tipo === 'saida') mapa[nome].saidas += Number(m.quantidade)
        else mapa[nome].ajustes += Number(m.quantidade)
      })
      Object.entries(mapa).sort().forEach(([nome, v]) => {
        corpo += `<tr>
          <td>${nome}</td>
          <td style="text-align:right;color:#16a34a;font-weight:700">${v.entradas}</td>
          <td style="text-align:right;color:#dc2626;font-weight:700">${v.saidas}</td>
          <td style="text-align:right;color:#ca8a04">${v.ajustes}</td>
          <td style="text-align:right;font-weight:700">${v.entradas - v.saidas}</td>
        </tr>`
      })
      corpo = `
        <table>
          <thead><tr>
            <th>Produto</th>
            <th style="text-align:right">Entradas</th>
            <th style="text-align:right">Saídas</th>
            <th style="text-align:right">Ajustes</th>
            <th style="text-align:right">Saldo período</th>
          </tr></thead>
          <tbody>${corpo}</tbody>
        </table>
        <p style="margin-top:12px;font-size:12px"><strong>Total de produtos movimentados: ${Object.keys(mapa).length}</strong></p>`
    }

    // Relatórios de alertas (vencendo, vencidos, críticos, zerados)
    else if (['vencendo', 'vencidos', 'criticos', 'zerados'].includes(relTipo)) {
      relDados.forEach(p => {
        const sv = p.data_validade ? statusValidadeTexto(p.data_validade) : ''
        const corQtd = relTipo === 'criticos' ? '#ca8a04' : relTipo === 'zerados' ? '#dc2626' : '#1e293b'
        const dataFmt = p.data_validade ? new Date(p.data_validade + 'T12:00:00').toLocaleDateString('pt-BR') : '—'
        corpo += `<tr>
          <td>${p.nome}</td>
          <td>${p.categorias_estoque?.nome || '—'}</td>
          <td style="text-align:center">${p.unidade}</td>
          <td style="text-align:right;font-weight:700;color:${corQtd}">${p.quantidade_atual}</td>
          <td style="text-align:right">${p.quantidade_minima}</td>
          <td style="text-align:center">${dataFmt}${sv ? ' ' + sv : ''}</td>
        </tr>`
      })
      corpo = `
        <table>
          <thead><tr>
            <th>Produto</th><th>Categoria</th>
            <th style="text-align:center">Unid.</th>
            <th style="text-align:right">Estoque atual</th>
            <th style="text-align:right">Mínimo</th>
            <th style="text-align:center">Vencimento</th>
          </tr></thead>
          <tbody>${corpo}</tbody>
        </table>
        <p style="margin-top:12px;font-size:12px"><strong>Total: ${relDados.length} produto(s)</strong></p>`
    }

    abrirJanelaImpressao(titulo, `
      <style>
        body { font-size: 12px; }
        h2 { font-size: 14px; }
        table { table-layout: auto; width: 100%; border-collapse: collapse; margin-top: 6px; }
        th { background: #dde3f0; font-size: 12px; padding: 4px 6px; border: 1px solid #aaa; text-align: left; text-transform: uppercase; white-space: nowrap; }
        td { font-size: 12px; padding: 3px 6px; border: 1px solid #ccc; vertical-align: middle; }
        tr:nth-child(even) td { background: #f7f8fc; }
        tr.grupo td { background: #e8ecf8; font-weight: 700; font-size: 12px; color: #2d3a8c; border-top: 2px solid #aab; padding: 4px 6px; }
        td[style*="text-align:right"], th[style*="text-align:right"] { text-align: right; }
        td[style*="text-align:center"], th[style*="text-align:center"] { text-align: center; }
        p { font-size: 12px; margin: 6px 0 0; }
        @page { size: A4 landscape; margin: 8mm; }
      </style>
      <h2 style="font-weight:700;text-align:center;margin:8px 0 2px;text-transform:uppercase">${titulo}</h2>
      <p style="text-align:center;color:#555;margin:0 0 8px">${periodo}</p>
      ${corpo}
    `)
  }

  function statusEstoqueTexto(p) {
    if (p.quantidade_atual <= 0) return { cor: '#dc2626', label: 'Zerado' }
    if (p.quantidade_atual <= p.quantidade_minima) return { cor: '#ca8a04', label: 'Crítico' }
    return { cor: '#16a34a', label: 'OK' }
  }

  function statusValidadeTexto(dataValidade) {
    const dias = diasParaVencer(dataValidade)
    if (dias === null) return ''
    if (dias < 0) return `<span style="color:#dc2626;font-weight:700">VENCIDO</span>`
    if (dias === 0) return `<span style="color:#dc2626;font-weight:700">Vence hoje</span>`
    if (dias <= DIAS_ALERTA_VENCIMENTO) return `<span style="color:#ca8a04;font-weight:700">Vence em ${dias}d</span>`
    return ''
  }

  // ─── Scanner ───────────────────────────────────────────────────────────
  async function iniciarCamera() {
    setErroCamera('')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 } }
      })
      streamRef.current = stream
      videoRef.current.srcObject = stream
      await videoRef.current.play()
      setScannerAtivo(true)

      if ('BarcodeDetector' in window) {
        detectorRef.current = new window.BarcodeDetector({
          formats: ['ean_13', 'ean_8', 'code_128', 'code_39', 'upc_a', 'upc_e', 'qr_code', 'code_93']
        })
        iniciarLoop()
      }
    } catch (e) {
      setErroCamera('Câmera não disponível: ' + e.message)
    }
  }

  const iniciarLoop = useCallback(() => {
    const loop = async () => {
      if (!videoRef.current || videoRef.current.readyState < 2 || !detectorRef.current) {
        scanTimerRef.current = setTimeout(loop, 300)
        return
      }
      try {
        const barcodes = await detectorRef.current.detect(videoRef.current)
        if (barcodes.length > 0) {
          pararCamera()
          await handleCodigoDetectado(barcodes[0].rawValue)
          return
        }
      } catch (_) {}
      scanTimerRef.current = setTimeout(loop, 200)
    }
    loop()
  }, [])

  function pararCamera() {
    if (scanTimerRef.current) clearTimeout(scanTimerRef.current)
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop())
      streamRef.current = null
    }
    if (videoRef.current) videoRef.current.srcObject = null
    setScannerAtivo(false)
  }

  async function handleCodigoDetectado(codigo) {
    setScanFlash(true)
    setTimeout(() => setScanFlash(false), 500)
    setCodigoManual(codigo)
    await buscarPorCodigo(codigo)
  }

  async function buscarPorCodigo(codigo) {
    if (!codigo.trim()) return
    setBuscandoCodigo(true)
    setProdutoScaneado(null)
    const res = await fetch('/api/almoxarifado/produtos?codigo=' + encodeURIComponent(codigo.trim()))
    const json = await res.json()
    setBuscandoCodigo(false)
    if (json.ok && json.data?.length > 0) {
      setProdutoScaneado(json.data[0])
    } else {
      setProdutoScaneado({ _naoEncontrado: true, codigo })
    }
  }

  function reiniciarScanner() {
    setProdutoScaneado(null)
    setCodigoManual('')
    if (aba === 'scanner') iniciarCamera()
  }

  // ─── Helpers UI ────────────────────────────────────────────────────────
  const produtosFiltrados = produtos.filter(p => {
    if (busca && !p.nome.toLowerCase().includes(busca.toLowerCase()) &&
        !(p.codigo_barras || '').includes(busca)) return false
    if (filtroCat && p.categoria_id !== filtroCat) return false
    return true
  })

  function formatarDataHora(iso) {
    if (!iso) return '-'
    const d = new Date(iso)
    return d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  }

  const estiloAba = (a) => ({
    padding: '10px 20px', borderRadius: '10px 10px 0 0',
    border: 'none', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif',
    fontSize: '13px', fontWeight: aba === a ? '700' : '500',
    background: aba === a ? 'white' : 'transparent',
    color: aba === a ? '#4f46e5' : '#64748b',
    borderBottom: aba === a ? '2px solid #4f46e5' : '2px solid transparent',
    transition: 'all 0.2s'
  })

  const btnPrimary = {
    background: GRAD, color: 'white', border: 'none',
    borderRadius: '10px', padding: '9px 18px',
    fontSize: '13px', fontWeight: '600',
    cursor: 'pointer', fontFamily: 'DM Sans, sans-serif',
    boxShadow: '0 2px 8px rgba(79,70,229,0.3)'
  }

  const btnOutline = {
    background: COR_BG, color: COR, border: `1px solid ${COR}44`,
    borderRadius: '10px', padding: '8px 16px',
    fontSize: '12px', fontWeight: '600',
    cursor: 'pointer', fontFamily: 'DM Sans, sans-serif'
  }

  if (carregando) return (
    <Layout usuario={usuario}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', color: '#64748b', fontFamily: 'DM Sans, sans-serif' }}>
        Carregando almoxarifado...
      </div>
    </Layout>
  )

  return (
    <Layout usuario={usuario}>
      <div style={{ padding: '28px', maxWidth: '1200px', margin: '0 auto' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h1 style={{ fontFamily: 'Sora, sans-serif', fontSize: '22px', fontWeight: '700', color: '#1e1b4b', margin: 0 }}>
              📦 Almoxarifado
            </h1>
            <p style={{ color: '#64748b', fontSize: '13px', margin: '4px 0 0', fontFamily: 'DM Sans, sans-serif' }}>
              Controle de estoque e movimentações
            </p>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button style={btnOutline} onClick={abrirNovaCategoria}>
              + Categoria
            </button>
            <button style={btnPrimary} onClick={abrirNovoProduto}>+ Novo produto</button>
          </div>
        </div>

        {/* Abas */}
        <div style={{ display: 'flex', gap: '4px', borderBottom: '2px solid #e2e8f0', marginBottom: '24px' }}>
          {[
            { key: 'dashboard', label: '📊 Dashboard' },
            { key: 'produtos', label: `📦 Produtos (${produtos.length})` },
            { key: 'movimentacoes', label: '📋 Movimentações' },
            { key: 'relatorio', label: '🖨️ Relatório' },
            { key: 'scanner', label: '📷 Scanner' },
          ].map(a => (
            <button key={a.key} style={estiloAba(a.key)} onClick={() => setAba(a.key)}>{a.label}</button>
          ))}
        </div>

        {/* ── DASHBOARD ─────────────────────────────────── */}
        {aba === 'dashboard' && (
          <div>
            {/* Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '16px', marginBottom: '24px' }}>
              {[
                { label: 'Total de produtos', valor: stats.total, cor: '#4f46e5', icon: '📦' },
                { label: 'Estoque crítico', valor: stats.criticos, cor: '#f59e0b', icon: '⚠️' },
                { label: 'Zerados', valor: stats.zerados, cor: '#ef4444', icon: '🔴' },
                { label: 'Vencendo em 30d', valor: stats.vencendo, cor: '#f59e0b', icon: '📅' },
                { label: 'Vencidos', valor: stats.vencidos, cor: '#ef4444', icon: '🚫' },
                { label: 'Entradas hoje', valor: stats.entradasHoje, cor: '#10b981', icon: '▲' },
                { label: 'Saídas hoje', valor: stats.saidasHoje, cor: '#f43f5e', icon: '▼' },
              ].map(c => (
                <div key={c.label} style={{ background: 'white', borderRadius: '14px', padding: '18px', boxShadow: '0 1px 6px rgba(0,0,0,0.06)', border: `1px solid ${c.cor}22` }}>
                  <div style={{ fontSize: '22px', marginBottom: '8px' }}>{c.icon}</div>
                  <div style={{ fontSize: '28px', fontWeight: '700', color: c.cor, fontFamily: 'Sora, sans-serif', lineHeight: 1 }}>{c.valor}</div>
                  <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px', fontFamily: 'DM Sans, sans-serif' }}>{c.label}</div>
                </div>
              ))}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '20px' }}>
              {/* Alertas estoque */}
              <div style={{ background: 'white', borderRadius: '14px', padding: '20px', boxShadow: '0 1px 6px rgba(0,0,0,0.06)' }}>
                <h3 style={{ fontFamily: 'Sora, sans-serif', fontSize: '14px', fontWeight: '700', color: '#f59e0b', margin: '0 0 16px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  ⚠️ Produtos abaixo do mínimo
                </h3>
                {alertas.length === 0
                  ? <p style={{ color: '#64748b', fontSize: '13px', fontFamily: 'DM Sans, sans-serif' }}>Todos os estoques estão normais.</p>
                  : alertas.map(p => {
                    const st = statusEstoque(p)
                    return (
                      <div key={p.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #f1f5f9', gap: '8px' }}>
                        <div>
                          <div style={{ fontSize: '13px', fontWeight: '600', color: '#1e293b', fontFamily: 'DM Sans, sans-serif' }}>{p.nome}</div>
                          <div style={{ fontSize: '11px', color: '#94a3b8' }}>{p.localizacao || 'Sem localização'}</div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <span style={{ background: st.bg, color: st.cor, borderRadius: '6px', padding: '2px 8px', fontSize: '12px', fontWeight: '700' }}>
                            {p.quantidade_atual} {p.unidade}
                          </span>
                          <div style={{ fontSize: '10px', color: '#94a3b8', marginTop: '2px' }}>mín: {p.quantidade_minima}</div>
                        </div>
                      </div>
                    )
                  })
                }
              </div>

              {/* Alertas vencimento */}
              <div style={{ background: 'white', borderRadius: '14px', padding: '20px', boxShadow: '0 1px 6px rgba(0,0,0,0.06)' }}>
                <h3 style={{ fontFamily: 'Sora, sans-serif', fontSize: '14px', fontWeight: '700', color: '#ef4444', margin: '0 0 16px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  📅 Próximos ao vencimento
                </h3>
                {alertasVencimento.length === 0
                  ? <p style={{ color: '#64748b', fontSize: '13px', fontFamily: 'DM Sans, sans-serif' }}>Nenhum produto vencendo em breve.</p>
                  : alertasVencimento.map(p => {
                    const sv = statusValidade(p.data_validade)
                    return (
                      <div key={p.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #f1f5f9', gap: '8px' }}>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: '13px', fontWeight: '600', color: '#1e293b', fontFamily: 'DM Sans, sans-serif', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.nome}</div>
                          <div style={{ fontSize: '11px', color: '#94a3b8' }}>{p.data_validade}</div>
                        </div>
                        <span style={{ background: sv.bg, color: sv.cor, borderRadius: '6px', padding: '2px 8px', fontSize: '11px', fontWeight: '700', whiteSpace: 'nowrap' }}>
                          {sv.label}
                        </span>
                      </div>
                    )
                  })
                }
              </div>

              {/* Últimas movimentações */}
              <div style={{ background: 'white', borderRadius: '14px', padding: '20px', boxShadow: '0 1px 6px rgba(0,0,0,0.06)' }}>
                <h3 style={{ fontFamily: 'Sora, sans-serif', fontSize: '14px', fontWeight: '700', color: '#4f46e5', margin: '0 0 16px' }}>
                  🕐 Últimas movimentações
                </h3>
                {ultimasMovs.length === 0
                  ? <p style={{ color: '#64748b', fontSize: '13px', fontFamily: 'DM Sans, sans-serif' }}>Nenhuma movimentação registrada.</p>
                  : ultimasMovs.slice(0, 8).map(m => (
                    <div key={m.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #f1f5f9', gap: '8px' }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '13px', fontWeight: '600', color: '#1e293b', fontFamily: 'DM Sans, sans-serif', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {m.produtos_estoque?.nome || '-'}
                        </div>
                        <div style={{ fontSize: '11px', color: '#94a3b8' }}>{formatarDataHora(m.created_at)}</div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {chipTipo(m.tipo)}
                        <span style={{ fontSize: '13px', fontWeight: '700', color: m.tipo === 'entrada' ? '#10b981' : '#ef4444', minWidth: '40px', textAlign: 'right' }}>
                          {m.tipo === 'saida' ? '-' : '+'}{m.quantidade}
                        </span>
                      </div>
                    </div>
                  ))
                }
              </div>
            </div>
          </div>
        )}

        {/* ── PRODUTOS ──────────────────────────────────── */}
        {aba === 'produtos' && (
          <div>
            {/* Filtros */}
            <div style={{ display: 'flex', gap: '10px', marginBottom: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
              <input
                className="input-modern"
                style={{ flex: '1', minWidth: '200px', maxWidth: '320px' }}
                placeholder="Buscar por nome ou código..."
                value={busca}
                onChange={e => { setBusca(e.target.value); carregarProdutos({ busca: e.target.value }) }}
              />
              <select
                className="input-modern"
                style={{ width: '180px' }}
                value={filtroCat}
                onChange={e => { setFiltroCat(e.target.value); carregarProdutos({ categoria: e.target.value }) }}
              >
                <option value="">Todas as categorias</option>
                {categorias.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </select>
              <select
                className="input-modern"
                style={{ width: '140px' }}
                value={filtroAtivo}
                onChange={e => { setFiltroAtivo(e.target.value); carregarProdutos({ ativo: e.target.value }) }}
              >
                <option value="true">Ativos</option>
                <option value="false">Inativos</option>
                <option value="">Todos</option>
              </select>
            </div>

            {/* Tabela */}
            <div style={{ background: 'white', borderRadius: '14px', overflow: 'hidden', boxShadow: '0 1px 6px rgba(0,0,0,0.06)' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#f8fafc' }}>
                    {['Produto', 'Categoria', 'Unid.', 'Estoque', 'Mínimo', 'Status', 'Vencimento', 'Ações'].map(h => (
                      <th key={h} style={{ padding: '12px 14px', textAlign: 'left', fontSize: '11px', fontWeight: '700', color: '#64748b', fontFamily: 'DM Sans, sans-serif', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {produtosFiltrados.length === 0 && (
                    <tr><td colSpan={8} style={{ padding: '32px', textAlign: 'center', color: '#94a3b8', fontFamily: 'DM Sans, sans-serif' }}>Nenhum produto encontrado.</td></tr>
                  )}
                  {produtosFiltrados.map(p => {
                    const st = statusEstoque(p)
                    const sv = statusValidade(p.data_validade)
                    return (
                      <tr key={p.id} style={{ borderTop: '1px solid #f1f5f9' }}
                        onMouseEnter={e => e.currentTarget.style.background = '#fafbff'}
                        onMouseLeave={e => e.currentTarget.style.background = ''}>
                        <td style={{ padding: '12px 14px' }}>
                          <div style={{ fontWeight: '600', fontSize: '13px', color: '#1e293b', fontFamily: 'DM Sans, sans-serif' }}>{p.nome}</div>
                          {p.descricao && <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>{p.descricao.substring(0, 40)}</div>}
                        </td>
                        <td style={{ padding: '12px 14px' }}>{badgeCategoria(p.categorias_estoque)}</td>
                        <td style={{ padding: '12px 14px', fontSize: '12px', color: '#64748b', fontFamily: 'DM Sans, sans-serif' }}>{p.unidade}</td>
                        <td style={{ padding: '12px 14px', fontWeight: '700', fontSize: '14px', color: st.cor, fontFamily: 'Sora, sans-serif' }}>{p.quantidade_atual}</td>
                        <td style={{ padding: '12px 14px', fontSize: '12px', color: '#94a3b8', fontFamily: 'DM Sans, sans-serif' }}>{p.quantidade_minima}</td>
                        <td style={{ padding: '12px 14px' }}>
                          <span style={{ background: st.bg, color: st.cor, borderRadius: '6px', padding: '3px 8px', fontSize: '11px', fontWeight: '700' }}>{st.label}</span>
                        </td>
                        <td style={{ padding: '12px 14px' }}>
                          {p.data_validade
                            ? <div>
                                <div style={{ fontSize: '12px', color: '#64748b', fontFamily: 'DM Sans, sans-serif' }}>
                                  {new Date(p.data_validade + 'T12:00:00').toLocaleDateString('pt-BR')}
                                </div>
                                {sv && <span style={{ background: sv.bg, color: sv.cor, borderRadius: '5px', padding: '1px 6px', fontSize: '10px', fontWeight: '700' }}>{sv.label}</span>}
                              </div>
                            : <span style={{ color: '#cbd5e1', fontSize: '12px' }}>—</span>}
                        </td>
                        <td style={{ padding: '12px 14px' }}>
                          <div style={{ display: 'flex', gap: '4px', flexWrap: 'nowrap' }}>
                            <button title="Entrada" onClick={() => abrirMovimentacao(p, 'entrada')}
                              style={{ background: 'rgba(16,185,129,0.1)', color: '#10b981', border: 'none', borderRadius: '6px', padding: '5px 8px', cursor: 'pointer', fontSize: '12px', fontWeight: '700' }}>+</button>
                            <button title="Saída" onClick={() => abrirMovimentacao(p, 'saida')}
                              style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: 'none', borderRadius: '6px', padding: '5px 8px', cursor: 'pointer', fontSize: '12px', fontWeight: '700' }}>−</button>
                            <button title="Ajuste" onClick={() => abrirMovimentacao(p, 'ajuste')}
                              style={{ background: 'rgba(245,158,11,0.1)', color: '#f59e0b', border: 'none', borderRadius: '6px', padding: '5px 8px', cursor: 'pointer', fontSize: '11px' }}>⟳</button>
                            <button title="Editar" onClick={() => abrirEditarProduto(p)}
                              style={{ background: COR_BG, color: COR, border: 'none', borderRadius: '6px', padding: '5px 8px', cursor: 'pointer', fontSize: '11px' }}>✏️</button>
                            {p.ativo
                              ? <button title="Desativar" onClick={() => inativarProduto(p)}
                                  style={{ background: 'rgba(239,68,68,0.08)', color: '#ef4444', border: 'none', borderRadius: '6px', padding: '5px 8px', cursor: 'pointer', fontSize: '11px' }}>🗑️</button>
                              : <button title="Reativar" onClick={() => reativarProduto(p)}
                                  style={{ background: 'rgba(16,185,129,0.08)', color: '#10b981', border: 'none', borderRadius: '6px', padding: '5px 8px', cursor: 'pointer', fontSize: '11px' }}>↩️</button>
                            }
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── MOVIMENTAÇÕES ─────────────────────────────── */}
        {aba === 'movimentacoes' && (
          <div>
            {/* Filtros */}
            <div style={{ display: 'flex', gap: '10px', marginBottom: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
              <select
                className="input-modern" style={{ width: '140px' }}
                value={filtroMov.tipo}
                onChange={e => { const v = { ...filtroMov, tipo: e.target.value }; setFiltroMov(v); carregarMovimentacoes(v) }}
              >
                <option value="">Todos os tipos</option>
                <option value="entrada">Entrada</option>
                <option value="saida">Saída</option>
                <option value="ajuste">Ajuste</option>
              </select>
              <select
                className="input-modern" style={{ width: '200px' }}
                value={filtroMov.produto_id}
                onChange={e => { const v = { ...filtroMov, produto_id: e.target.value }; setFiltroMov(v); carregarMovimentacoes(v) }}
              >
                <option value="">Todos os produtos</option>
                {produtos.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
              </select>
              <input type="date" className="input-modern" style={{ width: '150px' }}
                value={filtroMov.de}
                onChange={e => { const v = { ...filtroMov, de: e.target.value }; setFiltroMov(v); carregarMovimentacoes(v) }}
              />
              <span style={{ color: '#94a3b8', fontSize: '13px' }}>até</span>
              <input type="date" className="input-modern" style={{ width: '150px' }}
                value={filtroMov.ate}
                onChange={e => { const v = { ...filtroMov, ate: e.target.value }; setFiltroMov(v); carregarMovimentacoes(v) }}
              />
              <button style={btnOutline} onClick={() => { setFiltroMov({ tipo: '', produto_id: '', de: '', ate: '' }); carregarMovimentacoes({ tipo: '', produto_id: '', de: '', ate: '' }) }}>
                Limpar
              </button>
            </div>

            <div style={{ background: 'white', borderRadius: '14px', overflow: 'hidden', boxShadow: '0 1px 6px rgba(0,0,0,0.06)' }}>
              {carregandoMovs
                ? <div style={{ padding: '32px', textAlign: 'center', color: '#94a3b8', fontFamily: 'DM Sans, sans-serif' }}>Carregando...</div>
                : (
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: '#f8fafc' }}>
                      {['Data/Hora', 'Produto', 'Tipo', 'Qtd Antes', 'Quantidade', 'Qtd Depois', 'Origem/Destino', 'Observação', 'Usuário'].map(h => (
                        <th key={h} style={{ padding: '12px 14px', textAlign: 'left', fontSize: '11px', fontWeight: '700', color: '#64748b', fontFamily: 'DM Sans, sans-serif', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {movimentacoes.length === 0 && (
                      <tr><td colSpan={8} style={{ padding: '32px', textAlign: 'center', color: '#94a3b8', fontFamily: 'DM Sans, sans-serif' }}>Nenhuma movimentação encontrada.</td></tr>
                    )}
                    {movimentacoes.map(m => (
                      <tr key={m.id} style={{ borderTop: '1px solid #f1f5f9' }}
                        onMouseEnter={e => e.currentTarget.style.background = '#fafbff'}
                        onMouseLeave={e => e.currentTarget.style.background = ''}>
                        <td style={{ padding: '10px 14px', fontSize: '12px', color: '#64748b', fontFamily: 'DM Sans, sans-serif', whiteSpace: 'nowrap' }}>{formatarDataHora(m.created_at)}</td>
                        <td style={{ padding: '10px 14px' }}>
                          <div style={{ fontWeight: '600', fontSize: '13px', color: '#1e293b', fontFamily: 'DM Sans, sans-serif' }}>{m.produtos_estoque?.nome || '—'}</div>
                          {m.produtos_estoque?.codigo_barras && <div style={{ fontSize: '11px', color: '#94a3b8', fontFamily: 'monospace' }}>{m.produtos_estoque.codigo_barras}</div>}
                        </td>
                        <td style={{ padding: '10px 14px' }}>{chipTipo(m.tipo)}</td>
                        <td style={{ padding: '10px 14px', fontSize: '13px', color: '#64748b', textAlign: 'right', fontFamily: 'Sora, sans-serif' }}>{m.quantidade_antes} {m.produtos_estoque?.unidade}</td>
                        <td style={{ padding: '10px 14px', fontSize: '14px', fontWeight: '700', color: m.tipo === 'entrada' ? '#10b981' : m.tipo === 'saida' ? '#ef4444' : '#f59e0b', textAlign: 'right', fontFamily: 'Sora, sans-serif' }}>
                          {m.tipo === 'saida' ? '−' : m.tipo === 'entrada' ? '+' : '='}{m.quantidade}
                        </td>
                        <td style={{ padding: '10px 14px', fontSize: '13px', fontWeight: '700', color: '#1e293b', textAlign: 'right', fontFamily: 'Sora, sans-serif' }}>{m.quantidade_depois} {m.produtos_estoque?.unidade}</td>
                        <td style={{ padding: '10px 14px', fontSize: '12px', color: '#64748b', fontFamily: 'DM Sans, sans-serif' }}>
                          {m.destino
                            ? <span style={{ background: 'rgba(79,70,229,0.08)', color: '#4f46e5', borderRadius: '6px', padding: '2px 8px', fontSize: '11px', fontWeight: '600' }}>{m.destino}</span>
                            : m.motivo || '—'}
                        </td>
                        <td style={{ padding: '10px 14px', fontSize: '12px', color: '#64748b', fontFamily: 'DM Sans, sans-serif', maxWidth: '150px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={m.observacao}>{m.observacao || '—'}</td>
                        <td style={{ padding: '10px 14px', fontSize: '12px', color: '#64748b', fontFamily: 'DM Sans, sans-serif' }}>{m.usuario_nome || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {/* ── RELATÓRIO ─────────────────────────────────── */}
        {aba === 'relatorio' && (
          <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: '20px', alignItems: 'start' }}>

            {/* Painel de configuração */}
            <div style={{ background: 'white', borderRadius: '14px', padding: '20px', boxShadow: '0 1px 6px rgba(0,0,0,0.06)' }}>
              <h3 style={{ fontFamily: 'Sora, sans-serif', fontSize: '14px', fontWeight: '700', color: '#4f46e5', margin: '0 0 18px' }}>
                Configurar relatório
              </h3>

              {/* Tipo */}
              <label className="label-modern">Tipo de relatório</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '18px' }}>
                {[
                  { value: 'estoque',       icon: '📦', label: 'Estoque atual',              desc: 'Snapshot de todos os produtos' },
                  { value: 'movimentacoes', icon: '📋', label: 'Movimentações do período',   desc: 'Histórico detalhado de entradas e saídas' },
                  { value: 'consolidado',   icon: '📊', label: 'Consolidado por produto',    desc: 'Totais de entradas e saídas por item' },
                  { value: 'vencendo',      icon: '📅', label: 'Vencendo em 30 dias',        desc: 'Produtos próximos ao vencimento' },
                  { value: 'vencidos',      icon: '🚫', label: 'Vencidos',                   desc: 'Produtos com validade expirada' },
                  { value: 'criticos',      icon: '⚠️', label: 'Estoque crítico',            desc: 'Abaixo da quantidade mínima' },
                  { value: 'zerados',       icon: '🔴', label: 'Zerados',                    desc: 'Produtos sem nenhum estoque' },
                ].map(t => (
                  <button key={t.value}
                    onClick={() => { setRelTipo(t.value); setRelDados(null) }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '10px',
                      padding: '10px 12px', borderRadius: '10px', textAlign: 'left',
                      border: relTipo === t.value ? '2px solid #4f46e5' : '2px solid #e2e8f0',
                      background: relTipo === t.value ? 'rgba(79,70,229,0.06)' : 'white',
                      cursor: 'pointer', transition: 'all 0.15s'
                    }}>
                    <span style={{ fontSize: '20px' }}>{t.icon}</span>
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: '600', color: relTipo === t.value ? '#4f46e5' : '#1e293b', fontFamily: 'DM Sans, sans-serif' }}>{t.label}</div>
                      <div style={{ fontSize: '11px', color: '#94a3b8', fontFamily: 'DM Sans, sans-serif' }}>{t.desc}</div>
                    </div>
                  </button>
                ))}
              </div>

              {/* Filtros por período */}
              {(relTipo === 'movimentacoes' || relTipo === 'consolidado') && (
                <>
                  <label className="label-modern">Período — De</label>
                  <input type="date" className="input-modern" value={relDe} onChange={e => setRelDe(e.target.value)} style={{ marginBottom: '10px' }} />
                  <label className="label-modern">Até</label>
                  <input type="date" className="input-modern" value={relAte} onChange={e => setRelAte(e.target.value)} style={{ marginBottom: '18px' }} />
                </>
              )}

              {/* Filtro categoria (só estoque) */}
              {relTipo === 'estoque' && (
                <>
                  <label className="label-modern">Filtrar por categoria</label>
                  <select className="input-modern" value={relCategoria} onChange={e => setRelCategoria(e.target.value)} style={{ marginBottom: '18px' }}>
                    <option value="">Todas as categorias</option>
                    {categorias.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                  </select>
                </>
              )}

              <button style={{ ...btnPrimary, width: '100%', justifyContent: 'center', marginBottom: '8px' }}
                onClick={gerarRelatorio} disabled={gerandoRel}>
                {gerandoRel ? 'Gerando...' : '🔍 Gerar relatório'}
              </button>
              {relDados?.length > 0 && (
                <button style={{ ...btnOutline, width: '100%', textAlign: 'center' }} onClick={imprimirRelatorio}>
                  🖨️ Imprimir
                </button>
              )}
            </div>

            {/* Preview */}
            <div style={{ background: 'white', borderRadius: '14px', overflow: 'hidden', boxShadow: '0 1px 6px rgba(0,0,0,0.06)', minHeight: '400px' }}>
              {relDados === null && !gerandoRel && (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '400px', color: '#94a3b8', fontFamily: 'DM Sans, sans-serif' }}>
                  <div style={{ fontSize: '48px', marginBottom: '12px' }}>🖨️</div>
                  <p style={{ fontSize: '14px' }}>Configure e clique em "Gerar relatório"</p>
                </div>
              )}
              {relDados !== null && relDados.length === 0 && !gerandoRel && (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '400px', color: '#10b981', fontFamily: 'DM Sans, sans-serif' }}>
                  <div style={{ fontSize: '48px', marginBottom: '12px' }}>✅</div>
                  <p style={{ fontSize: '14px', fontWeight: '600' }}>Nenhum produto encontrado nesta categoria</p>
                  <p style={{ fontSize: '12px', color: '#94a3b8', marginTop: '4px' }}>Tudo em ordem!</p>
                </div>
              )}
              {gerandoRel && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '400px', color: '#94a3b8', fontFamily: 'DM Sans, sans-serif' }}>
                  Carregando dados...
                </div>
              )}

              {/* Preview: Estoque */}
              {!gerandoRel && relDados?.length > 0 && relTipo === 'estoque' && (
                <div>
                  <div style={{ padding: '14px 20px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontFamily: 'Sora, sans-serif', fontWeight: '700', fontSize: '13px', color: '#4f46e5' }}>
                      Estoque atual — {relDados.length} produtos
                    </span>
                    <button style={btnPrimary} onClick={imprimirRelatorio}>🖨️ Imprimir</button>
                  </div>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', fontFamily: 'DM Sans, sans-serif' }}>
                    <thead>
                      <tr style={{ background: '#f8fafc' }}>
                        {['Produto', 'Categoria', 'Unid.', 'Estoque', 'Mínimo', 'Status', 'Vencimento'].map(h => (
                          <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontSize: '11px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {relDados.map(p => {
                        const st = statusEstoqueTexto(p)
                        const sv = statusValidade(p.data_validade)
                        return (
                          <tr key={p.id} style={{ borderTop: '1px solid #f1f5f9' }}>
                            <td style={{ padding: '9px 12px', fontWeight: '600', color: '#1e293b' }}>{p.nome}</td>
                            <td style={{ padding: '9px 12px', color: '#64748b' }}>{p.categorias_estoque?.nome || '—'}</td>
                            <td style={{ padding: '9px 12px', color: '#64748b' }}>{p.unidade}</td>
                            <td style={{ padding: '9px 12px', fontWeight: '700', color: st.cor }}>{p.quantidade_atual}</td>
                            <td style={{ padding: '9px 12px', color: '#94a3b8' }}>{p.quantidade_minima}</td>
                            <td style={{ padding: '9px 12px' }}>
                              <span style={{ background: st.cor + '18', color: st.cor, borderRadius: '5px', padding: '2px 7px', fontSize: '11px', fontWeight: '700' }}>{st.label}</span>
                            </td>
                            <td style={{ padding: '9px 12px' }}>
                              {p.data_validade
                                ? <div>
                                    <div style={{ fontSize: '12px', color: '#64748b' }}>{new Date(p.data_validade + 'T12:00:00').toLocaleDateString('pt-BR')}</div>
                                    {sv && <span style={{ background: sv.bg, color: sv.cor, borderRadius: '5px', padding: '1px 6px', fontSize: '10px', fontWeight: '700' }}>{sv.label}</span>}
                                  </div>
                                : <span style={{ color: '#cbd5e1' }}>—</span>}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Preview: Movimentações */}
              {!gerandoRel && relDados?.length > 0 && relTipo === 'movimentacoes' && (
                <div>
                  <div style={{ padding: '14px 20px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontFamily: 'Sora, sans-serif', fontWeight: '700', fontSize: '13px', color: '#4f46e5' }}>
                      {relDados.length} movimentações
                      &nbsp;·&nbsp;
                      <span style={{ color: '#10b981' }}>▲ {relDados.filter(m => m.tipo === 'entrada').length} entradas</span>
                      &nbsp;·&nbsp;
                      <span style={{ color: '#ef4444' }}>▼ {relDados.filter(m => m.tipo === 'saida').length} saídas</span>
                    </span>
                    <button style={btnPrimary} onClick={imprimirRelatorio}>🖨️ Imprimir</button>
                  </div>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', fontFamily: 'DM Sans, sans-serif' }}>
                      <thead>
                        <tr style={{ background: '#f8fafc' }}>
                          {['Data/Hora', 'Produto', 'Tipo', 'Antes', 'Qtd', 'Depois', 'Origem/Destino', 'Usuário'].map(h => (
                            <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontSize: '11px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {relDados.map(m => (
                          <tr key={m.id} style={{ borderTop: '1px solid #f1f5f9' }}>
                            <td style={{ padding: '8px 12px', whiteSpace: 'nowrap', color: '#64748b' }}>{formatarDataHora(m.created_at)}</td>
                            <td style={{ padding: '8px 12px', fontWeight: '600', color: '#1e293b' }}>{m.produtos_estoque?.nome || '—'}</td>
                            <td style={{ padding: '8px 12px' }}>{chipTipo(m.tipo)}</td>
                            <td style={{ padding: '8px 12px', textAlign: 'right', color: '#64748b' }}>{m.quantidade_antes}</td>
                            <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: '700', color: m.tipo === 'entrada' ? '#10b981' : m.tipo === 'saida' ? '#ef4444' : '#f59e0b' }}>
                              {m.tipo === 'saida' ? '−' : '+' }{m.quantidade}
                            </td>
                            <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: '700', color: '#1e293b' }}>{m.quantidade_depois}</td>
                            <td style={{ padding: '8px 12px', color: '#64748b' }}>{m.destino || m.motivo || '—'}</td>
                            <td style={{ padding: '8px 12px', color: '#64748b' }}>{m.usuario_nome || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Preview: Consolidado */}
              {!gerandoRel && relDados?.length > 0 && relTipo === 'consolidado' && (() => {
                const mapa = {}
                relDados.forEach(m => {
                  const nome = m.produtos_estoque?.nome || '—'
                  if (!mapa[nome]) mapa[nome] = { entradas: 0, saidas: 0, ajustes: 0 }
                  if (m.tipo === 'entrada') mapa[nome].entradas += Number(m.quantidade)
                  else if (m.tipo === 'saida') mapa[nome].saidas += Number(m.quantidade)
                  else mapa[nome].ajustes += Number(m.quantidade)
                })
                return (
                  <div>
                    <div style={{ padding: '14px 20px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontFamily: 'Sora, sans-serif', fontWeight: '700', fontSize: '13px', color: '#4f46e5' }}>
                        {Object.keys(mapa).length} produtos movimentados
                      </span>
                      <button style={btnPrimary} onClick={imprimirRelatorio}>🖨️ Imprimir</button>
                    </div>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', fontFamily: 'DM Sans, sans-serif' }}>
                      <thead>
                        <tr style={{ background: '#f8fafc' }}>
                          {['Produto', 'Entradas', 'Saídas', 'Ajustes', 'Saldo período'].map(h => (
                            <th key={h} style={{ padding: '10px 12px', textAlign: h === 'Produto' ? 'left' : 'right', fontSize: '11px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {Object.entries(mapa).sort().map(([nome, v]) => (
                          <tr key={nome} style={{ borderTop: '1px solid #f1f5f9' }}>
                            <td style={{ padding: '9px 12px', fontWeight: '600', color: '#1e293b' }}>{nome}</td>
                            <td style={{ padding: '9px 12px', textAlign: 'right', color: '#10b981', fontWeight: '700' }}>+{v.entradas}</td>
                            <td style={{ padding: '9px 12px', textAlign: 'right', color: '#ef4444', fontWeight: '700' }}>−{v.saidas}</td>
                            <td style={{ padding: '9px 12px', textAlign: 'right', color: '#f59e0b' }}>{v.ajustes}</td>
                            <td style={{ padding: '9px 12px', textAlign: 'right', fontWeight: '700', color: v.entradas - v.saidas >= 0 ? '#10b981' : '#ef4444' }}>
                              {v.entradas - v.saidas >= 0 ? '+' : ''}{v.entradas - v.saidas}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )
              })()}

              {/* Preview: Alertas (vencendo, vencidos, críticos, zerados) */}
              {!gerandoRel && relDados?.length > 0 && ['vencendo', 'vencidos', 'criticos', 'zerados'].includes(relTipo) && (() => {
                const cfgRel = {
                  vencendo: { cor: '#f59e0b', label: 'vencendo em 30 dias' },
                  vencidos: { cor: '#ef4444', label: 'vencidos' },
                  criticos: { cor: '#f59e0b', label: 'com estoque crítico' },
                  zerados:  { cor: '#ef4444', label: 'zerados' },
                }[relTipo]
                return (
                  <div>
                    <div style={{ padding: '14px 20px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontFamily: 'Sora, sans-serif', fontWeight: '700', fontSize: '13px', color: cfgRel.cor }}>
                        {relDados.length} produto(s) {cfgRel.label}
                      </span>
                      <button style={btnPrimary} onClick={imprimirRelatorio}>🖨️ Imprimir</button>
                    </div>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', fontFamily: 'DM Sans, sans-serif' }}>
                      <thead>
                        <tr style={{ background: '#f8fafc' }}>
                          {['Produto', 'Categoria', 'Unid.', 'Estoque', 'Mínimo', 'Vencimento'].map(h => (
                            <th key={h} style={{ padding: '10px 12px', textAlign: ['Estoque','Mínimo'].includes(h) ? 'right' : 'left', fontSize: '11px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {relDados.map(p => {
                          const sv = statusValidade(p.data_validade)
                          const corQtd = relTipo === 'zerados' ? '#ef4444' : relTipo === 'criticos' ? '#f59e0b' : '#1e293b'
                          return (
                            <tr key={p.id} style={{ borderTop: '1px solid #f1f5f9' }}>
                              <td style={{ padding: '9px 12px', fontWeight: '600', color: '#1e293b' }}>{p.nome}</td>
                              <td style={{ padding: '9px 12px', color: '#64748b' }}>{p.categorias_estoque?.nome || '—'}</td>
                              <td style={{ padding: '9px 12px', color: '#64748b' }}>{p.unidade}</td>
                              <td style={{ padding: '9px 12px', textAlign: 'right', fontWeight: '700', color: corQtd }}>{p.quantidade_atual}</td>
                              <td style={{ padding: '9px 12px', textAlign: 'right', color: '#94a3b8' }}>{p.quantidade_minima}</td>
                              <td style={{ padding: '9px 12px' }}>
                                {p.data_validade
                                  ? <div>
                                      <div style={{ fontSize: '12px', color: '#64748b' }}>{new Date(p.data_validade + 'T12:00:00').toLocaleDateString('pt-BR')}</div>
                                      {sv && <span style={{ background: sv.bg, color: sv.cor, borderRadius: '5px', padding: '1px 6px', fontSize: '10px', fontWeight: '700' }}>{sv.label}</span>}
                                    </div>
                                  : <span style={{ color: '#cbd5e1' }}>—</span>}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )
              })()}

            </div>
          </div>
        )}

        {/* ── SCANNER ───────────────────────────────────── */}
        {aba === 'scanner' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', alignItems: 'start' }}>

            {/* Câmera */}
            <div style={{ background: 'white', borderRadius: '16px', overflow: 'hidden', boxShadow: '0 1px 6px rgba(0,0,0,0.06)' }}>
              <div style={{ padding: '16px 20px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <h3 style={{ fontFamily: 'Sora, sans-serif', fontSize: '14px', fontWeight: '700', color: '#4f46e5', margin: 0 }}>📷 Câmera</h3>
                {scannerAtivo
                  ? <button onClick={pararCamera} style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: 'none', borderRadius: '8px', padding: '6px 14px', cursor: 'pointer', fontSize: '12px', fontWeight: '600' }}>Parar</button>
                  : <button onClick={iniciarCamera} style={btnPrimary}>Iniciar câmera</button>
                }
              </div>

              <div style={{ position: 'relative', background: '#0f172a', minHeight: '260px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <video
                  ref={videoRef}
                  style={{ width: '100%', display: scannerAtivo ? 'block' : 'none', maxHeight: '300px', objectFit: 'cover' }}
                  playsInline muted
                />
                {scanFlash && (
                  <div style={{ position: 'absolute', inset: 0, background: 'rgba(129,140,248,0.6)', pointerEvents: 'none', transition: 'opacity 0.5s' }} />
                )}
                {scannerAtivo && barcodeSuportado && (
                  <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
                    <div style={{ width: '200px', height: '120px', border: '2px solid #818cf8', borderRadius: '12px', boxShadow: '0 0 0 4000px rgba(0,0,0,0.35)' }} />
                  </div>
                )}
                {!scannerAtivo && (
                  <div style={{ textAlign: 'center', color: '#475569', fontFamily: 'DM Sans, sans-serif' }}>
                    <div style={{ fontSize: '40px', marginBottom: '8px' }}>📷</div>
                    <div style={{ fontSize: '13px' }}>Clique em "Iniciar câmera"</div>
                    {!barcodeSuportado && <div style={{ fontSize: '11px', color: '#f59e0b', marginTop: '6px' }}>⚠️ BarcodeDetector não suportado neste navegador</div>}
                  </div>
                )}
                {erroCamera && (
                  <div style={{ position: 'absolute', bottom: '12px', left: '12px', right: '12px', background: 'rgba(239,68,68,0.9)', color: 'white', borderRadius: '8px', padding: '8px 12px', fontSize: '12px', fontFamily: 'DM Sans, sans-serif' }}>
                    {erroCamera}
                  </div>
                )}
              </div>

              {/* Input manual */}
              <div style={{ padding: '16px 20px', borderTop: '1px solid #f1f5f9' }}>
                <label style={{ fontSize: '12px', fontWeight: '600', color: '#64748b', fontFamily: 'DM Sans, sans-serif', display: 'block', marginBottom: '6px' }}>
                  Ou digite o código manualmente
                </label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    className="input-modern"
                    style={{ flex: 1 }}
                    placeholder="Ex: 7891234567890"
                    value={codigoManual}
                    onChange={e => setCodigoManual(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && buscarPorCodigo(codigoManual)}
                  />
                  <button style={btnPrimary} onClick={() => buscarPorCodigo(codigoManual)} disabled={buscandoCodigo}>
                    {buscandoCodigo ? '...' : 'Buscar'}
                  </button>
                </div>
              </div>
            </div>

            {/* Resultado do scan */}
            <div>
              {!produtoScaneado && (
                <div style={{ background: 'white', borderRadius: '16px', padding: '40px 20px', textAlign: 'center', boxShadow: '0 1px 6px rgba(0,0,0,0.06)' }}>
                  <div style={{ fontSize: '48px', marginBottom: '12px' }}>🔍</div>
                  <p style={{ color: '#64748b', fontFamily: 'DM Sans, sans-serif', fontSize: '14px' }}>
                    Aponte a câmera para um código de barras ou digite o código acima.
                  </p>
                </div>
              )}

              {produtoScaneado?._naoEncontrado && (
                <div style={{ background: 'white', borderRadius: '16px', padding: '24px', boxShadow: '0 1px 6px rgba(0,0,0,0.06)' }}>
                  <div style={{ fontSize: '36px', marginBottom: '8px', textAlign: 'center' }}>❓</div>
                  <p style={{ color: '#ef4444', fontFamily: 'DM Sans, sans-serif', fontSize: '14px', fontWeight: '600', textAlign: 'center' }}>
                    Produto não encontrado
                  </p>
                  <p style={{ color: '#64748b', fontFamily: 'monospace', fontSize: '13px', textAlign: 'center', marginBottom: '16px' }}>
                    {produtoScaneado.codigo}
                  </p>
                  <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                    <button style={btnPrimary} onClick={() => {
                      setFormProduto({ ...FORM_PRODUTO_VAZIO, codigo_barras: produtoScaneado.codigo })
                      setEditandoProduto(null)
                      setModalProduto(true)
                    }}>+ Cadastrar produto</button>
                    <button style={btnOutline} onClick={reiniciarScanner}>Escanear outro</button>
                  </div>
                </div>
              )}

              {produtoScaneado && !produtoScaneado._naoEncontrado && (
                <div style={{ background: 'white', borderRadius: '16px', overflow: 'hidden', boxShadow: '0 2px 12px rgba(79,70,229,0.12)', border: '2px solid #818cf8' }}>
                  <div style={{ background: GRAD, padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: '24px' }}>📦</span>
                    <div>
                      <div style={{ fontFamily: 'Sora, sans-serif', fontWeight: '700', fontSize: '16px', color: 'white' }}>{produtoScaneado.nome}</div>
                      {produtoScaneado.codigo_barras && <div style={{ fontFamily: 'monospace', fontSize: '12px', color: 'rgba(255,255,255,0.7)' }}>{produtoScaneado.codigo_barras}</div>}
                    </div>
                  </div>

                  <div style={{ padding: '20px' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
                      {[
                        { label: 'Estoque atual', valor: `${produtoScaneado.quantidade_atual} ${produtoScaneado.unidade}`, cor: statusEstoque(produtoScaneado).cor },
                        { label: 'Mínimo', valor: `${produtoScaneado.quantidade_minima} ${produtoScaneado.unidade}`, cor: '#64748b' },
                        { label: 'Categoria', valor: produtoScaneado.categorias_estoque?.nome || '—', cor: '#64748b' },
                        { label: 'Localização', valor: produtoScaneado.localizacao || '—', cor: '#64748b' },
                        ...(produtoScaneado.data_validade ? [{
                          label: 'Validade',
                          valor: (() => { const sv = statusValidade(produtoScaneado.data_validade); return sv?.label || produtoScaneado.data_validade })(),
                          cor: (() => { const sv = statusValidade(produtoScaneado.data_validade); return sv?.cor || '#64748b' })()
                        }] : []),
                      ].map(item => (
                        <div key={item.label} style={{ background: '#f8fafc', borderRadius: '10px', padding: '12px' }}>
                          <div style={{ fontSize: '11px', color: '#94a3b8', fontFamily: 'DM Sans, sans-serif', marginBottom: '4px' }}>{item.label}</div>
                          <div style={{ fontSize: '15px', fontWeight: '700', color: item.cor, fontFamily: 'Sora, sans-serif' }}>{item.valor}</div>
                        </div>
                      ))}
                    </div>

                    <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                      <button style={{ flex: 1, background: 'rgba(16,185,129,0.1)', color: '#10b981', border: '1px solid rgba(16,185,129,0.3)', borderRadius: '10px', padding: '11px', fontFamily: 'DM Sans, sans-serif', fontSize: '14px', fontWeight: '700', cursor: 'pointer' }}
                        onClick={() => abrirMovimentacao(produtoScaneado, 'entrada')}>
                        ▲ Entrada
                      </button>
                      <button style={{ flex: 1, background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '10px', padding: '11px', fontFamily: 'DM Sans, sans-serif', fontSize: '14px', fontWeight: '700', cursor: 'pointer' }}
                        onClick={() => abrirMovimentacao(produtoScaneado, 'saida')}>
                        ▼ Saída
                      </button>
                      <button style={{ background: 'rgba(245,158,11,0.1)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.3)', borderRadius: '10px', padding: '11px', fontFamily: 'DM Sans, sans-serif', fontSize: '14px', cursor: 'pointer' }}
                        title="Ajuste de inventário"
                        onClick={() => abrirMovimentacao(produtoScaneado, 'ajuste')}>⟳</button>
                    </div>
                    <button style={{ ...btnOutline, width: '100%', textAlign: 'center' }} onClick={reiniciarScanner}>
                      📷 Escanear outro produto
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ══ MODAL PRODUTO ══════════════════════════════════════════════ */}
      {modalProduto && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setModalProduto(false)}>
          <div className="modal-card" style={{ width: '560px', maxWidth: '95vw', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ fontFamily: 'Sora, sans-serif', fontSize: '17px', fontWeight: '700', color: '#4f46e5', margin: 0 }}>
                {editandoProduto ? '✏️ Editar produto' : '+ Novo produto'}
              </h2>
              <button onClick={() => setModalProduto(false)} style={{ background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer', color: '#94a3b8' }}>✕</button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
              <div style={{ gridColumn: '1 / -1' }}>
                <label className="label-modern">Nome do produto *</label>
                <input className="input-modern" value={formProduto.nome} onChange={e => setFormProduto(p => ({ ...p, nome: e.target.value.toUpperCase() }))} placeholder="Ex: PAPEL A4 500 FOLHAS" />
              </div>
              <div>
                <label className="label-modern">Código de barras</label>
                <input className="input-modern" value={formProduto.codigo_barras} onChange={e => setFormProduto(p => ({ ...p, codigo_barras: e.target.value.toUpperCase() }))} placeholder="EAN-13, Code128..." />
              </div>
              <div>
                <label className="label-modern">Unidade *</label>
                <select className="input-modern" value={formProduto.unidade} onChange={e => setFormProduto(p => ({ ...p, unidade: e.target.value }))}>
                  {UNIDADES.map(u => <option key={u} value={u}>{u}</option>)}
                </select>
              </div>
              {!editandoProduto && (
                <div>
                  <label className="label-modern">Quantidade inicial *</label>
                  <input className="input-modern" type="number" min="0" value={formProduto.quantidade_atual} onChange={e => setFormProduto(p => ({ ...p, quantidade_atual: e.target.value }))} placeholder="0" />
                </div>
              )}
              <div>
                <label className="label-modern">Quantidade mínima *</label>
                <input className="input-modern" type="number" min="0" value={formProduto.quantidade_minima} onChange={e => setFormProduto(p => ({ ...p, quantidade_minima: e.target.value }))} placeholder="0" />
              </div>
              <div style={{ gridColumn: editandoProduto ? '1 / -1' : '' }}>
                <label className="label-modern">Categoria *</label>
                <select className="input-modern" value={formProduto.categoria_id} onChange={e => setFormProduto(p => ({ ...p, categoria_id: e.target.value }))}>
                  <option value="">Selecione...</option>
                  {categorias.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                </select>
              </div>
              <div>
                <label className="label-modern">Data de validade</label>
                <input className="input-modern" type="date" value={formProduto.data_validade} onChange={e => setFormProduto(p => ({ ...p, data_validade: e.target.value }))} />
                {formProduto.data_validade && (() => {
                  const sv = statusValidade(formProduto.data_validade)
                  return sv ? (
                    <span style={{ display: 'inline-block', marginTop: '6px', background: sv.bg, color: sv.cor, borderRadius: '6px', padding: '2px 8px', fontSize: '11px', fontWeight: '700' }}>{sv.label}</span>
                  ) : null
                })()}
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label className="label-modern">Descrição</label>
                <input className="input-modern" value={formProduto.descricao} onChange={e => setFormProduto(p => ({ ...p, descricao: e.target.value.toUpperCase() }))} placeholder="OBSERVAÇÕES SOBRE O PRODUTO..." />
              </div>
            </div>

            {erroProduto && <div className="status-err" style={{ marginTop: '14px' }}>{erroProduto}</div>}

            <div style={{ display: 'flex', gap: '10px', marginTop: '20px', justifyContent: 'flex-end' }}>
              <button style={btnOutline} onClick={() => setModalProduto(false)}>Cancelar</button>
              <button style={btnPrimary} onClick={salvarProduto} disabled={salvandoProduto}>
                {salvandoProduto ? 'Salvando...' : editandoProduto ? 'Salvar alterações' : 'Cadastrar produto'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══ MODAL CATEGORIA ════════════════════════════════════════════ */}
      {modalCategoria && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setModalCategoria(false)}>
          <div className="modal-card" style={{ width: '500px', maxWidth: '95vw', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ fontFamily: 'Sora, sans-serif', fontSize: '16px', fontWeight: '700', color: '#4f46e5', margin: 0 }}>
                {editandoCategoria ? '✏️ Editar categoria' : '🏷️ Gerenciar categorias'}
              </h2>
              <button onClick={() => { setModalCategoria(false); setEditandoCategoria(null) }} style={{ background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer', color: '#94a3b8' }}>✕</button>
            </div>

            {/* Lista de categorias existentes */}
            {!editandoCategoria && (
              <div style={{ marginBottom: '20px' }}>
                <p style={{ fontSize: '12px', fontWeight: '600', color: '#64748b', fontFamily: 'DM Sans, sans-serif', margin: '0 0 10px', textTransform: 'uppercase' }}>Categorias existentes</p>
                {categorias.length === 0
                  ? <p style={{ fontSize: '13px', color: '#94a3b8', fontFamily: 'DM Sans, sans-serif' }}>Nenhuma categoria cadastrada.</p>
                  : categorias.map(cat => (
                    <div key={cat.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', borderRadius: '10px', border: '1px solid #f1f5f9', marginBottom: '6px', background: '#fafbff' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{ width: '14px', height: '14px', borderRadius: '4px', background: cat.cor || '#6b7280', flexShrink: 0 }} />
                        <span style={{ fontSize: '13px', fontWeight: '600', color: '#1e293b', fontFamily: 'DM Sans, sans-serif' }}>{cat.nome}</span>
                      </div>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button
                          onClick={() => abrirEditarCategoria(cat)}
                          style={{ background: COR_BG, color: COR, border: 'none', borderRadius: '7px', padding: '5px 10px', cursor: 'pointer', fontSize: '12px', fontWeight: '600', fontFamily: 'DM Sans, sans-serif' }}>
                          ✏️ Editar
                        </button>
                        <button
                          onClick={() => excluirCategoria(cat)}
                          style={{ background: 'rgba(239,68,68,0.08)', color: '#ef4444', border: 'none', borderRadius: '7px', padding: '5px 10px', cursor: 'pointer', fontSize: '12px', fontWeight: '600', fontFamily: 'DM Sans, sans-serif' }}>
                          🗑️ Excluir
                        </button>
                      </div>
                    </div>
                  ))
                }
                <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '16px', marginTop: '10px' }}>
                  <p style={{ fontSize: '12px', fontWeight: '600', color: '#64748b', fontFamily: 'DM Sans, sans-serif', margin: '0 0 10px', textTransform: 'uppercase' }}>Nova categoria</p>
                </div>
              </div>
            )}

            {/* Formulário */}
            {editandoCategoria && (
              <button onClick={() => setEditandoCategoria(null)} style={{ background: 'none', border: 'none', color: '#64748b', fontSize: '12px', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif', marginBottom: '14px', padding: 0 }}>
                ← Voltar para a lista
              </button>
            )}
            <label className="label-modern">Nome *</label>
            <input className="input-modern" value={formCategoria.nome} onChange={e => setFormCategoria(c => ({ ...c, nome: e.target.value.toUpperCase() }))} placeholder="EX: MEDICAMENTOS" style={{ marginBottom: '14px' }} />
            <label className="label-modern">Cor</label>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '20px' }}>
              <input type="color" value={formCategoria.cor} onChange={e => setFormCategoria(c => ({ ...c, cor: e.target.value }))}
                style={{ width: '44px', height: '38px', border: '1px solid #e2e8f0', borderRadius: '8px', cursor: 'pointer', padding: '2px' }} />
              <div style={{ flex: 1, background: formCategoria.cor + '22', border: `1px solid ${formCategoria.cor}55`, borderRadius: '8px', padding: '8px 12px', fontSize: '13px', fontWeight: '600', color: formCategoria.cor, fontFamily: 'DM Sans, sans-serif' }}>
                {formCategoria.nome || 'Pré-visualização'}
              </div>
            </div>
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button style={btnOutline} onClick={() => { setModalCategoria(false); setEditandoCategoria(null) }}>Fechar</button>
              <button style={btnPrimary} onClick={salvarCategoria} disabled={salvandoCat}>
                {salvandoCat ? 'Salvando...' : editandoCategoria ? 'Salvar alterações' : 'Criar categoria'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══ MODAL MOVIMENTAÇÃO ═════════════════════════════════════════ */}
      {modalMov && produtoMovendo && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setModalMov(false)}>
          <div className="modal-card" style={{ width: '420px', maxWidth: '95vw' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <h2 style={{ fontFamily: 'Sora, sans-serif', fontSize: '16px', fontWeight: '700', color: '#4f46e5', margin: 0 }}>
                Registrar movimentação
              </h2>
              <button onClick={() => setModalMov(false)} style={{ background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer', color: '#94a3b8' }}>✕</button>
            </div>

            {/* Produto info */}
            <div style={{ background: '#f8fafc', borderRadius: '10px', padding: '12px 14px', marginBottom: '18px' }}>
              <div style={{ fontWeight: '700', fontSize: '14px', color: '#1e293b', fontFamily: 'DM Sans, sans-serif' }}>{produtoMovendo.nome}</div>
              <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px', fontFamily: 'DM Sans, sans-serif' }}>
                Estoque atual: <strong style={{ color: statusEstoque(produtoMovendo).cor }}>{produtoMovendo.quantidade_atual} {produtoMovendo.unidade}</strong>
              </div>
            </div>

            {/* Tipo */}
            <label className="label-modern">Tipo de movimentação</label>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
              {[
                { value: 'entrada', label: '▲ Entrada', cor: '#10b981', bg: 'rgba(16,185,129,0.1)' },
                { value: 'saida',   label: '▼ Saída',   cor: '#ef4444', bg: 'rgba(239,68,68,0.1)' },
                { value: 'ajuste',  label: '⟳ Ajuste',  cor: '#f59e0b', bg: 'rgba(245,158,11,0.1)' },
              ].map(t => (
                <button key={t.value}
                  style={{ flex: 1, padding: '9px', border: formMov.tipo === t.value ? `2px solid ${t.cor}` : '2px solid #e2e8f0', borderRadius: '10px', background: formMov.tipo === t.value ? t.bg : 'white', color: formMov.tipo === t.value ? t.cor : '#94a3b8', fontWeight: '700', fontSize: '12px', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif', transition: 'all 0.15s' }}
                  onClick={() => setFormMov(f => ({ ...f, tipo: t.value }))}>
                  {t.label}
                </button>
              ))}
            </div>

            <label className="label-modern">
              {formMov.tipo === 'ajuste' ? 'Nova quantidade (absoluta)' : 'Quantidade'}
            </label>
            <input
              className="input-modern"
              type="number"
              min="0.001"
              step="any"
              value={formMov.quantidade}
              onChange={e => setFormMov(f => ({ ...f, quantidade: e.target.value }))}
              placeholder={formMov.tipo === 'ajuste' ? 'Quantidade real do estoque...' : 'Ex: 10'}
              style={{ marginBottom: '14px' }}
              autoFocus
            />

            {/* Destino (saída) ou Origem (entrada) */}
            {formMov.tipo === 'saida' && (
              <>
                <label className="label-modern">Destino *</label>
                <select className="input-modern" value={formMov.destino} onChange={e => setFormMov(f => ({ ...f, destino: e.target.value }))} style={{ marginBottom: '14px' }}>
                  <option value="">Selecionar destino...</option>
                  {DESTINOS_SAIDA.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </>
            )}
            {formMov.tipo === 'entrada' && (
              <>
                <label className="label-modern">Origem</label>
                <select className="input-modern" value={formMov.motivo} onChange={e => setFormMov(f => ({ ...f, motivo: e.target.value }))} style={{ marginBottom: '14px' }}>
                  <option value="">Selecionar origem...</option>
                  {ORIGENS_ENTRADA.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              </>
            )}
            {formMov.tipo === 'ajuste' && (
              <>
                <label className="label-modern">Motivo do ajuste</label>
                <select className="input-modern" value={formMov.motivo} onChange={e => setFormMov(f => ({ ...f, motivo: e.target.value }))} style={{ marginBottom: '14px' }}>
                  <option value="">Selecionar...</option>
                  {['Inventário', 'Correção de lançamento', 'Perda/Vencimento', 'Outro'].map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              </>
            )}

            <label className="label-modern">Observação</label>
            <input className="input-modern" value={formMov.observacao} onChange={e => setFormMov(f => ({ ...f, observacao: e.target.value }))} placeholder="Informações adicionais (opcional)..." />

            {erroMov && <div className="status-err" style={{ marginTop: '12px' }}>{erroMov}</div>}

            {formMov.tipo !== 'ajuste' && formMov.quantidade && (
              <div style={{ marginTop: '12px', background: '#f8fafc', borderRadius: '8px', padding: '10px 14px', fontSize: '13px', color: '#64748b', fontFamily: 'DM Sans, sans-serif' }}>
                Estoque após: <strong style={{ color: '#1e293b' }}>
                  {formMov.tipo === 'entrada'
                    ? Number(produtoMovendo.quantidade_atual) + Number(formMov.quantidade)
                    : Number(produtoMovendo.quantidade_atual) - Number(formMov.quantidade)
                  } {produtoMovendo.unidade}
                </strong>
              </div>
            )}

            <div style={{ display: 'flex', gap: '10px', marginTop: '20px', justifyContent: 'flex-end' }}>
              <button style={btnOutline} onClick={() => setModalMov(false)}>Cancelar</button>
              <button style={btnPrimary} onClick={registrarMovimentacao} disabled={salvandoMov}>
                {salvandoMov ? 'Registrando...' : 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  )
}
