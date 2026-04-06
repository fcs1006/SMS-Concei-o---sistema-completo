'use client'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Layout from '@/components/Layout'

const COR     = '#34d399'
const GRAD    = 'linear-gradient(135deg, #064e3b, #065f46)'

function complexidade(c) {
  const m = { '01': 'AB', '02': 'MC', '03': 'AC', '04': 'AP' }
  return m[c] || c || '-'
}
function sexo(s) {
  return s === 'M' ? 'Masculino' : s === 'F' ? 'Feminino' : 'Ambos'
}

export default function Sigtap() {
  const router = useRouter()
  const [usuario, setUsuario] = useState(null)

  // Importação
  const [competenciaImport, setCompetenciaImport] = useState('')
  const [arquivo, setArquivo] = useState(null)
  const [importando, setImportando] = useState(false)
  const [resultImport, setResultImport] = useState(null)
  const fileRef = useRef()

  // Busca
  const [busca, setBusca] = useState('')
  const [competenciaBusca, setCompetenciaBusca] = useState('')
  const [competencias, setCompetencias] = useState([])
  const [resultados, setResultados] = useState([])
  const [buscando, setBuscando] = useState(false)

  useEffect(() => {
    const u = localStorage.getItem('sms_user')
    if (!u) { router.push('/'); return }
    setUsuario(JSON.parse(u))
    carregarCompetencias()
  }, [])

  useEffect(() => {
    if (busca.length < 3 && !competenciaBusca) { setResultados([]); return }
    const timer = setTimeout(() => buscarProcedimentos(), 400)
    return () => clearTimeout(timer)
  }, [busca, competenciaBusca])

  async function carregarCompetencias() {
    const { data } = await supabase
      .from('sigtap_procedimentos')
      .select('competencia')
      .order('competencia', { ascending: false })
    if (data) {
      const unicas = [...new Set(data.map(d => d.competencia))]
      setCompetencias(unicas)
      if (unicas.length > 0) setCompetenciaBusca(unicas[0])
    }
  }

  async function importar(e) {
    e.preventDefault()
    if (!arquivo || !competenciaImport) return
    setImportando(true)
    setResultImport(null)
    const fd = new FormData()
    fd.append('arquivo', arquivo)
    fd.append('competencia', competenciaImport.replace(/\D/g, ''))
    try {
      const res = await fetch('/api/sigtap/importar', { method: 'POST', body: fd })
      const data = await res.json()
      setResultImport(data)
      if (data.ok) {
        carregarCompetencias()
        setArquivo(null)
        fileRef.current.value = ''
      }
    } catch (err) {
      setResultImport({ ok: false, error: err.message })
    }
    setImportando(false)
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

  function formatarCompetencia(c) {
    if (!c || c.length !== 6) return c
    return `${c.slice(4,6)}/${c.slice(0,4)}`
  }

  function formatarMoeda(v) {
    if (!v) return '-'
    return `R$ ${Number(v).toFixed(2).replace('.', ',')}`
  }

  const mesAtual = new Date()
  const compSugerida = `${mesAtual.getFullYear()}${String(mesAtual.getMonth()+1).padStart(2,'0')}`

  return (
    <Layout usuario={usuario}>
      <div style={{ padding: '32px', maxWidth: '1100px' }}>

        <div style={{ marginBottom: '28px' }}>
          <h1 style={{ fontFamily: 'Sora, sans-serif', fontWeight: '700', fontSize: '22px', color: '#1e293b', margin: '0 0 4px' }}>
            SIGTAP — Procedimentos SUS
          </h1>
          <p style={{ color: '#64748b', fontSize: '13px', fontFamily: 'DM Sans, sans-serif', margin: 0 }}>
            Importe a tabela por competência e consulte os procedimentos
          </p>
        </div>

        {/* ── IMPORTAÇÃO ── */}
        <div style={{ background: '#fff', borderRadius: '16px', padding: '24px', boxShadow: '0 1px 8px rgba(0,0,0,0.07)', border: '1px solid #e2e8f0', marginBottom: '24px' }}>
          <h2 style={{ fontFamily: 'Sora, sans-serif', fontWeight: '700', fontSize: '14px', color: '#1e293b', margin: '0 0 16px' }}>
            📥 Importar nova competência
          </h2>

          <div style={{ background: '#f8fafc', borderRadius: '10px', padding: '12px 16px', marginBottom: '16px', border: '1px solid #e2e8f0' }}>
            <p style={{ fontSize: '12px', color: '#475569', fontFamily: 'DM Sans, sans-serif', margin: '0 0 6px', fontWeight: '600' }}>
              Como baixar o arquivo:
            </p>
            <ol style={{ fontSize: '12px', color: '#64748b', fontFamily: 'DM Sans, sans-serif', margin: 0, paddingLeft: '18px', lineHeight: '1.8' }}>
              <li>Acesse <strong>sigtap.datasus.gov.br</strong></li>
              <li>Clique em <strong>"Tabelas"</strong> → <strong>"Download"</strong></li>
              <li>Selecione a competência desejada</li>
              <li>Baixe o arquivo <strong>tb_procedimento.txt</strong></li>
              <li>Faça o upload abaixo</li>
            </ol>
          </div>

          <form onSubmit={importar} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '14px' }}>
              <div>
                <label className="label-modern">Competência (AAAAMM) *</label>
                <input className="input-modern" value={competenciaImport}
                  onChange={e => setCompetenciaImport(e.target.value.replace(/\D/g,'').slice(0,6))}
                  placeholder={compSugerida} maxLength={6} required />
              </div>
              <div>
                <label className="label-modern">Arquivo tb_procedimento.txt *</label>
                <input ref={fileRef} type="file" accept=".txt,.csv"
                  className="input-modern"
                  onChange={e => setArquivo(e.target.files?.[0] || null)}
                  style={{ paddingTop: '8px' }} required />
              </div>
            </div>

            {resultImport && (
              <div className={resultImport.ok ? 'status-ok' : 'status-err'}>
                {resultImport.ok
                  ? `✅ ${resultImport.inseridos.toLocaleString('pt-BR')} procedimentos importados para ${formatarCompetencia(resultImport.competencia)} (${resultImport.pulados} linhas ignoradas)`
                  : `❌ ${resultImport.error}`}
              </div>
            )}

            <div>
              <button type="submit" disabled={importando || !arquivo || !competenciaImport}
                className="btn-primary"
                style={{ background: GRAD, padding: '10px 28px', fontSize: '13px' }}>
                {importando ? 'Importando...' : '📥 IMPORTAR'}
              </button>
            </div>
          </form>
        </div>

        {/* ── BUSCA ── */}
        <div style={{ background: '#fff', borderRadius: '16px', padding: '24px', boxShadow: '0 1px 8px rgba(0,0,0,0.07)', border: '1px solid #e2e8f0' }}>
          <h2 style={{ fontFamily: 'Sora, sans-serif', fontWeight: '700', fontSize: '14px', color: '#1e293b', margin: '0 0 16px' }}>
            🔍 Consultar procedimentos
          </h2>

          {competencias.length === 0 ? (
            <p style={{ color: '#94a3b8', fontSize: '13px', fontFamily: 'DM Sans, sans-serif' }}>
              Nenhuma competência importada ainda.
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
                    {competencias.map(c => (
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
                          <td style={{ fontSize: '12px', minWidth: '280px' }}>{r.no_procedimento}</td>
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
                  <p style={{ fontSize: '11px', color: '#94a3b8', fontFamily: 'DM Sans, sans-serif', marginTop: '8px' }}>
                    {resultados.length} resultado{resultados.length !== 1 ? 's' : ''} — competência {formatarCompetencia(competenciaBusca)}
                  </p>
                </div>
              )}

              {resultados.length === 0 && busca.length >= 3 && !buscando && (
                <p style={{ color: '#94a3b8', fontSize: '13px', fontFamily: 'DM Sans, sans-serif' }}>
                  Nenhum procedimento encontrado.
                </p>
              )}
            </>
          )}
        </div>

      </div>
    </Layout>
  )
}
