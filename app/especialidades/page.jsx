'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Layout from '@/components/Layout'

const ESPECIALIDADES = [
  { id: 'ortopedia',    label: 'Ortopedia',    icon: '🦴', cota: 30 },
  { id: 'ginecologia',  label: 'Ginecologia',  icon: '🩺', cota: 30 },
  { id: 'oftalmologia', label: 'Oftalmologia', icon: '👁️', cota: 30 },
  { id: 'urologia',     label: 'Urologia',     icon: '🔬', cota: 30 },
  { id: 'usg',          label: 'USG',          icon: '📡', cota: 60 },
]

const MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']

const COR       = '#b45309'
const COR_DARK  = '#92400e'
const GRAD      = 'linear-gradient(135deg, #92400e, #b45309)'

const STATUS_STYLE = {
  pendente:   { bg: '#fef9c3', cor: '#854d0e', borda: '#fde047' },
  autorizado: { bg: '#dcfce7', cor: '#166534', borda: '#86efac' },
  negado:     { bg: '#fee2e2', cor: '#991b1b', borda: '#fca5a5' },
}
const STATUS_LABEL = { pendente: 'Pendente', autorizado: 'Autorizado', negado: 'Negado' }

const CONSELHOS = ['CRM','CRO','CREFITO','CRM-RJ','CRM-GO','CRM-DF','Outro']

