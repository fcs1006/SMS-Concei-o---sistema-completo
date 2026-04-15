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
  { id: 'psiquiatria',  label: 'Psiquiatria',  icon: '🧠', cota: 30 },
]

const MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']

const COR       = '#b45309'
const COR_DARK  = '#92400e'
const GRAD      = 'linear-gradient(135deg, #92400e, #b45309)'

const STATUS_STYLE = {
  pendente:   { bg: '#fef9c3', cor: '#854d0e', borda: '#fde047' },
  autorizado: { bg: '#dcfce7', cor: '#166534', borda: '#86efac' },
  negado:     { bg: '#fee2e2', cor: '#991b1b', borda: '#fca5a5' },
  excluido:   { bg: '#f1f5f9', cor: '#475569', borda: '#cbd5e1' },
}
const STATUS_LABEL = { pendente: 'Pendente', autorizado: 'Autorizado', negado: 'Negado', excluido: 'Excluído' }

const CONSELHOS = ['CRM','CRO','CREFITO','CRM-RJ','CRM-GO','CRM-DF','Outro']

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
  'ABDOMEN TOTAL':        'JEJUM DE 8 HORAS. 40 GOTAS DIMETICONA ANTES DE DORMIR NO DIA ANTERIOR.',
  'ABDOMEN SUPERIOR':     'JEJUM DE 8 HORAS. 40 GOTAS DIMETICONA ANTES DE DORMIR NO DIA ANTERIOR.',
  'VIAS URINÁRIAS':       'BEXIGA CHEIA (BEBER 1 LITRO DE ÁGUA 1 HORA ANTES E NÃO URINAR).',
  'PÉLVICA':              'BEXIGA CHEIA (BEBER 1 LITRO DE ÁGUA 1 HORA ANTES E NÃO URINAR).',
  'PRÓSTATA ABDOMINAL':   'JEJUM DE 8 HORAS. 40 GOTAS DIMETICONA ANTES DE DORMIR NO DIA ANTERIOR. BEXIGA CHEIA.',
  'PRÓSTATA TRANSRETAL':  'JEJUM DE 8 HORAS. 40 GOTAS DIMETICONA ANTES DE DORMIR NO DIA ANTERIOR. BEXIGA CHEIA.',
}
const TIPOS_CONSULTA = ['Primeira Consulta','Retorno','Outro']

// ── Helpers ──────────────────────────────────────────────────────────────────
function fmtData(v) {
  if (!v) return '—'
  const [a, m, d] = String(v).split('-')
  return `${d}/${m}/${a}`
}

