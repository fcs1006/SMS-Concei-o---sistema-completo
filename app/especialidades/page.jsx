'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Layout from '@/components/Layout'

const ESPECIALIDADES = [
  { id: 'ortopedia',    label: 'Ortopedia',    icon: '🦴', cota: 30 },
  { id: 'ginecologia',  label: 'Ginecologia',  icon: '🩺', cota: 30 },
  { id: 'oftalmologia', label: 'Oftalmologia', icon: '👁️', cota: 30 },
  { id: 'urologia',     label: 'Urologia',     icon: '🔬', cota: 30 },
  { id: 'usg',          label: 'USG',          icon: '📡', cota: 60 },
]

const MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']

const COR = '#b45309'
const GRAD = 'linear-gradient(135deg, #92400e, #b45309)'

const STATUS_STYLE = {
  pendente:   { bg: '#fef9c3', cor: '#854d0e', borda: '#fde047' },
  autorizado: { bg: '#dcfce7', cor: '#166534', borda: '#86efac' },
  negado:     { bg: '#fee2e2', cor: '#991b1b', borda: '#fca5a5' },
}

const STATUS_LABEL = { pendente: 'Pendente', autorizado: 'Autorizado', negado: 'Negado' }

export default function Especialidades() {
  const router = useRouter()
  const [usuario, setUsuario] = useState(null)
  const [aba, setAba] = useState('ortopedia')
  const [mes, setMes] = useState(() => String(new Date().getMonth() + 1).padStart(2, '0'))
  const [ano, setAno] = useState(() => String(new Date().getFullYear()))

  const [agendamentos, setAgendamentos] = useState([])
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState({ txt: '', ok: true })

  // Formulário
  const [form, setForm] = useState({ paciente_nome: '', paciente_cns: '', data_consulta: '', observacao: '' })
  const [salvando, setSalvando] = useState(false)
  const [mostrarForm, setMostrarForm] = useState(false)

  useEffect(() => {
    const u = localStorage.getItem('sms_user')
    if (!u) { router.push('/'); return }
    setUsuario(JSON.parse(u))
  }, [])

  useEffect(() => {
    buscar()
  }, [aba, mes, ano])

  function mostrarMsg(txt, ok = true) {
    setMsg({ txt, ok })
    setTimeout(() => setMsg({ txt: '', ok: true }), 5000)
  }

  async function buscar() {
    setLoading(true)
    try {
      const p = new URLSearchParams({ especialidade: aba, mes, ano })
      const res = await fetch('/api/especialidades?' + p.toString())
      const json = await res.json()
      if (json.ok) setAgendamentos(json.data || [])
      else mostrarMsg('Erro: ' + json.error, false)
    } catch {
      mostrarMsg('Erro ao carregar agendamentos', false)
    }
    setLoading(false)
  }

  async function salvar() {
    if (!form.paciente_nome.trim() || !form.data_consulta) {
      mostrarMsg('Preencha nome e data', false); return
    }
    setSalvando(true)
    try {
      const res = await fetch('/api/especialidades', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          especialidade: aba,
          paciente_nome: form.paciente_nome.trim().toUpperCase(),
          paciente_cns: form.paciente_cns.trim() || null,
          data_consulta: form.data_consulta,
          observacao: form.observacao.trim() || null,
          mes,
          ano,
          criado_por: usuario?.nome || null,
        })
      })
      const json = await res.json()
      if (!json.ok) throw new Error(json.error)
      mostrarMsg('✅ Agendamento registrado com sucesso')
      setForm({ paciente_nome: '', paciente_cns: '', data_consulta: '', observacao: '' })
      setMostrarForm(false)
      buscar()
    } catch (e) {
      mostrarMsg('❌ ' + e.message, false)
    }
    setSalvando(false)
  }

  async function alterarStatus(id, status) {
    try {
      const res = await fetch('/api/especialidades', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status })
      })
      const json = await res.json()
      if (!json.ok) throw new Error(json.error)
      setAgendamentos(prev => prev.map(a => a.id === id ? { ...a, status } : a))
    } catch (e) {
      mostrarMsg('❌ ' + e.message, false)
    }
  }

  async function excluir(id) {
    if (!confirm('Remover este agendamento?')) return
    try {
      const res = await fetch('/api/especialidades?id=' + id, { method: 'DELETE' })
      const json = await res.json()
      if (!json.ok) throw new Error(json.error)
      setAgendamentos(prev => prev.filter(a => a.id !== id))
      mostrarMsg('Agendamento removido')
    } catch (e) {
      mostrarMsg('❌ ' + e.message, false)
    }
  }

  const esp = ESPECIALIDADES.find(e => e.id === aba)
  const autorizados = agendamentos.filter(a => a.status === 'autorizado').length
  const usados = agendamentos.filter(a => a.status !== 'negado').length
  const pct = Math.min(100, Math.round((usados / esp.cota) * 100))

  return (
    <Layout usuario={usuario}>
      <div style={{ padding: '28px', maxWidth: '960px', margin: '0 auto' }}>

        {/* Cabeçalho */}
        <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h1 style={{ fontFamily: 'Sora, sans-serif', fontSize: '22px', fontWeight: '700', color: '#0f172a', margin: '0 0 4px' }}>
              Especialidades
            </h1>
            <p style={{ color: '#64748b', fontSize: '13px', margin: 0 }}>
              Agendamento e autorização de consultas e exames
            </p>
          </div>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
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
          </div>
        </div>

        {/* Abas de especialidade */}
        <div style={{ display: 'flex', gap: '4px', marginBottom: '20px', borderBottom: '2px solid #e2e8f0', paddingBottom: '0', flexWrap: 'wrap' }}>
          {ESPECIALIDADES.map(e => (
            <button key={e.id} onClick={() => setAba(e.id)}
              style={{
                background: 'none', border: 'none', padding: '10px 18px',
                fontSize: '13px', fontWeight: '700', cursor: 'pointer',
                color: aba === e.id ? COR : '#64748b',
                borderBottom: aba === e.id ? `3px solid ${COR}` : '3px solid transparent',
                marginBottom: '-2px',
                fontFamily: 'Sora, sans-serif',
                transition: 'color 0.2s',
              }}
            >
              {e.icon} {e.label}
            </button>
          ))}
        </div>

        {msg.txt && (
          <div className={msg.ok ? 'status-ok' : 'status-err'} style={{ marginBottom: '16px' }}>
            {msg.txt}
          </div>
        )}

        {/* Card de cota + botão */}
        <div className="card" style={{ padding: '20px', marginBottom: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
            {/* Cota */}
            <div style={{ flex: 1, minWidth: '220px' }}>
              <p style={{ fontFamily: 'Sora, sans-serif', fontSize: '12px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 8px' }}>
                Cota — {esp.label} / {MESES[Number(mes) - 1]}/{ano}
              </p>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginBottom: '8px' }}>
                <span style={{ fontFamily: 'Sora, sans-serif', fontSize: '28px', fontWeight: '800', color: pct >= 100 ? '#dc2626' : COR }}>
                  {usados}
                </span>
                <span style={{ fontSize: '16px', color: '#94a3b8', fontWeight: '600' }}>/ {esp.cota}</span>
                <span style={{ fontSize: '12px', color: '#64748b', marginLeft: '4px' }}>
                  ({autorizados} autorizado{autorizados !== 1 ? 's' : ''})
                </span>
              </div>
              <div style={{ background: '#e2e8f0', borderRadius: '999px', height: '8px', overflow: 'hidden', maxWidth: '300px' }}>
                <div style={{
                  width: pct + '%', height: '100%', borderRadius: '999px', transition: 'width 0.4s ease',
                  background: pct >= 100 ? '#dc2626' : pct >= 80 ? '#f59e0b' : '#16a34a'
                }} />
              </div>
              <p style={{ fontSize: '11px', color: pct >= 100 ? '#dc2626' : '#64748b', marginTop: '4px', fontFamily: 'DM Sans, sans-serif' }}>
                {pct >= 100 ? '⚠️ Cota atingida' : `${esp.cota - usados} vaga${esp.cota - usados !== 1 ? 's' : ''} disponível${esp.cota - usados !== 1 ? 'is' : ''}`}
              </p>
            </div>

            {/* Botão novo */}
            <button
              onClick={() => setMostrarForm(v => !v)}
              style={{
                padding: '10px 20px', background: GRAD, border: 'none', borderRadius: '10px',
                color: 'white', fontSize: '13px', fontWeight: '700',
                cursor: 'pointer', fontFamily: 'Sora, sans-serif', alignSelf: 'center'
              }}
            >
              {mostrarForm ? '✕ Cancelar' : '+ Novo Agendamento'}
            </button>
          </div>

          {/* Formulário */}
          {mostrarForm && (
            <div style={{ marginTop: '20px', paddingTop: '20px', borderTop: '1px solid #e2e8f0' }}>
              <p style={{ fontFamily: 'Sora, sans-serif', fontSize: '12px', fontWeight: '700', color: COR, textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 14px' }}>
                Novo Agendamento — {esp.icon} {esp.label}
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', marginBottom: '14px' }}>
                <div style={{ gridColumn: 'span 2' }}>
                  <label className="label-modern">Nome do Paciente *</label>
                  <input className="input-modern" type="text" placeholder="Nome completo"
                    value={form.paciente_nome}
                    onChange={e => setForm(f => ({ ...f, paciente_nome: e.target.value }))}
                    style={{ width: '100%' }} />
                </div>
                <div>
                  <label className="label-modern">CNS / CPF</label>
                  <input className="input-modern" type="text" placeholder="Número do cartão ou CPF"
                    value={form.paciente_cns}
                    onChange={e => setForm(f => ({ ...f, paciente_cns: e.target.value }))}
                    style={{ width: '100%' }} />
                </div>
                <div>
                  <label className="label-modern">Data da Consulta *</label>
                  <input className="input-modern" type="date"
                    value={form.data_consulta}
                    onChange={e => setForm(f => ({ ...f, data_consulta: e.target.value }))}
                    style={{ width: '100%' }} />
                </div>
                <div style={{ gridColumn: 'span 2' }}>
                  <label className="label-modern">Observação</label>
                  <input className="input-modern" type="text" placeholder="Opcional"
                    value={form.observacao}
                    onChange={e => setForm(f => ({ ...f, observacao: e.target.value }))}
                    style={{ width: '100%' }} />
                </div>
              </div>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button className="btn-primary" style={{ background: GRAD }} onClick={salvar} disabled={salvando}>
                  {salvando ? '⏳ Salvando...' : '💾 Salvar'}
                </button>
                <button className="btn-secondary" onClick={() => { setMostrarForm(false); setForm({ paciente_nome: '', paciente_cns: '', data_consulta: '', observacao: '' }) }}>
                  Cancelar
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Lista de agendamentos */}
        <div className="card" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' }}>
            <h3 style={{ fontFamily: 'Sora, sans-serif', fontSize: '13px', fontWeight: '700', color: '#0f172a', margin: 0, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {esp.icon} {esp.label} — {MESES[Number(mes) - 1]}/{ano}
            </h3>
            <div style={{ display: 'flex', gap: '8px' }}>
              {['pendente', 'autorizado', 'negado'].map(s => {
                const st = STATUS_STYLE[s]
                const count = agendamentos.filter(a => a.status === s).length
                return (
                  <span key={s} style={{ fontSize: '11px', fontWeight: '700', padding: '3px 8px', borderRadius: '20px', background: st.bg, color: st.cor, border: `1px solid ${st.borda}` }}>
                    {STATUS_LABEL[s]}: {count}
                  </span>
                )
              })}
            </div>
          </div>

          {loading ? (
            <p style={{ color: '#64748b', fontSize: '13px', textAlign: 'center', padding: '20px 0' }}>Carregando...</p>
          ) : agendamentos.length === 0 ? (
            <p style={{ color: '#94a3b8', fontSize: '13px', textAlign: 'center', padding: '30px 0', fontStyle: 'italic' }}>
              Nenhum agendamento registrado para este período.
            </p>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #e2e8f0' }}>
                    {['#', 'Paciente', 'CNS/CPF', 'Data', 'Status', 'Obs.', 'Ações'].map(h => (
                      <th key={h} style={{ padding: '8px 10px', textAlign: 'left', fontFamily: 'Sora, sans-serif', fontSize: '11px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {agendamentos.map((a, i) => {
                    const st = STATUS_STYLE[a.status] || STATUS_STYLE.pendente
                    const dataFmt = a.data_consulta ? a.data_consulta.split('-').reverse().join('/') : '-'
                    return (
                      <tr key={a.id} style={{ borderBottom: '1px solid #f1f5f9' }}
                        onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                      >
                        <td style={{ padding: '10px', color: '#94a3b8', fontSize: '12px' }}>{i + 1}</td>
                        <td style={{ padding: '10px', fontWeight: '600', color: '#0f172a' }}>{a.paciente_nome}</td>
                        <td style={{ padding: '10px', color: '#64748b', fontFamily: 'monospace', fontSize: '12px' }}>{a.paciente_cns || '—'}</td>
                        <td style={{ padding: '10px', whiteSpace: 'nowrap', color: '#475569' }}>{dataFmt}</td>
                        <td style={{ padding: '10px' }}>
                          <span style={{ fontSize: '11px', fontWeight: '700', padding: '3px 10px', borderRadius: '20px', background: st.bg, color: st.cor, border: `1px solid ${st.borda}`, whiteSpace: 'nowrap' }}>
                            {STATUS_LABEL[a.status]}
                          </span>
                        </td>
                        <td style={{ padding: '10px', color: '#64748b', fontSize: '12px', maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {a.observacao || '—'}
                        </td>
                        <td style={{ padding: '10px' }}>
                          <div style={{ display: 'flex', gap: '4px', flexWrap: 'nowrap' }}>
                            {a.status !== 'autorizado' && (
                              <button
                                onClick={() => alterarStatus(a.id, 'autorizado')}
                                title="Autorizar"
                                style={{ padding: '4px 8px', fontSize: '11px', fontWeight: '700', background: '#dcfce7', border: '1px solid #86efac', borderRadius: '6px', color: '#166534', cursor: 'pointer' }}>
                                ✓ Autorizar
                              </button>
                            )}
                            {a.status !== 'negado' && (
                              <button
                                onClick={() => alterarStatus(a.id, 'negado')}
                                title="Negar"
                                style={{ padding: '4px 8px', fontSize: '11px', fontWeight: '700', background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: '6px', color: '#991b1b', cursor: 'pointer' }}>
                                ✗ Negar
                              </button>
                            )}
                            {a.status !== 'pendente' && (
                              <button
                                onClick={() => alterarStatus(a.id, 'pendente')}
                                title="Voltar para pendente"
                                style={{ padding: '4px 8px', fontSize: '11px', fontWeight: '700', background: '#fef9c3', border: '1px solid #fde047', borderRadius: '6px', color: '#854d0e', cursor: 'pointer' }}>
                                ↩
                              </button>
                            )}
                            <button
                              onClick={() => excluir(a.id)}
                              title="Excluir"
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

      </div>
    </Layout>
  )
}