const TIPOS_USG = [
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
const TIPOS_CONSULTA = ['Primeira Consulta','Retorno','Outro']

// ── Helpers ──────────────────────────────────────────────────────────────────
function fmtData(v) {
  if (!v) return '—'
  const [a, m, d] = String(v).split('-')
  return `${d}/${m}/${a}`
}

// ── Modal base ────────────────────────────────────────────────────────────────
function Modal({ titulo, onClose, children, largura = '520px' }) {
  useEffect(() => {
    function esc(e) { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', esc)
    return () => window.removeEventListener('keydown', esc)
  }, [onClose])
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{ background: 'white', borderRadius: '16px', width: '100%', maxWidth: largura, boxShadow: '0 25px 60px rgba(0,0,0,0.3)', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ fontFamily: 'Sora, sans-serif', fontSize: '15px', fontWeight: '700', color: '#0f172a', margin: 0 }}>{titulo}</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer', color: '#64748b', lineHeight: 1, padding: '0 4px' }}>✕</button>
        </div>
        <div style={{ padding: '20px 24px', overflowY: 'auto', flex: 1 }}>{children}</div>
      </div>
    </div>
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
      let query = supabase.from('pacientes').select('id, nome, cpf_cns, telefone').order('nome').limit(8)
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
  const [form, setForm] = useState({ paciente_nome: '', paciente_cns: '', telefone: '', data_consulta: '', tipo_exame: '', observacao: '', profissional_nome: '' })
  const [salvando, setSalvando] = useState(false)

  // Modal profissionais
  const [modalProf, setModalProf] = useState(false)
  const [formProf, setFormProf] = useState({ nome: '', conselho_tipo: 'CRM', conselho_numero: '' })
  const [salvandoProf, setSalvandoProf] = useState(false)

  // Modal escala
  const [modalEscala, setModalEscala] = useState(false)
  const [salvandoEscala, setSalvandoEscala] = useState(false)
  const [profEscalaSel, setProfEscalaSel] = useState('')
  const [dataEscala, setDataEscala] = useState('')

  // Modal cancelamento
  const [modalCancel, setModalCancel] = useState({ show: false, id: null })
  const [motivoCancel, setMotivoCancel] = useState('')

  // Relatório
  const [relatorio, setRelatorio] = useState([])
  const [relMes, setRelMes] = useState(() => String(new Date().getMonth() + 1).padStart(2, '0'))
  const [relAno, setRelAno] = useState(() => String(new Date().getFullYear()))
  const [relLoading, setRelLoading] = useState(false)

  useEffect(() => {
    const u = localStorage.getItem('sms_user')
    if (!u) { router.push('/'); return }
    setUsuario(JSON.parse(u))
  }, [])

  // Carregar dados ao mudar especialidade/mes/ano
  useEffect(() => { if (abaMain === 'agendamento') { buscarAgendamentos(); buscarEscala(); buscarProfissionais() } }, [esp, mes, ano, abaMain])

  useEffect(() => { if (abaMain === 'relatorio') buscarRelatorio() }, [abaMain, relMes, relAno])

  function mostrarMsg(txt, ok = true) {
    setMsg({ txt, ok })
    setTimeout(() => setMsg({ txt: '', ok: true }), 5000)
  }

  // ── Busca de dados ────────────────────────────────────────────────────────
  async function buscarAgendamentos() {
    setLoading(true)
    try {
      const p = new URLSearchParams({ especialidade: esp, mes, ano })
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
    } catch {}
  }

  async function buscarProfissionais() {
    try {
      const p = new URLSearchParams({ especialidade: esp })
      const res = await fetch('/api/especialidades/profissionais?' + p)
      const json = await res.json()
      if (json.ok) setProfissionais(json.data || [])
    } catch {}
  }

  async function buscarRelatorio() {
    setRelLoading(true)
    try {
      const { data } = await supabase
        .from('especialidades_agendamentos')
        .select('especialidade, status')
        .eq('mes', relMes)
        .eq('ano', relAno)
      const mapa = {}
      ESPECIALIDADES.forEach(e => { mapa[e.id] = { label: e.label, icon: e.icon, cota: e.cota, pendente: 0, autorizado: 0, negado: 0 } })
      ;(data || []).forEach(r => { if (mapa[r.especialidade]) mapa[r.especialidade][r.status]++ })
      setRelatorio(Object.values(mapa))
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
    }))
  }

  async function salvarAgendamento() {
    const isUsg = esp === 'usg'
    if (!form.paciente_nome.trim() || !form.telefone.trim() || !form.data_consulta) {
      mostrarMsg('Preencha nome, telefone e data', false); return
    }
    if (isUsg && !form.tipo_exame) {
      mostrarMsg('Selecione o tipo de exame', false); return
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
          tipo_exame: form.tipo_exame || null,
          observacao: form.observacao.trim() || null,
          profissional_nome: form.profissional_nome || null,
          mes, ano,
          criado_por: usuario?.nome || null,
        })
      })
      const json = await res.json()
      if (!json.ok) throw new Error(json.error)
      mostrarMsg('✅ Agendamento registrado')
      setForm({ paciente_nome: '', paciente_cns: '', telefone: '', data_consulta: '', tipo_exame: '', observacao: '', profissional_nome: '' })
      setMostrarForm(false)
      buscarAgendamentos()
    } catch (e) { mostrarMsg('❌ ' + e.message, false) }
    setSalvando(false)
  }

  // ── Status ────────────────────────────────────────────────────────────────
  async function autorizar(id) {
    try {
      const res = await fetch('/api/especialidades', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status: 'autorizado' })
      })
      const json = await res.json()
      if (!json.ok) throw new Error(json.error)
      setAgendamentos(prev => prev.map(a => a.id === id ? { ...a, status: 'autorizado', motivo_cancelamento: null } : a))
    } catch (e) { mostrarMsg('❌ ' + e.message, false) }
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
      setAgendamentos(prev => prev.map(a => a.id === id ? { ...a, status: 'pendente', motivo_cancelamento: null } : a))
    } catch (e) { mostrarMsg('❌ ' + e.message, false) }
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
    } catch (e) { mostrarMsg('❌ ' + e.message, false) }
  }

  async function excluir(id) {
    if (!confirm('Remover este agendamento?')) return
    try {
      const res = await fetch('/api/especialidades?id=' + id, { method: 'DELETE' })
      const json = await res.json()
      if (!json.ok) throw new Error(json.error)
      setAgendamentos(prev => prev.filter(a => a.id !== id))
    } catch (e) { mostrarMsg('❌ ' + e.message, false) }
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
      mostrarMsg('✅ Profissional cadastrado')
      setFormProf({ nome: '', conselho_tipo: 'CRM', conselho_numero: '' })
      buscarProfissionais()
    } catch (e) { mostrarMsg('❌ ' + e.message, false) }
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
    } catch (e) { mostrarMsg('❌ ' + e.message, false) }
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
        body: JSON.stringify({ especialidade: esp, profissional_id: prof.id, profissional_nome: prof.nome, mes, ano, data_atendimento: dataEscala })
      })
      const json = await res.json()
      if (!json.ok) throw new Error(json.error)
      setProfEscalaSel('')
      setDataEscala('')
      buscarEscala()
    } catch (e) { mostrarMsg('❌ ' + e.message, false) }
    setSalvandoEscala(false)
  }

  async function removerEscala(id) {
    try {
      await fetch('/api/especialidades/escala?id=' + id, { method: 'DELETE' })
      setEscala(prev => prev.filter(e => e.id !== id))
    } catch (e) { mostrarMsg('❌ ' + e.message, false) }
  }

  // ── Cálculos de cota ──────────────────────────────────────────────────────
  const espAtiva = ESPECIALIDADES.find(e => e.id === esp)
  const autorizados = agendamentos.filter(a => a.status === 'autorizado').length
  const usados = agendamentos.filter(a => a.status !== 'negado').length
  const pct = Math.min(100, Math.round((usados / espAtiva.cota) * 100))

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <Layout usuario={usuario}>
      <div style={{ padding: '28px', maxWidth: '1000px', margin: '0 auto' }}>

        {/* Cabeçalho */}
        <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h1 style={{ fontFamily: 'Sora, sans-serif', fontSize: '22px', fontWeight: '700', color: '#0f172a', margin: '0 0 4px' }}>Especialidades</h1>
            <p style={{ color: '#64748b', fontSize: '13px', margin: 0 }}>Agendamento e autorização de consultas e exames</p>
          </div>
          {abaMain === 'agendamento' && (
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
              <div>
                <label style={{ fontSize: '11px', color: '#64748b', fontFamily: 'DM Sans, sans-serif', display: 'block', marginBottom: '3px' }}>Mês</label>
                <select className="input-modern" value={mes} onChange={e => setMes(e.target.value)} style={{ width: '140px' }}>
                  {MESES.map((n, i) => (
                    <option key={i} value={String(i + 1).padStart(2, '0')}>{String(i + 1).padStart(2, '0')} — {n}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={{ fontSize: '11px', color: '#64748b', fontFamily: 'DM Sans, sans-serif', display: 'block', marginBottom: '3px' }}>Ano</label>
                <input className="input-modern" type="number" value={ano} onChange={e => setAno(e.target.value)} min="2020" max="2099" style={{ width: '90px' }} />
              </div>
              <div style={{ display: 'flex', gap: '6px', alignSelf: 'flex-end', paddingBottom: '1px' }}>
                <button onClick={() => setModalProf(true)}
                  style={{ padding: '9px 14px', background: 'linear-gradient(135deg, #1e40af, #2563eb)', border: 'none', borderRadius: '10px', color: 'white', fontSize: '12px', fontWeight: '700', cursor: 'pointer', fontFamily: 'Sora, sans-serif', whiteSpace: 'nowrap' }}>
                  👨‍⚕️ Profissionais
                </button>
                <button onClick={() => setModalEscala(true)}
                  style={{ padding: '9px 14px', background: 'linear-gradient(135deg, #065f46, #047857)', border: 'none', borderRadius: '10px', color: 'white', fontSize: '12px', fontWeight: '700', cursor: 'pointer', fontFamily: 'Sora, sans-serif', whiteSpace: 'nowrap' }}>
                  📅 Escala
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Abas principais */}
        <div style={{ display: 'flex', gap: '4px', borderBottom: '2px solid #e2e8f0', marginBottom: '20px' }}>
          {[{ id: 'agendamento', label: '📋 Agendamento' }, { id: 'relatorio', label: '📊 Relatório' }].map(t => (
            <button key={t.id} onClick={() => setAbaMain(t.id)}
              style={{ background: 'none', border: 'none', padding: '10px 18px', fontSize: '14px', fontWeight: '700', cursor: 'pointer', color: abaMain === t.id ? COR : '#64748b', borderBottom: abaMain === t.id ? `3px solid ${COR}` : '3px solid transparent', marginBottom: '-2px', fontFamily: 'Sora, sans-serif' }}>
              {t.label}
            </button>
          ))}
        </div>

        {msg.txt && (
          <div className={msg.ok ? 'status-ok' : 'status-err'} style={{ marginBottom: '16px' }}>{msg.txt}</div>
        )}

        {/* ── ABA: AGENDAMENTO ── */}
        {abaMain === 'agendamento' && (
          <>
            {/* Sub-abas especialidade */}
            <div style={{ display: 'flex', gap: '4px', marginBottom: '20px', borderBottom: '1px solid #e2e8f0', paddingBottom: '0', flexWrap: 'wrap' }}>
              {ESPECIALIDADES.map(e => (
                <button key={e.id} onClick={() => setEsp(e.id)}
                  style={{ background: 'none', border: 'none', padding: '8px 16px', fontSize: '13px', fontWeight: '700', cursor: 'pointer', color: esp === e.id ? COR : '#64748b', borderBottom: esp === e.id ? `3px solid ${COR}` : '3px solid transparent', marginBottom: '-1px', fontFamily: 'Sora, sans-serif' }}>
                  {e.icon} {e.label}
                </button>
              ))}
            </div>

            {/* Card cota + profissional escalado + botão novo */}
            <div className="card" style={{ padding: '20px', marginBottom: '20px' }}>
              <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                {/* Cota */}
                <div style={{ flex: 1, minWidth: '200px' }}>
                  <p style={{ fontFamily: 'Sora, sans-serif', fontSize: '11px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 6px' }}>
                    Cota — {espAtiva.label} / {MESES[Number(mes) - 1]}/{ano}
                  </p>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginBottom: '6px' }}>
                    <span style={{ fontFamily: 'Sora, sans-serif', fontSize: '28px', fontWeight: '800', color: pct >= 100 ? '#dc2626' : COR }}>{usados}</span>
                    <span style={{ fontSize: '15px', color: '#94a3b8', fontWeight: '600' }}>/ {espAtiva.cota}</span>
                    <span style={{ fontSize: '11px', color: '#64748b' }}>({autorizados} autorizado{autorizados !== 1 ? 's' : ''})</span>
                  </div>
                  <div style={{ background: '#e2e8f0', borderRadius: '999px', height: '7px', overflow: 'hidden', maxWidth: '260px' }}>
                    <div style={{ width: pct + '%', height: '100%', borderRadius: '999px', background: pct >= 100 ? '#dc2626' : pct >= 80 ? '#f59e0b' : '#16a34a', transition: 'width 0.4s' }} />
                  </div>
                  <p style={{ fontSize: '11px', color: pct >= 100 ? '#dc2626' : '#64748b', marginTop: '4px', fontFamily: 'DM Sans, sans-serif' }}>
                    {pct >= 100 ? '⚠️ Cota atingida' : `${espAtiva.cota - usados} vaga${espAtiva.cota - usados !== 1 ? 's' : ''} disponível${espAtiva.cota - usados !== 1 ? 'is' : ''}`}
                  </p>
                </div>

                {/* Profissional(is) na escala */}
                <div style={{ minWidth: '180px' }}>
                  <p style={{ fontFamily: 'Sora, sans-serif', fontSize: '11px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 6px' }}>
                    Escala {MESES[Number(mes) - 1]}/{ano}
                  </p>
                  {escala.length === 0
                    ? <p style={{ fontSize: '12px', color: '#94a3b8', fontStyle: 'italic' }}>Sem profissional escalado</p>
                    : escala.map(e => (
                      <div key={e.id} style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                        <span style={{ fontSize: '12px', fontWeight: '600', color: '#0f172a' }}>👨‍⚕️ {e.profissional_nome}</span>
                        {e.data_atendimento && (
                          <span style={{ fontSize: '11px', color: '#64748b', background: '#f1f5f9', padding: '1px 6px', borderRadius: '6px' }}>
                            {fmtData(e.data_atendimento)}
                          </span>
                        )}
                      </div>
                    ))}
                </div>

                {/* Botão novo */}
                <button onClick={() => setMostrarForm(v => !v)}
                  style={{ padding: '10px 20px', background: mostrarForm ? '#64748b' : GRAD, border: 'none', borderRadius: '10px', color: 'white', fontSize: '13px', fontWeight: '700', cursor: 'pointer', fontFamily: 'Sora, sans-serif', alignSelf: 'flex-start' }}>
                  {mostrarForm ? '✕ Cancelar' : '+ Novo Agendamento'}
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
                        onChange={e => setForm(f => ({ ...f, telefone: e.target.value }))}
                        style={{ width: '100%', borderColor: !form.telefone ? '#fca5a5' : undefined }} />
                    </div>
                    <div>
                      <label className="label-modern">{esp === 'usg' ? 'Data do Exame *' : 'Data da Consulta *'}</label>
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
                        {(esp === 'usg' ? TIPOS_USG : TIPOS_CONSULTA).map(t => (
                          <option key={t} value={t}>{t}</option>
                        ))}
                      </select>
                    </div>
                    {escala.length > 0 && (
                      <div>
                        <label className="label-modern">Profissional / Data de Atendimento</label>
                        <select className="input-modern"
                          value={escala.find(e => e.profissional_nome === form.profissional_nome && e.data_atendimento === form.data_consulta)?.id || ''}
                          onChange={e => {
                            const entrada = escala.find(x => x.id === e.target.value)
                            if (entrada) setForm(f => ({ ...f, profissional_nome: entrada.profissional_nome, data_consulta: entrada.data_atendimento || f.data_consulta }))
                            else setForm(f => ({ ...f, profissional_nome: '', data_consulta: '' }))
                          }}
                          style={{ width: '100%' }}>
                          <option value="">— Selecione —</option>
                          {escala.map(e => (
                            <option key={e.id} value={e.id}>
                              {e.profissional_nome}{e.data_atendimento ? ` — ${fmtData(e.data_atendimento)}` : ''}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
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
                      {salvando ? '⏳ Salvando...' : '💾 Salvar'}
                    </button>
                    <button className="btn-secondary" onClick={() => { setMostrarForm(false); setForm({ paciente_nome: '', paciente_cns: '', telefone: '', data_consulta: '', tipo_exame: '', observacao: '', profissional_nome: '' }) }}>Cancelar</button>
                  </div>
                </div>
              )}
            </div>

            {/* Lista de agendamentos */}
            <div className="card esp-print-area" style={{ padding: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
                <h3 style={{ fontFamily: 'Sora, sans-serif', fontSize: '13px', fontWeight: '700', color: '#0f172a', margin: 0, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  {espAtiva.icon} {espAtiva.label} — {MESES[Number(mes) - 1]}/{ano}
                </h3>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
                  {['pendente', 'autorizado', 'negado'].map(s => {
                    const st = STATUS_STYLE[s]
                    return (
                      <span key={s} style={{ fontSize: '11px', fontWeight: '700', padding: '3px 8px', borderRadius: '20px', background: st.bg, color: st.cor, border: `1px solid ${st.borda}` }}>
                        {STATUS_LABEL[s]}: {agendamentos.filter(a => a.status === s).length}
                      </span>
                    )
                  })}
                  {agendamentos.length > 0 && (
                    <button className="no-print" onClick={() => window.print()}
                      style={{ padding: '5px 12px', background: '#1e293b', border: 'none', borderRadius: '8px', color: 'white', fontSize: '11px', fontWeight: '700', cursor: 'pointer', fontFamily: 'Sora, sans-serif' }}>
                      🖨️ Imprimir Lista
                    </button>
                  )}
                </div>
              </div>
              {/* Cabeçalho de impressão — oculto na tela */}
              <div className="print-header-esp" style={{ display: 'none', marginBottom: '16px', borderBottom: '2px solid #000', paddingBottom: '10px' }}>
                <p style={{ fontFamily: 'Arial, sans-serif', fontSize: '13px', fontWeight: '700', margin: '0 0 2px', textTransform: 'uppercase' }}>
                  SECRETARIA MUNICIPAL DE SAÚDE — CONCEIÇÃO DO TOCANTINS/TO
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
              ) : agendamentos.length === 0 ? (
                <p style={{ color: '#94a3b8', fontSize: '13px', textAlign: 'center', padding: '32px 0', fontStyle: 'italic' }}>
                  Nenhum agendamento registrado para este período.
                </p>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                    <thead>
                      <tr style={{ borderBottom: '2px solid #e2e8f0' }}>
                        {['#', 'Paciente', 'CPF/CNS', 'Telefone', 'Tipo', 'Profissional', 'Data', 'Status', 'Obs / Motivo', 'Ações'].map(h => (
                          <th key={h} style={{ padding: '8px 10px', textAlign: 'left', fontFamily: 'Sora, sans-serif', fontSize: '10px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {agendamentos.map((a, i) => {
                        const st = STATUS_STYLE[a.status] || STATUS_STYLE.pendente
                        return (
                          <tr key={a.id} style={{ borderBottom: '1px solid #f1f5f9' }}
                            onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                            <td style={{ padding: '10px', color: '#94a3b8', fontSize: '12px' }}>{i + 1}</td>
                            <td style={{ padding: '10px', fontWeight: '600', color: '#0f172a', whiteSpace: 'nowrap' }}>{a.paciente_nome}</td>
                            <td style={{ padding: '10px', color: '#64748b', fontFamily: 'monospace', fontSize: '11px' }}>{a.paciente_cns || '—'}</td>
                            <td style={{ padding: '10px', color: '#475569', fontSize: '12px', whiteSpace: 'nowrap' }}>{a.telefone || '—'}</td>
                            <td style={{ padding: '10px', fontSize: '12px', color: '#0f172a', whiteSpace: 'nowrap', fontWeight: a.tipo_exame ? '500' : '400' }}>{a.tipo_exame || '—'}</td>
                            <td style={{ padding: '10px', fontSize: '12px', color: '#475569', whiteSpace: 'nowrap' }}>{a.profissional_nome || '—'}</td>
                            <td style={{ padding: '10px', whiteSpace: 'nowrap', color: '#475569' }}>{fmtData(a.data_consulta)}</td>
                            <td style={{ padding: '10px' }}>
                              <span style={{ fontSize: '11px', fontWeight: '700', padding: '3px 9px', borderRadius: '20px', background: st.bg, color: st.cor, border: `1px solid ${st.borda}`, whiteSpace: 'nowrap' }}>
                                {STATUS_LABEL[a.status]}
                              </span>
                            </td>
                            <td style={{ padding: '10px', maxWidth: '160px' }}>
                              {a.status === 'negado' && a.motivo_cancelamento
                                ? <span style={{ fontSize: '11px', color: '#991b1b', fontStyle: 'italic' }} title={a.motivo_cancelamento}>
                                    {a.motivo_cancelamento.length > 28 ? a.motivo_cancelamento.slice(0, 28) + '…' : a.motivo_cancelamento}
                                  </span>
                                : <span style={{ fontSize: '11px', color: '#94a3b8' }}>{a.observacao || '—'}</span>
                              }
                            </td>
                            <td style={{ padding: '10px' }}>
                              <div style={{ display: 'flex', gap: '4px', flexWrap: 'nowrap' }}>
                                {a.status !== 'autorizado' && (
                                  <button onClick={() => autorizar(a.id)} title="Autorizar"
                                    style={{ padding: '4px 8px', fontSize: '11px', fontWeight: '700', background: '#dcfce7', border: '1px solid #86efac', borderRadius: '6px', color: '#166534', cursor: 'pointer' }}>
                                    ✓ Autorizar
                                  </button>
                                )}
                                {a.status !== 'negado' && (
                                  <button onClick={() => { setModalCancel({ show: true, id: a.id }); setMotivoCancel('') }} title="Cancelar"
                                    style={{ padding: '4px 8px', fontSize: '11px', fontWeight: '700', background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: '6px', color: '#991b1b', cursor: 'pointer' }}>
                                    ✗ Negar
                                  </button>
                                )}
                                {a.status !== 'pendente' && (
                                  <button onClick={() => voltarPendente(a.id)} title="Voltar para pendente"
                                    style={{ padding: '4px 8px', fontSize: '11px', fontWeight: '700', background: '#fef9c3', border: '1px solid #fde047', borderRadius: '6px', color: '#854d0e', cursor: 'pointer' }}>
                                    ↩
                                  </button>
                                )}
                                <button onClick={() => excluir(a.id)} title="Excluir"
                                  style={{ padding: '4px 8px', fontSize: '11px', fontWeight: '700', background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '6px', color: '#64748b', cursor: 'pointer' }}>
                                  🗑
                                </button>
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}

        {/* ── ABA: RELATÓRIO ── */}
        {abaMain === 'relatorio' && (
          <div>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-end', marginBottom: '20px', flexWrap: 'wrap' }}>
              <div>
                <label className="label-modern">Mês</label>
                <select className="input-modern" value={relMes} onChange={e => setRelMes(e.target.value)} style={{ width: '150px' }}>
                  {MESES.map((n, i) => <option key={i} value={String(i + 1).padStart(2, '0')}>{String(i + 1).padStart(2, '0')} — {n}</option>)}
                </select>
              </div>
              <div>
                <label className="label-modern">Ano</label>
                <input className="input-modern" type="number" value={relAno} onChange={e => setRelAno(e.target.value)} min="2020" max="2099" style={{ width: '90px' }} />
              </div>
              <button className="btn-primary" style={{ background: GRAD }} onClick={buscarRelatorio}>🔄 Atualizar</button>
              <button className="btn-secondary" onClick={() => window.print()}>🖨️ Imprimir</button>
            </div>

            <div className="card print-area" style={{ padding: '20px' }}>
              <h3 className="print-title" style={{ fontFamily: 'Sora, sans-serif', fontSize: '15px', fontWeight: '700', color: '#0f172a', margin: '0 0 16px' }}>
                Relatório de Especialidades — {MESES[Number(relMes) - 1]}/{relAno}
              </h3>
              {relLoading ? (
                <p style={{ color: '#64748b', fontSize: '13px', textAlign: 'center', padding: '24px 0' }}>Carregando...</p>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ background: GRAD, WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}>
                      {['Especialidade', 'Cota', 'Pendente', 'Autorizado', 'Negado', 'Total (excl. negado)', '% da Cota'].map(h => (
                        <th key={h} style={{ padding: '10px 12px', color: 'white', textAlign: 'left', fontFamily: 'Sora, sans-serif', fontSize: '11px', fontWeight: '700', letterSpacing: '0.05em' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {relatorio.map((r, i) => {
                      const total = r.pendente + r.autorizado
                      const pct2 = Math.round((total / r.cota) * 100)
                      return (
                        <tr key={i} style={{ borderBottom: '1px solid #e2e8f0', background: i % 2 === 0 ? '#fff' : '#f8fafc', WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}>
                          <td style={{ padding: '10px 12px', fontWeight: '700', color: '#0f172a' }}>{r.icon} {r.label}</td>
                          <td style={{ padding: '10px 12px', color: '#475569', fontWeight: '600' }}>{r.cota}</td>
                          <td style={{ padding: '10px 12px' }}>
                            <span style={{ background: STATUS_STYLE.pendente.bg, color: STATUS_STYLE.pendente.cor, padding: '2px 8px', borderRadius: '12px', fontSize: '12px', fontWeight: '700' }}>{r.pendente}</span>
                          </td>
                          <td style={{ padding: '10px 12px' }}>
                            <span style={{ background: STATUS_STYLE.autorizado.bg, color: STATUS_STYLE.autorizado.cor, padding: '2px 8px', borderRadius: '12px', fontSize: '12px', fontWeight: '700' }}>{r.autorizado}</span>
                          </td>
                          <td style={{ padding: '10px 12px' }}>
                            <span style={{ background: STATUS_STYLE.negado.bg, color: STATUS_STYLE.negado.cor, padding: '2px 8px', borderRadius: '12px', fontSize: '12px', fontWeight: '700' }}>{r.negado}</span>
                          </td>
                          <td style={{ padding: '10px 12px', fontWeight: '700', color: total >= r.cota ? '#dc2626' : '#0f172a' }}>{total}</td>
                          <td style={{ padding: '10px 12px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <div style={{ background: '#e2e8f0', borderRadius: '999px', height: '6px', width: '80px', overflow: 'hidden' }}>
                                <div style={{ width: Math.min(100, pct2) + '%', height: '100%', borderRadius: '999px', background: pct2 >= 100 ? '#dc2626' : pct2 >= 80 ? '#f59e0b' : '#16a34a' }} />
                              </div>
                              <span style={{ fontSize: '12px', fontWeight: '700', color: pct2 >= 100 ? '#dc2626' : '#475569' }}>{pct2}%</span>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                  <tfoot>
                    <tr style={{ borderTop: '2px solid #e2e8f0', background: '#f8fafc' }}>
                      <td style={{ padding: '10px 12px', fontWeight: '700', fontFamily: 'Sora, sans-serif', color: '#0f172a' }}>TOTAL</td>
                      <td style={{ padding: '10px 12px', fontWeight: '700', color: '#475569' }}>{relatorio.reduce((s, r) => s + r.cota, 0)}</td>
                      <td style={{ padding: '10px 12px', fontWeight: '700', color: STATUS_STYLE.pendente.cor }}>{relatorio.reduce((s, r) => s + r.pendente, 0)}</td>
                      <td style={{ padding: '10px 12px', fontWeight: '700', color: STATUS_STYLE.autorizado.cor }}>{relatorio.reduce((s, r) => s + r.autorizado, 0)}</td>
                      <td style={{ padding: '10px 12px', fontWeight: '700', color: STATUS_STYLE.negado.cor }}>{relatorio.reduce((s, r) => s + r.negado, 0)}</td>
                      <td style={{ padding: '10px 12px', fontWeight: '700', color: '#0f172a' }}>{relatorio.reduce((s, r) => s + r.pendente + r.autorizado, 0)}</td>
                      <td />
                    </tr>
                  </tfoot>
                </table>
              )}
            </div>
            <style dangerouslySetInnerHTML={{__html: `
              @media print {
                body * { visibility: hidden; }
                .print-area, .print-area * { visibility: visible; }
                .print-area { position: absolute; left: 0; top: 0; width: 100%; }
                .print-title { display: block !important; }
              }
            `}} />
          </div>
        )}
      </div>

      {/* ── MODAL: CANCELAMENTO ── */}
      {modalCancel.show && (
        <Modal titulo="Cancelar / Negar Agendamento" onClose={() => { setModalCancel({ show: false, id: null }); setMotivoCancel('') }}>
          <p style={{ fontSize: '13px', color: '#64748b', margin: '0 0 14px' }}>
            Informe o motivo do cancelamento. Este campo é <strong>obrigatório</strong>.
          </p>
          <label className="label-modern">Motivo *</label>
          <textarea className="input-modern" rows={3} placeholder="Ex: Paciente desistiu, sem vaga na referência, duplicidade..."
            value={motivoCancel}
            onChange={e => setMotivoCancel(e.target.value)}
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

      {/* ── MODAL: PROFISSIONAIS ── */}
      {modalProf && (
        <Modal titulo={`👨‍⚕️ Profissionais — ${espAtiva.label}`} onClose={() => setModalProf(false)} largura="580px">
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
              {salvandoProf ? '⏳...' : '+ Adicionar'}
            </button>
          </div>

          {/* Lista */}
          {profissionais.length === 0
            ? <p style={{ color: '#94a3b8', fontSize: '13px', textAlign: 'center', padding: '16px 0' }}>Nenhum profissional cadastrado para {espAtiva.label}.</p>
            : profissionais.map(p => (
              <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', borderRadius: '8px', marginBottom: '6px', background: '#f8fafc', border: '1px solid #e2e8f0' }}>
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
            ))
          }
        </Modal>
      )}

      <style dangerouslySetInnerHTML={{__html: `
        @media print {
          body * { visibility: hidden; }
          .esp-print-area, .esp-print-area * { visibility: visible; }
          .esp-print-area { position: absolute; left: 0; top: 0; width: 100%; padding: 0 !important; border: none !important; box-shadow: none !important; }
          .no-print { display: none !important; }
          .print-header-esp { display: block !important; }
        }
      `}} />

      {/* ── MODAL: ESCALA ── */}
      {modalEscala && (
        <Modal titulo={`📅 Escala — ${espAtiva.label} / ${MESES[Number(mes) - 1]}/${ano}`} onClose={() => setModalEscala(false)}>
          {profissionais.length === 0 ? (
            <p style={{ color: '#64748b', fontSize: '13px' }}>
              Nenhum profissional cadastrado. Cadastre profissionais primeiro em <strong>Profissionais</strong>.
            </p>
          ) : (
            <div style={{ marginBottom: '20px', padding: '14px', background: '#f0fdf4', borderRadius: '10px', border: '1px solid #bbf7d0' }}>
              <p style={{ fontFamily: 'Sora, sans-serif', fontSize: '11px', fontWeight: '700', color: '#065f46', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 10px' }}>Adicionar à escala</p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
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
              </div>
              <button className="btn-primary" style={{ background: 'linear-gradient(135deg, #065f46, #047857)' }}
                onClick={adicionarEscala} disabled={salvandoEscala || !profEscalaSel || !dataEscala}>
                {salvandoEscala ? '⏳...' : '+ Adicionar à Escala'}
              </button>
            </div>
          )}

          <p style={{ fontFamily: 'Sora, sans-serif', fontSize: '11px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 10px' }}>Na escala</p>
          {escala.length === 0
            ? <p style={{ color: '#94a3b8', fontSize: '13px', fontStyle: 'italic' }}>Nenhum profissional escalado para este período.</p>
            : escala.map(e => (
              <div key={e.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', borderRadius: '8px', marginBottom: '6px', background: '#f0fdf4', border: '1px solid #bbf7d0' }}>
                <div>
                  <span style={{ fontWeight: '700', fontSize: '13px', color: '#166534' }}>👨‍⚕️ {e.profissional_nome}</span>
                  {e.data_atendimento && (
                    <span style={{ fontSize: '12px', color: '#047857', marginLeft: '10px', fontWeight: '600' }}>
                      📅 {fmtData(e.data_atendimento)}
                    </span>
                  )}
                </div>
                <button onClick={() => removerEscala(e.id)}
                  style={{ padding: '4px 10px', fontSize: '11px', background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: '6px', color: '#991b1b', cursor: 'pointer', fontWeight: '700' }}>
                  Remover
                </button>
              </div>
            ))
          }
        </Modal>
      )}
    </Layout>
  )
}