// ── Comprovante de Autorização ────────────────────────────────────────────────
function imprimirComprovante(ag, espLabel, municipio = 'Conceição do Tocantins/TO', preparos = PREPARO_USG) {
  const hoje = new Date()
  const dataEmissao = hoje.toLocaleDateString('pt-BR')
  const horaEmissao = hoje.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  const isUsg = ag.tipo_exame && !['Primeira Consulta','Retorno','Outro'].includes(ag.tipo_exame)
  const tipoDoc = isUsg ? 'EXAME' : 'CONSULTA'
  const numComp = String(ag.id).slice(-8).toUpperCase()
  const preparo = isUsg ? (preparos[ag.tipo_exame] || null) : null

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
          <p>Prefeitura Municipal de Conceição do Tocantins</p>
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
        <div class="campo"><label>Nome completo</label><span>${ag.paciente_nome || '—'}</span></div>
        <div class="campo" style="max-width:160px"><label>CPF / CNS</label><span>${ag.paciente_cns || '—'}</span></div>
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
      </div>
      ${ag.observacao ? `<div class="campo" style="margin-top:8px"><label>Observação</label><span style="white-space:normal">${ag.observacao}</span></div>` : ''}
    </div>

    ${preparo ? `
    <div style="background:#fff7ed;border:1px solid #fb923c;border-radius:4px;padding:10px 14px;margin-top:10px;font-size:11px;color:#7c2d12;">
      <strong>🧪 PREPARO PARA O EXAME:</strong><br/>${preparo}
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
      let query = supabase.from('pacientes').select('id, nome, cpf_cns, telefone, sexo').order('nome').limit(8)
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
  const [form, setForm] = useState({ paciente_nome: '', paciente_cns: '', telefone: '', sexo: '', data_consulta: '', tipo_exame: '', observacao: '', profissional_nome: '', data_atendimento: '' })
  const [salvando, setSalvando] = useState(false)

  // Modal profissionais
  const [modalProf, setModalProf] = useState(false)
  const [formProf, setFormProf] = useState({ nome: '', conselho_tipo: 'CRM', conselho_numero: '' })
  const [salvandoProf, setSalvandoProf] = useState(false)

  // Profissional ativo (selecionado no card da escala)
  const [profissionalAtivo, setProfissionalAtivo] = useState(null) // { id, profissional_nome, data_atendimento }

  // Modal escala
  const [modalEscala, setModalEscala] = useState(false)
  const [salvandoEscala, setSalvandoEscala] = useState(false)
  const [profEscalaSel, setProfEscalaSel] = useState('')
  const [dataEscala, setDataEscala] = useState('')

  // Modal cancelamento
  const [modalCancel, setModalCancel] = useState({ show: false, id: null })
  const [motivoCancel, setMotivoCancel] = useState('')

  // Modal exclusão
  const [modalExcluir, setModalExcluir] = useState({ show: false, id: null })
  const [motivoExclusao, setMotivoExclusao] = useState('')

  // Modal edição
  const [modalEditar, setModalEditar] = useState({ show: false, id: null })
  const [formEditar, setFormEditar] = useState({ paciente_nome: '', paciente_cns: '', telefone: '', sexo: '', data_consulta: '', tipo_exame: '', observacao: '', profissional_nome: '' })

  // Relatório
  const [relatorio, setRelatorio] = useState([])
  const [relDetalhes, setRelDetalhes] = useState([])
  const [relMes, setRelMes] = useState(() => String(new Date().getMonth() + 1).padStart(2, '0'))
  const [relAno, setRelAno] = useState(() => String(new Date().getFullYear()))
  const [relLoading, setRelLoading] = useState(false)
  const [relFiltroEsp, setRelFiltroEsp] = useState('')
  const [relFiltroStatus, setRelFiltroStatus] = useState('')
  const [relFiltroProf, setRelFiltroProf] = useState('')

  // Config dinâmica
  const [especialidades, setEspecialidades] = useState(ESPECIALIDADES)
  const [especialidadesConfig, setEspecialidadesConfig] = useState([])
  const [preparosDb, setPreparosDb] = useState(PREPARO_USG)
  const [preparosList, setPreparosList] = useState([])
  const [modalConfig, setModalConfig] = useState(false)
  const [abaConfig, setAbaConfig] = useState('especialidades')
  // form nova especialidade
  const [formEsp, setFormEsp] = useState({ label: '', icon: '🏥', cota: '30' })
  const [salvandoEsp, setSalvandoEsp] = useState(false)
  // form novo preparo
  const [formPreparo, setFormPreparo] = useState({ especialidade_slug: 'usg', tipo_exame: '', instrucoes: '' })
  const [salvandoPreparo, setSalvandoPreparo] = useState(false)
  const [editandoPreparo, setEditandoPreparo] = useState(null) // id sendo editado

  useEffect(() => {
    const u = localStorage.getItem('sms_user')
    if (!u) { router.push('/'); return }
    setUsuario(JSON.parse(u))
    carregarConfig()
  }, [])

  async function carregarConfig() {
    try {
      const [resEsp, resPre] = await Promise.all([
        fetch('/api/config/especialidades'),
        fetch('/api/config/preparos')
      ])
      const dataEsp = await resEsp.json()
      const dataPre = await resPre.json()
      if (Array.isArray(dataEsp) && dataEsp.length > 0) {
        setEspecialidadesConfig(dataEsp)
        setEspecialidades(dataEsp.filter(e => e.ativo).map(e => ({ id: e.slug, label: e.label, icon: e.icon, cota: e.cota })))
      }
      if (Array.isArray(dataPre) && dataPre.length > 0) {
        setPreparosList(dataPre)
        const mapa = {}
        dataPre.filter(p => p.ativo).forEach(p => { mapa[p.tipo_exame] = p.instrucoes })
        setPreparosDb(mapa)
      }
    } catch (_) {}
  }

  // Carregar dados ao mudar especialidade/mes/ano
  useEffect(() => {
    if (abaMain === 'agendamento') {
      setProfissionalAtivo(null)
      buscarAgendamentos(); buscarEscala(); buscarProfissionais()
    }
  }, [esp, mes, ano, abaMain])

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
      const p = new URLSearchParams({ mes: relMes, ano: relAno, incluir_excluidos: '1' })
      const res = await fetch('/api/especialidades?' + p)
      const json = await res.json()
      const todos = json.data || []

      // Resumo por especialidade
      const mapa = {}
      ESPECIALIDADES.forEach(e => { mapa[e.id] = { label: e.label, icon: e.icon, cota: e.cota, pendente: 0, autorizado: 0, negado: 0, excluido: 0 } })
      todos.forEach(r => { if (mapa[r.especialidade]) mapa[r.especialidade][r.status] = (mapa[r.especialidade][r.status] || 0) + 1 })
      setRelatorio(Object.values(mapa))
      setRelDetalhes(todos)
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
      // limpa tipo de exame se o sexo mudou e o exame selecionado fosse incompatível
      tipo_exame: '',
    }))
  }

  async function salvarAgendamento() {
    const isUsg = esp === 'usg'
    if (!form.paciente_nome.trim()) { mostrarMsg('Informe o nome do paciente', false); return }
    if (!form.telefone.trim()) { mostrarMsg('Informe o telefone', false); return }
    if (!form.data_consulta) { mostrarMsg('Informe a data de solicitação', false); return }
    if (!form.tipo_exame) { mostrarMsg(isUsg ? 'Selecione o tipo de exame' : 'Selecione o tipo de consulta', false); return }
    if (escala.length > 0 && !form.profissional_nome) { mostrarMsg('Selecione o profissional', false); return }
    // Restrições por sexo (USG)
    if (isUsg && form.sexo) {
      const sexoM = ['M','MASCULINO','Masculino','m'].includes(form.sexo)
      const sexoF = ['F','FEMININO','Feminino','f'].includes(form.sexo)
      if (form.tipo_exame === 'TRANSVAGINAL' && !sexoF) {
        mostrarMsg('❌ Exame de Transvaginal é exclusivo para pacientes do sexo feminino', false); return
      }
      if (['PRÓSTATA TRANSRETAL','PRÓSTATA ABDOMINAL'].includes(form.tipo_exame) && !sexoM) {
        mostrarMsg('❌ Exame de Próstata é exclusivo para pacientes do sexo masculino', false); return
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
          mes, ano,
          criado_por: usuario?.nome || null,
        })
      })
      const json = await res.json()
      if (!json.ok) throw new Error(json.error)
      mostrarMsg('✅ Agendamento registrado')
      setForm({ paciente_nome: '', paciente_cns: '', telefone: '', sexo: '', data_consulta: '', tipo_exame: '', observacao: '', profissional_nome: '', data_atendimento: '' })
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

  async function salvarEspecialidade() {
    if (!formEsp.label.trim()) { mostrarMsg('Informe o nome da especialidade', false); return }
    setSalvandoEsp(true)
    try {
      const res = await fetch('/api/config/especialidades', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug: formEsp.label, label: formEsp.label.trim(), icon: formEsp.icon, cota: Number(formEsp.cota) || 30 })
      })
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      setFormEsp({ label: '', icon: '🏥', cota: '30' })
      mostrarMsg('✅ Especialidade cadastrada')
      await carregarConfig()
    } catch (e) { mostrarMsg('❌ ' + e.message, false) }
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
    } catch (e) { mostrarMsg('❌ ' + e.message, false) }
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
      mostrarMsg('✅ Preparo salvo')
      await carregarConfig()
    } catch (e) { mostrarMsg('❌ ' + e.message, false) }
    setSalvandoPreparo(false)
  }

  async function excluirPreparo(id) {
    if (!confirm('Remover este preparo?')) return
    try {
      await fetch('/api/config/preparos?id=' + id, { method: 'DELETE' })
      mostrarMsg('Preparo removido')
      await carregarConfig()
    } catch (e) { mostrarMsg('❌ ' + e.message, false) }
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
    } catch (e) { mostrarMsg('❌ ' + e.message, false) }
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
          }
        })
      })
      const json = await res.json()
      if (!json.ok) throw new Error(json.error)
      setAgendamentos(prev => prev.map(a => a.id === modalEditar.id ? { ...a, ...json.data } : a))
      setModalEditar({ show: false, id: null })
      mostrarMsg('Agendamento atualizado')
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
  const espAtiva = especialidades.find(e => e.id === esp) || ESPECIALIDADES.find(e => e.id === esp) || ESPECIALIDADES[0]
  const autorizados = agendamentos.filter(a => a.status === 'autorizado').length
  const usados = autorizados
  const pct = Math.min(100, Math.round((usados / espAtiva.cota) * 100))

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <Layout usuario={usuario}>
      <div style={{ padding: '28px 32px', maxWidth: '1400px', margin: '0 auto' }}>

        {/* Modal Configurações */}
        {modalConfig && (
          <Modal titulo="⚙️ Configurações de Especialidades" onClose={() => setModalConfig(false)} largura="640px">
            {/* Abas */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', borderBottom: '1px solid #e2e8f0', paddingBottom: '12px' }}>
              {[['especialidades','🏥 Especialidades'],['preparos','🧪 Preparos']].map(([id, lbl]) => (
                <button key={id} onClick={() => setAbaConfig(id)} style={{
                  background: abaConfig === id ? '#b45309' : 'none',
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
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '240px', overflowY: 'auto' }}>
                    {especialidadesConfig.map(e => (
                      <div key={e.slug} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 12px', background: e.ativo ? '#f0fdf4' : '#f8fafc', borderRadius: '8px', border: `1px solid ${e.ativo ? '#bbf7d0' : '#e2e8f0'}` }}>
                        <span style={{ fontSize: '18px' }}>{e.icon}</span>
                        <span style={{ flex: 1, fontWeight: '600', fontSize: '13px', color: e.ativo ? '#166534' : '#94a3b8' }}>{e.label}</span>
                        <span style={{ fontSize: '11px', color: '#94a3b8' }}>cota {e.cota}</span>
                        <button onClick={() => toggleEspecialidade(e.slug, e.ativo)} style={{
                          background: e.ativo ? '#fee2e2' : '#dcfce7', border: 'none', borderRadius: '6px',
                          padding: '4px 10px', fontSize: '11px', fontWeight: '700', cursor: 'pointer',
                          color: e.ativo ? '#991b1b' : '#166534'
                        }}>{e.ativo ? 'Desativar' : 'Reativar'}</button>
                      </div>
                    ))}
                  </div>
                </div>
                {/* Nova especialidade */}
                <div style={{ background: '#f8fafc', borderRadius: '10px', padding: '14px', border: '1px solid #e2e8f0' }}>
                  <p style={{ fontSize: '12px', fontWeight: '700', color: '#475569', margin: '0 0 10px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Nova especialidade</p>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 60px 80px auto', gap: '8px', alignItems: 'end' }}>
                    <div><label className="label-modern">Nome</label><input className="input-modern" placeholder="Ex.: Cardiologia" value={formEsp.label} onChange={e => setFormEsp(f => ({ ...f, label: e.target.value }))} /></div>
                    <div><label className="label-modern">Ícone</label><input className="input-modern" value={formEsp.icon} onChange={e => setFormEsp(f => ({ ...f, icon: e.target.value }))} style={{ textAlign: 'center' }} /></div>
                    <div><label className="label-modern">Cota/mês</label><input className="input-modern" type="number" min="1" value={formEsp.cota} onChange={e => setFormEsp(f => ({ ...f, cota: e.target.value }))} /></div>
                    <button className="btn-primary" style={{ background: GRAD, padding: '9px 14px' }} onClick={salvarEspecialidade} disabled={salvandoEsp}>
                      {salvandoEsp ? '...' : '+ Adicionar'}
                    </button>
                  </div>
                </div>
                <p style={{ fontSize: '11px', color: '#94a3b8', margin: 0 }}>
                  Desativar uma especialidade a esconde da lista mas mantém todo o histórico de agendamentos preservado.
                </p>
              </div>
            )}

            {abaConfig === 'preparos' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {/* Lista de preparos */}
                <div>
                  <p style={{ fontSize: '12px', fontWeight: '700', color: '#475569', margin: '0 0 8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Preparos cadastrados</p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '220px', overflowY: 'auto' }}>
                    {preparosList.length === 0 && <p style={{ fontSize: '12px', color: '#94a3b8' }}>Nenhum preparo cadastrado ainda.</p>}
                    {preparosList.map(p => (
                      <div key={p.id} style={{ padding: '8px 12px', background: '#fffbeb', borderRadius: '8px', border: '1px solid #fde68a' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                          <div style={{ flex: 1 }}>
                            <span style={{ fontWeight: '700', fontSize: '12px', color: '#92400e', display: 'block' }}>{p.tipo_exame} <span style={{ fontWeight: '400', color: '#b45309' }}>({p.especialidade_slug.toUpperCase()})</span></span>
                            <span style={{ fontSize: '11px', color: '#78350f', display: 'block', marginTop: '2px' }}>{p.instrucoes}</span>
                          </div>
                          <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
                            <button onClick={() => { setEditandoPreparo(p.id); setFormPreparo({ especialidade_slug: p.especialidade_slug, tipo_exame: p.tipo_exame, instrucoes: p.instrucoes }) }} style={{ background: '#eff6ff', border: '1px solid #93c5fd', borderRadius: '6px', padding: '3px 8px', fontSize: '11px', cursor: 'pointer', color: '#1d4ed8' }}>✏️</button>
                            <button onClick={() => excluirPreparo(p.id)} style={{ background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: '6px', padding: '3px 8px', fontSize: '11px', cursor: 'pointer', color: '#991b1b' }}>🗑</button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Formulário */}
                <div style={{ background: '#f8fafc', borderRadius: '10px', padding: '14px', border: '1px solid #e2e8f0' }}>
                  <p style={{ fontSize: '12px', fontWeight: '700', color: '#475569', margin: '0 0 10px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    {editandoPreparo ? '✏️ Editando preparo' : 'Novo preparo'}
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
                      <label className="label-modern">Instruções de preparo</label>
                      <textarea className="input-modern" rows={3} placeholder="Ex.: JEJUM DE 8 HORAS..." value={formPreparo.instrucoes} onChange={e => setFormPreparo(f => ({ ...f, instrucoes: e.target.value }))} style={{ resize: 'vertical' }} />
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      {editandoPreparo && (
                        <button className="btn-secondary" onClick={() => { setEditandoPreparo(null); setFormPreparo({ especialidade_slug: 'usg', tipo_exame: '', instrucoes: '' }) }}>
                          Cancelar
                        </button>
                      )}
                      <button className="btn-primary" style={{ background: GRAD }} onClick={salvarPreparo} disabled={salvandoPreparo}>
                        {salvandoPreparo ? 'Salvando...' : editandoPreparo ? 'Salvar alteração' : '+ Adicionar preparo'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </Modal>
        )}

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
                <button onClick={() => setModalConfig(true)}
                  style={{ padding: '9px 14px', background: 'linear-gradient(135deg, #374151, #6b7280)', border: 'none', borderRadius: '10px', color: 'white', fontSize: '12px', fontWeight: '700', cursor: 'pointer', fontFamily: 'Sora, sans-serif', whiteSpace: 'nowrap' }}>
                  ⚙️ Configurações
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
                <div style={{ minWidth: '200px' }}>
                  <p style={{ fontFamily: 'Sora, sans-serif', fontSize: '11px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 6px' }}>
                    Escala {MESES[Number(mes) - 1]}/{ano}
                  </p>
                  {escala.length === 0
                    ? <p style={{ fontSize: '12px', color: '#94a3b8', fontStyle: 'italic' }}>Sem profissional escalado</p>
                    : escala.map(e => {
                      const ativo = profissionalAtivo?.id === e.id
                      return (
                        <button key={e.id} onClick={() => {
                          const novo = ativo ? null : e
                          setProfissionalAtivo(novo)
                          if (mostrarForm) {
                            setForm(f => ({
                              ...f,
                              profissional_nome: novo ? novo.profissional_nome : '',
                              data_consulta: novo ? (novo.data_atendimento || '') : '',
                            }))
                          }
                        }}
                          title={ativo ? 'Clique para desmarcar' : 'Clique para selecionar este profissional'}
                          style={{
                            display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '5px',
                            width: '100%', padding: '6px 10px', borderRadius: '8px', cursor: 'pointer',
                            border: ativo ? `2px solid ${COR}` : '2px solid transparent',
                            background: ativo ? 'rgba(180,83,9,0.08)' : 'rgba(0,0,0,0.03)',
                            textAlign: 'left', transition: 'all 0.15s',
                          }}>
                          <span style={{ fontSize: '13px' }}>👨‍⚕️</span>
                          <span style={{ fontSize: '12px', fontWeight: ativo ? '700' : '600', color: ativo ? COR : '#0f172a' }}>
                            {e.profissional_nome}
                          </span>
                          {e.data_atendimento && (
                            <span style={{ fontSize: '11px', color: ativo ? COR : '#64748b', background: ativo ? 'rgba(180,83,9,0.1)' : '#f1f5f9', padding: '1px 6px', borderRadius: '6px', marginLeft: 'auto' }}>
                              {fmtData(e.data_atendimento)}
                            </span>
                          )}
                          {ativo && <span style={{ fontSize: '10px', color: COR, fontWeight: '800' }}>✓</span>}
                        </button>
                      )
                    })}
                  {escala.length > 0 && (
                    <p style={{ fontSize: '10px', color: '#94a3b8', margin: '4px 0 0', fontStyle: 'italic' }}>
                      {profissionalAtivo ? `Selecionado: pré-preenche o form` : 'Clique para selecionar'}
                    </p>
                  )}
                </div>

                {/* Botão novo */}
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
                    {escala.length === 0 && (
                      <div>
                        <label className="label-modern">{'Data de Solicitação *'}</label>
                        <input className="input-modern" type="date"
                          value={form.data_consulta}
                          onChange={e => setForm(f => ({ ...f, data_consulta: e.target.value }))}
                          style={{ width: '100%' }} />
                      </div>
                    )}
                    <div>
                      <label className="label-modern">{esp === 'usg' ? 'Tipo de Exame *' : 'Tipo de Consulta'}</label>
                      <select className="input-modern" value={form.tipo_exame}
                        onChange={e => setForm(f => ({ ...f, tipo_exame: e.target.value }))}
                        style={{ width: '100%' }}>
                        <option value="">— Selecione —</option>
                        {(esp === 'usg' ? TIPOS_USG.filter(t => {
                          const sexoM = ['M','MASCULINO','Masculino','m'].includes(form.sexo)
                          const sexoF = ['F','FEMININO','Feminino','f'].includes(form.sexo)
                          if (!form.sexo) return true // sem sexo cadastrado → mostra tudo
                          if (t === 'TRANSVAGINAL') return sexoF
                          if (['PRÓSTATA TRANSRETAL','PRÓSTATA ABDOMINAL'].includes(t)) return sexoM
                          return true
                        }) : TIPOS_CONSULTA).map(t => (
                          <option key={t} value={t}>{t}</option>
                        ))}
                      </select>
                    </div>
                    {escala.length > 0 && (() => {
                      // Nomes únicos na escala
                      const profEscalaUnicos = [...new Map(escala.map(e => [e.profissional_nome, e])).values()]
                      // Datas disponíveis para o profissional selecionado
                      const datasDoProf = escala.filter(e => e.profissional_nome === form.profissional_nome)
                      return (
                        <>
                          <div>
                            <label className="label-modern">Profissional</label>
                            <select className="input-modern"
                              value={form.profissional_nome}
                              onChange={e => {
                                const nome = e.target.value
                                const entradas = escala.filter(x => x.profissional_nome === nome)
                                // auto-fill: se só tiver uma data, preenche; senão limpa para o usuário escolher
                                const dataAuto = entradas.length === 1 ? (entradas[0].data_atendimento || '') : ''
                                setForm(f => ({ ...f, profissional_nome: nome, data_consulta: dataAuto, data_atendimento: dataAuto }))
                              }}
                              style={{ width: '100%' }}>
                              <option value="">— Selecione —</option>
                              {profEscalaUnicos.map(e => (
                                <option key={e.profissional_nome} value={e.profissional_nome}>{e.profissional_nome}</option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="label-modern">{'Data de Solicitação *'}</label>
                            {datasDoProf.length > 1 ? (
                              // Profissional tem mais de uma data → select
                              <select className="input-modern"
                                value={form.data_consulta}
                                onChange={e => setForm(f => ({ ...f, data_consulta: e.target.value, data_atendimento: e.target.value }))}
                                style={{ width: '100%' }}>
                                <option value="">— Selecione a data —</option>
                                {datasDoProf.map(e => (
                                  <option key={e.id} value={e.data_atendimento}>{fmtData(e.data_atendimento)}</option>
                                ))}
                              </select>
                            ) : (
                              // Nenhum ou um profissional → input (preenchido automaticamente ou livre)
                              <input className="input-modern" type="date"
                                value={form.data_consulta}
                                onChange={e => setForm(f => ({ ...f, data_consulta: e.target.value }))}
                                style={{ width: '100%' }} />
                            )}
                          </div>
                        </>
                      )
                    })()}
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
                    <button className="btn-secondary" onClick={() => { setMostrarForm(false); setForm({ paciente_nome: '', paciente_cns: '', telefone: '', sexo: '', data_consulta: '', tipo_exame: '', observacao: '', profissional_nome: '', data_atendimento: '' }) }}>Cancelar</button>
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
                <>
                <div className="screen-only">
                  <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed', fontFamily: 'Sora, sans-serif', fontSize: '12px' }}>
                    <colgroup>
                      <col style={{ width: '28px' }} />
                      <col style={{ width: '20%' }} />
                      <col style={{ width: '9%' }} />
                      <col style={{ width: '9%' }} />
                      <col style={{ width: '13%' }} />
                      <col style={{ width: '9%' }} />
                      <col style={{ width: '7%' }} />
                      <col style={{ width: '8%' }} />
                      <col style={{ width: '9%' }} />
                      <col style={{ width: '130px' }} />
                    </colgroup>
                    <thead>
                      <tr style={{ borderBottom: '2px solid #e2e8f0' }}>
                        {['#', 'Paciente', 'CPF/CNS', 'Telefone', 'Tipo', 'Profissional', 'Data', 'Status', 'Obs', 'Ações'].map(h => (
                          <th key={h} style={{ padding: '7px 8px', textAlign: 'left', fontSize: '10px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {(() => {
                        const sorted = [...agendamentos].sort((a, b) => {
                          const d = (a.data_consulta || '').localeCompare(b.data_consulta || '')
                          if (d !== 0) return d
                          return (a.created_at || '').localeCompare(b.created_at || '')
                        })
                        let printNum = 0
                        const btn = (onClick, title, bg, borda, cor, label) => (
                          <button onClick={onClick} title={title}
                            style={{ padding: '3px 0', width: '26px', fontSize: '12px', fontWeight: '700', background: bg, border: `1px solid ${borda}`, borderRadius: '5px', color: cor, cursor: 'pointer', textAlign: 'center', lineHeight: 1 }}>
                            {label}
                          </button>
                        )
                        return sorted.map((a, i) => {
                          if (a.status === 'autorizado') printNum++
                          const numExibir = a.status === 'autorizado' ? printNum : i + 1
                          const st = STATUS_STYLE[a.status] || STATUS_STYLE.pendente
                          const doisNomes = a.profissional_nome ? a.profissional_nome.split(' ').slice(0, 2).join(' ') : '—'
                          return (
                          <tr key={a.id}
                            className={a.status !== 'autorizado' ? 'no-print' : ''}
                            style={{ borderBottom: '1px solid #f1f5f9' }}
                            onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                            <td style={{ padding: '8px', color: '#94a3b8', fontSize: '11px' }}>{numExibir}</td>
                            <td style={{ padding: '8px', fontWeight: '700', color: '#0f172a', fontSize: '12px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.paciente_nome}</td>
                            <td style={{ padding: '8px', color: '#64748b', fontSize: '11px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.paciente_cns || '—'}</td>
                            <td style={{ padding: '8px', color: '#475569', fontSize: '11px' }}>{a.telefone || '—'}</td>
                            <td style={{ padding: '8px', fontSize: '11px', color: '#0f172a', fontWeight: a.tipo_exame ? '600' : '400', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.tipo_exame || '—'}</td>
                            <td style={{ padding: '8px', fontSize: '11px', color: '#475569', fontWeight: '600', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={a.profissional_nome || ''}>{doisNomes}</td>
                            <td style={{ padding: '8px', color: '#475569', fontSize: '11px', whiteSpace: 'nowrap' }}>{fmtData(a.data_consulta)}</td>
                            <td style={{ padding: '8px' }}>
                              <span style={{ fontSize: '10px', fontWeight: '700', padding: '2px 7px', borderRadius: '20px', background: st.bg, color: st.cor, border: `1px solid ${st.borda}`, whiteSpace: 'nowrap' }}>
                                {STATUS_LABEL[a.status]}
                              </span>
                            </td>
                            <td style={{ padding: '8px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {a.status === 'negado' && a.motivo_cancelamento
                                ? <span style={{ fontSize: '11px', color: '#991b1b', fontStyle: 'italic' }} title={a.motivo_cancelamento}>
                                    {a.motivo_cancelamento.length > 18 ? a.motivo_cancelamento.slice(0, 18) + '…' : a.motivo_cancelamento}
                                  </span>
                                : <span style={{ fontSize: '11px', color: '#94a3b8' }}>{a.observacao || '—'}</span>
                              }
                            </td>
                            <td style={{ padding: '6px 8px' }}>
                              <div style={{ display: 'flex', gap: '3px', alignItems: 'center', flexWrap: 'nowrap' }}>
                                {a.status !== 'autorizado' && btn(() => autorizar(a.id), 'Autorizar', '#dcfce7', '#86efac', '#166534', '✓')}
                                {a.status === 'autorizado' && btn(() => imprimirComprovante(a, espAtiva.label, undefined, preparosDb), 'Imprimir comprovante', '#eff6ff', '#93c5fd', '#1d4ed8', '🖨')}
                                {a.status !== 'negado' && btn(() => { setModalCancel({ show: true, id: a.id }); setMotivoCancel('') }, 'Negar', '#fee2e2', '#fca5a5', '#991b1b', '✗')}
                                {a.status !== 'pendente' && btn(() => voltarPendente(a.id), 'Voltar para pendente', '#fef9c3', '#fde047', '#854d0e', '↩')}
                                {btn(() => { setFormEditar({ paciente_nome: a.paciente_nome || '', paciente_cns: a.paciente_cns || '', telefone: a.telefone || '', sexo: a.sexo || '', data_consulta: a.data_consulta || '', tipo_exame: a.tipo_exame || '', observacao: a.observacao || '', profissional_nome: a.profissional_nome || '' }); setModalEditar({ show: true, id: a.id }) }, 'Alterar', '#eff6ff', '#93c5fd', '#1d4ed8', '✏')}
                                {btn(() => { setModalExcluir({ show: true, id: a.id }); setMotivoExclusao('') }, 'Excluir', '#f1f5f9', '#cbd5e1', '#64748b', '🗑')}
                              </div>
                            </td>
                          </tr>
                        )
                        })
                      })()}
                    </tbody>
                  </table>
                </div>

                {/* Tabela exclusiva para impressão — ordem clínica (USG: por tipo; demais: por data) */}
                {agendamentos.filter(a => a.status === 'autorizado').length > 0 && (() => {
                  const printSorted = esp === 'usg'
                    ? [...agendamentos].filter(a => a.status === 'autorizado').sort((a, b) => {
                        const ia = TIPOS_USG_ORDEM.indexOf(a.tipo_exame)
                        const ib = TIPOS_USG_ORDEM.indexOf(b.tipo_exame)
                        return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib)
                      })
                    : [...agendamentos].filter(a => a.status === 'autorizado').sort((a, b) =>
                        (a.data_consulta || '').localeCompare(b.data_consulta || '') || (a.created_at || '').localeCompare(b.created_at || '')
                      )
                  return (
                    <div className="print-only">
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'Arial, sans-serif', fontSize: '11px' }}>
                        <thead>
                          <tr style={{ borderBottom: '2px solid #000' }}>
                            {['#', 'Paciente', 'CPF/CNS', 'Telefone', 'Tipo', 'Data'].map(h => (
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
          const detalhesFiltrados = relDetalhes.filter(r => {
            if (relFiltroEsp && r.especialidade !== relFiltroEsp) return false
            if (relFiltroStatus && r.status !== relFiltroStatus) return false
            if (relFiltroProf && !r.profissional_nome?.toLowerCase().includes(relFiltroProf.toLowerCase())) return false
            return true
          })
          return (
          <div>
            {/* Filtros */}
            <div className="card no-print" style={{ padding: '16px 20px', marginBottom: '16px' }}>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
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
                <div>
                  <label className="label-modern">Especialidade</label>
                  <select className="input-modern" value={relFiltroEsp} onChange={e => setRelFiltroEsp(e.target.value)} style={{ width: '160px' }}>
                    <option value="">Todas</option>
                    {ESPECIALIDADES.map(e => <option key={e.id} value={e.id}>{e.label}</option>)}
                  </select>
                </div>
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
                <button className="btn-primary" style={{ background: GRAD }} onClick={buscarRelatorio}>🔄 Atualizar</button>
                <button className="btn-secondary" onClick={() => window.print()}>🖨️ Imprimir</button>
              </div>
            </div>

            <div className="card print-area" style={{ padding: '20px', marginBottom: '16px' }}>
              {/* Cabeçalho impressão */}
              <div className="print-title" style={{ display: 'none', marginBottom: '16px', borderBottom: '2px solid #000', paddingBottom: '10px' }}>
                <p style={{ fontFamily: 'Arial', fontSize: '13px', fontWeight: '700', margin: '0 0 2px', textTransform: 'uppercase' }}>SECRETARIA MUNICIPAL DE SAÚDE — CONCEIÇÃO DO TOCANTINS/TO</p>
                <p style={{ fontFamily: 'Arial', fontSize: '15px', fontWeight: '800', margin: '6px 0 2px' }}>RELATÓRIO DE ESPECIALIDADES</p>
                <p style={{ fontFamily: 'Arial', fontSize: '12px', margin: 0, color: '#333' }}>
                  Competência: {MESES[Number(relMes) - 1]}/{relAno}
                  {relFiltroEsp ? ` · ${ESPECIALIDADES.find(e => e.id === relFiltroEsp)?.label}` : ''}
                  {relFiltroStatus ? ` · ${STATUS_LABEL[relFiltroStatus]}` : ''}
                </p>
              </div>

              <h3 style={{ fontFamily: 'Sora, sans-serif', fontSize: '14px', fontWeight: '700', color: '#0f172a', margin: '0 0 14px' }}>
                Resumo — {MESES[Number(relMes) - 1]}/{relAno}
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
                    {relatorio.filter(r => !relFiltroEsp || ESPECIALIDADES.find(e => e.id === relFiltroEsp)?.label === r.label).map((r, i) => {
                      const total = r.autorizado
                      const pct2 = Math.round((total / r.cota) * 100)
                      return (
                        <tr key={i} style={{ borderBottom: '1px solid #e2e8f0', background: i % 2 === 0 ? '#fff' : '#f8fafc', WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}>
                          <td style={{ padding: '9px 12px', fontWeight: '700', color: '#0f172a' }}>{r.icon} {r.label}</td>
                          <td style={{ padding: '9px 12px', color: '#475569', fontWeight: '600' }}>{r.cota}</td>
                          {['pendente','autorizado','negado','excluido'].map(s => (
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

              {/* Tabela detalhada */}
              {detalhesFiltrados.length > 0 && (
                <>
                  <h3 style={{ fontFamily: 'Sora, sans-serif', fontSize: '14px', fontWeight: '700', color: '#0f172a', margin: '0 0 12px', borderTop: '1px solid #e2e8f0', paddingTop: '16px' }}>
                    Detalhamento — {detalhesFiltrados.length} registro{detalhesFiltrados.length !== 1 ? 's' : ''}
                  </h3>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                    <thead>
                      <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                        {['#', 'Especialidade', 'Paciente', 'Telefone', 'Tipo', 'Profissional', 'Data', 'Status', 'Motivo'].map(h => (
                          <th key={h} style={{ padding: '8px 10px', textAlign: 'left', fontFamily: 'Sora, sans-serif', fontSize: '10px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {detalhesFiltrados.map((r, i) => {
                        const st = STATUS_STYLE[r.status] || STATUS_STYLE.pendente
                        const esp2 = ESPECIALIDADES.find(e => e.id === r.especialidade)
                        const motivo = r.status === 'negado' ? r.motivo_cancelamento : r.status === 'excluido' ? r.motivo_exclusao : null
                        return (
                          <tr key={r.id} style={{ borderBottom: '1px solid #f1f5f9', background: r.status === 'excluido' ? '#f8fafc' : 'white' }}>
                            <td style={{ padding: '8px 10px', color: '#94a3b8', fontSize: '11px' }}>{i + 1}</td>
                            <td style={{ padding: '8px 10px', fontSize: '11px', whiteSpace: 'nowrap' }}>{esp2?.icon} {esp2?.label}</td>
                            <td style={{ padding: '8px 10px', fontWeight: '600', color: '#0f172a', whiteSpace: 'nowrap' }}>{r.paciente_nome}</td>
                            <td style={{ padding: '8px 10px', color: '#64748b', fontSize: '11px' }}>{r.telefone || '—'}</td>
                            <td style={{ padding: '8px 10px', fontSize: '11px', whiteSpace: 'nowrap' }}>{r.tipo_exame || '—'}</td>
                            <td style={{ padding: '8px 10px', fontSize: '11px', whiteSpace: 'nowrap' }}>{r.profissional_nome || '—'}</td>
                            <td style={{ padding: '8px 10px', whiteSpace: 'nowrap', color: '#475569', fontSize: '11px' }}>{fmtData(r.data_consulta)}</td>
                            <td style={{ padding: '8px 10px' }}>
                              <span style={{ fontSize: '10px', fontWeight: '700', padding: '2px 7px', borderRadius: '12px', background: st.bg, color: st.cor, border: `1px solid ${st.borda}`, whiteSpace: 'nowrap' }}>
                                {STATUS_LABEL[r.status]}
                              </span>
                            </td>
                            <td style={{ padding: '8px 10px', fontSize: '11px', color: r.status === 'excluido' ? '#475569' : '#991b1b', fontStyle: motivo ? 'italic' : 'normal', maxWidth: '200px' }}>
                              {motivo || '—'}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </>
              )}
            </div>
            <style dangerouslySetInnerHTML={{__html: `
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

      {/* ── MODAL: EDIÇÃO ── */}
      {modalEditar.show && (() => {
        const espId = agendamentos.find(a => a.id === modalEditar.id)?.especialidade
        const isUsgEdit = espId === 'usg'
        return (
          <Modal titulo="✏️ Alterar Agendamento" onClose={() => setModalEditar({ show: false, id: null })} largura="560px">
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
                  onChange={e => setFormEditar(f => ({ ...f, telefone: e.target.value }))} style={{ width: '100%' }} />
              </div>
              <div>
                <label className="label-modern">Sexo</label>
                <select className="input-modern" value={formEditar.sexo} onChange={e => setFormEditar(f => ({ ...f, sexo: e.target.value, tipo_exame: '' }))} style={{ width: '100%' }}>
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
                    {TIPOS_USG.filter(t => {
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
              <div style={{ gridColumn: '1 / -1' }}>
                <label className="label-modern">Profissional</label>
                <input className="input-modern" type="text" value={formEditar.profissional_nome}
                  onChange={e => setFormEditar(f => ({ ...f, profissional_nome: e.target.value }))} style={{ width: '100%' }} />
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label className="label-modern">Observação</label>
                <textarea className="input-modern" rows={2} value={formEditar.observacao}
                  onChange={e => setFormEditar(f => ({ ...f, observacao: e.target.value }))}
                  style={{ width: '100%', resize: 'vertical' }} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
              <button className="btn-primary" style={{ background: 'linear-gradient(135deg, #1d4ed8, #2563eb)' }} onClick={salvarEdicao}>
                💾 Salvar Alterações
              </button>
              <button className="btn-secondary" onClick={() => setModalEditar({ show: false, id: null })}>Cancelar</button>
            </div>
          </Modal>
        )
      })()}

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
              🗑 Confirmar Exclusão
            </button>
            <button className="btn-secondary" onClick={() => { setModalExcluir({ show: false, id: null }); setMotivoExclusao('') }}>Cancelar</button>
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
