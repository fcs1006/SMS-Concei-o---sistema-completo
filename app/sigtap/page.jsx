'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Layout from '@/components/Layout'

const GRAD = 'linear-gradient(135deg, #022c22, #064e3b)'

function formatarCompetencia(c) {
  if (!c || c.length !== 6) return c
  return `${c.slice(4, 6)}/${c.slice(0, 4)}`
}
function complexidade(c) {
  const m = { '1': 'AB', '2': 'MC', '3': 'AC', '4': 'AP' }
  return m[c] || c || '-'
}
function sexo(s) {
  return s === 'M' ? 'Masculino' : s === 'F' ? 'Feminino' : 'Ambos'
}
function formatarMoeda(v) {
  if (!v) return '-'
  return `R$ ${Number(v).toFixed(2).replace('.', ',')}`
}

export default function Sigtap() {
  const router = useRouter()
  const [usuario, setUsuario] = useState(null)

  // Sincronização
  const [disponiveis, setDisponiveis] = useState([])
  const [importadas, setImportadas] = useState([])
  const [carregandoLista, setCarregandoLista] = useState(false)
  const [sincronizando, setSincronizando] = useState('')
  const [msgSync, setMsgSync] = useState(null)

  // Busca
  const [busca, setBusca] = useState('')
  const [competenciaBusca, setCompetenciaBusca] = useState('')
  const [resultados, setResultados] = useState([])
  const [buscando, setBuscando] = useState(false)

  useEffect(() => {
    const u = localStorage.getItem('sms_user')
    if (!u) { router.push('/'); return }
    setUsuario(JSON.parse(u))
    carregarLista()
  }, [])

  useEffect(() => {
    if (busca.length < 2 && !competenciaBusca) { setResultados([]); return }
    const timer = setTimeout(buscarProcedimentos, 400)
    return () => clearTimeout(timer)
  }, [busca, competenciaBusca])

  async function carregarLista() {
    setCarregandoLista(true)
    try {
      const res = await fetch('/api/sigtap/importar')
      const data = await res.json()
      if (data.ok) {
        setDisponiveis(data.disponiveis || [])
        setImportadas(data.importadas || [])
        if (data.importadas?.length > 0) setCompetenciaBusca(data.importadas[0])
      }
    } catch { }
    setCarregandoLista(false)
  }

  async function sincronizar(competencia) {
    setSincronizando(competencia)
    setMsgSync(null)
    try {
      const res = await fetch('/api/sigtap/importar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ competencia })
      })
      const data = await res.json()
      if (data.ok) {
        setMsgSync({ ok: true, msg: `✅ ${data.inseridos.toLocaleString('pt-BR')} procedimentos importados — competência ${formatarCompetencia(data.competencia)}` })
        carregarLista()
      } else {
        setMsgSync({ ok: false, msg: `❌ ${data.error}` })
      }
    } catch (e) {
      setMsgSync({ ok: false, msg: `❌ ${e.message}` })
    }
    setSincronizando('')
  }

  async function buscarProcedimentos() {
    if (busca.length < 2 && !competenciaBusca) return
    setBuscando(true)
    const params = new URLSearchParams()
    if (busca) params.set('q', busca)
    if (competenciaBusca) params.set('competencia', competenciaBusca)
    params.set('limit', '50')
    const res = await fetch(`/api/sigtap/buscar?${params}`)
    const data = await res.json()
    setResultados(data.resultados || [])
    setBuscando(false)
  }

  const top5 = disponiveis.slice(0, 5)
  const maisRecente = disponiveis[0]?.competencia
  const jaTem = (c) => importadas.includes(c)

  return (
    <Layout usuario={usuario}>
      <div style={{ padding: '32px', maxWidth: '1100px' }}>

        <div style={{ marginBottom: '28px' }}>
          <h1 style={{ fontFamily: 'Sora, sans-serif', fontWeight: '700', fontSize: '22px', color: '#1e293b', margin: '0 0 4px' }}>
            SIGTAP — Procedimentos SUS
          </h1>
          <p style={{ color: '#64748b', fontSize: '13px', fontFamily: 'DM Sans, sans-serif', margin: 0 }}>
            Sincronização automática via FTP do DATASUS
          </p>
        </div>

        {/* ── SINCRONIZAÇÃO ── */}
        <div style={{ background: '#fff', borderRadius: '16px', padding: '24px', boxShadow: '0 1px 8px rgba(0,0,0,0.07)', border: '1px solid #e2e8f0', marginBottom: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
            <div>
              <h2 style={{ fontFamily: 'Sora, sans-serif', fontWeight: '700', fontSize: '14px', color: '#1e293b', margin: '0 0 2px' }}>
                🔄 Sincronização de competências
              </h2>
              <p style={{ fontFamily: 'DM Sans, sans-serif', fontSize: '12px', color: '#94a3b8', margin: 0 }}>
                5 competências mais recentes do DATASUS
              </p>
            </div>
            <button onClick={carregarLista} disabled={carregandoLista}
              style={{ padding: '7px 14px', background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '12px', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif', color: '#475569', whiteSpace: 'nowrap' }}>
              {carregandoLista ? 'Atualizando...' : '↻ Atualizar'}
            </button>
          </div>

          {msgSync && (
            <div className={msgSync.ok ? 'status-ok' : 'status-err'} style={{ marginBottom: '16px' }}>
              {msgSync.msg}
            </div>
          )}

          {carregandoLista && top5.length === 0 ? (
            <p style={{ color: '#94a3b8', fontSize: '13px', fontFamily: 'DM Sans, sans-serif' }}>Buscando no FTP do DATASUS...</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {top5.map(({ competencia }) => {
                const importada = jaTem(competencia)
                const isLatest = competencia === maisRecente
                const loading = sincronizando === competencia
                return (
                  <div key={competencia} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    borderRadius: '10px', padding: '12px 16px',
                    background: importada ? 'rgba(52,211,153,0.05)' : '#f8fafc',
                    border: `1px solid ${importada ? '#34d39940' : '#e2e8f0'}`,
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span style={{ fontFamily: 'Sora, sans-serif', fontWeight: '700', fontSize: '15px', color: '#1e293b', minWidth: '72px' }}>
                        {formatarCompetencia(competencia)}
                      </span>
                      {isLatest && (
                        <span style={{ fontSize: '9px', fontWeight: '700', background: '#0d9488', color: '#fff', borderRadius: '4px', padding: '2px 6px', letterSpacing: '0.05em' }}>MAIS RECENTE</span>
                      )}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                      <span style={{ fontSize: '12px', color: importada ? '#059669' : '#94a3b8', fontFamily: 'DM Sans, sans-serif', fontWeight: importada ? '600' : '400' }}>
                        {importada ? '✓ Importada' : 'Não importada'}
                      </span>
                      <button onClick={() => sincronizar(competencia)} disabled={!!sincronizando}
                        style={{
                          padding: '7px 18px', borderRadius: '8px', fontSize: '12px',
                          fontWeight: '700', cursor: sincronizando ? 'wait' : 'pointer',
                          border: 'none', fontFamily: 'DM Sans, sans-serif',
                          background: importada ? 'rgba(52,211,153,0.15)' : GRAD,
                          color: importada ? '#059669' : '#fff',
                          minWidth: '110px', textAlign: 'center',
                        }}>
                        {loading ? 'Sincronizando...' : importada ? '↻ Atualizar' : '↓ Importar'}
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* ── BUSCA ── */}
        <div style={{ background: '#fff', borderRadius: '16px', padding: '24px', boxShadow: '0 1px 8px rgba(0,0,0,0.07)', border: '1px solid #e2e8f0' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px', marginBottom: '16px' }}>
            <h2 style={{ fontFamily: 'Sora, sans-serif', fontWeight: '700', fontSize: '14px', color: '#1e293b', margin: 0 }}>
              🔍 Consultar procedimentos
            </h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '12px', color: '#000000ff', fontFamily: 'DM Sans, sans-serif', marginRight: '2px' }}>Complexidade:</span>
              {[['AB', 'Atenção Básica'], ['MC', 'Média Complexidade'], ['AC', 'Alta Complexidade'], ['AP', 'Atenção Primária']].map(([sigla, label]) => (
                <span key={sigla} title={label} style={{
                  fontSize: '12px', fontFamily: 'DM Sans, sans-serif',
                  background: '#f1f5f9', border: '1px solid #e2e8f0',
                  borderRadius: '4px', padding: '2px 7px', color: '#475569',
                  cursor: 'default', whiteSpace: 'nowrap',
                }}>
                  <strong>{sigla}</strong> = {label}
                </span>
              ))}
            </div>
          </div>

          {importadas.length === 0 ? (
            <p style={{ color: '#94a3b8', fontSize: '13px', fontFamily: 'DM Sans, sans-serif' }}>
              Importe ao menos uma competência para consultar procedimentos.
            </p>
          ) : (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '14px', marginBottom: '16px' }}>
                <div>
                  <label className="label-modern">Código ou nome do procedimento</label>
                  <input className="input-modern" value={busca}
                    onChange={e => setBusca(e.target.value)}
                    placeholder="Ex: 0101010010 ou CONSULTA..." />
                </div>
                <div>
                  <label className="label-modern">Competência</label>
                  <select className="input-modern" value={competenciaBusca}
                    onChange={e => setCompetenciaBusca(e.target.value)}>
                    {importadas.map(c => (
                      <option key={c} value={c}>{formatarCompetencia(c)}</option>
                    ))}
                  </select>
                </div>
              </div>

              {buscando && <p style={{ color: '#94a3b8', fontSize: '13px', fontFamily: 'DM Sans, sans-serif' }}>Buscando...</p>}

              {resultados.length > 0 && (
                <div style={{ overflowX: 'auto' }}>
                  <table className="table-modern">
                    <thead>
                      <tr style={{ background: GRAD }}>
                        {['Código', 'Procedimento', 'Complexidade', 'Sexo', 'Idade Mín.', 'Idade Máx.', 'Valor SH', 'Valor SA', 'Valor SP'].map(h => (
                          <th key={h} style={{ color: '#fff', whiteSpace: 'nowrap' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {resultados.map((r, i) => (
                        <tr key={i}>
                          <td style={{ fontFamily: 'monospace', fontSize: '12px', whiteSpace: 'nowrap' }}>{r.co_procedimento}</td>
                          <td style={{ fontSize: '12px', minWidth: '260px' }}>{r.no_procedimento}</td>
                          <td style={{ textAlign: 'center', fontSize: '11px' }}>{complexidade(r.co_complexidade)}</td>
                          <td style={{ textAlign: 'center', fontSize: '11px' }}>{sexo(r.co_sexo)}</td>
                          <td style={{ textAlign: 'center', fontSize: '11px' }}>{r.vl_idade_minima ?? '-'}</td>
                          <td style={{ textAlign: 'center', fontSize: '11px' }}>{r.vl_idade_maxima ?? '-'}</td>
                          <td style={{ textAlign: 'right', fontSize: '11px' }}>{formatarMoeda(r.vl_sh)}</td>
                          <td style={{ textAlign: 'right', fontSize: '11px' }}>{formatarMoeda(r.vl_sa)}</td>
                          <td style={{ textAlign: 'right', fontSize: '11px' }}>{formatarMoeda(r.vl_sp)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <p style={{ fontSize: '11px', color: '#94a3b8', fontFamily: 'DM Sans, sans-serif', marginTop: '10px', margin: '10px 0 0' }}>
                    {resultados.length} resultado{resultados.length !== 1 ? 's' : ''} — competência {formatarCompetencia(competenciaBusca)}
                  </p>
                </div>
              )}

              {resultados.length === 0 && busca.length >= 2 && !buscando && (
                <p style={{ color: '#94a3b8', fontSize: '13px', fontFamily: 'DM Sans, sans-serif' }}>Nenhum procedimento encontrado.</p>
              )}
            </>
          )}
        </div>
      </div>
    </Layout>
  )
}
