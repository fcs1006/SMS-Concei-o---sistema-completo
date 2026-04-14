'use client'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Layout from '@/components/Layout'

function mascaraTel(v) {
  const d = String(v || '').replace(/\D/g, '')
  if (d.length === 13) return `+${d.slice(0,2)} (${d.slice(2,4)}) ${d.slice(4,9)}-${d.slice(9)}`
  if (d.length === 11) return `(${d.slice(0,2)}) ${d.slice(2,7)}-${d.slice(7)}`
  return v
}

function formatarHora(v) {
  if (!v) return ''
  const d = new Date(v)
  return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}

export default function Francisco() {
  const router = useRouter()
  const [usuario, setUsuario] = useState(null)
  const [conversas, setConversas] = useState([])
  const [selecionado, setSelecionado] = useState(null)
  const [mensagens, setMensagens] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [autoRefresh, setAutoRefresh] = useState(true)
  const msgEndRef = useRef(null)

  useEffect(() => {
    const u = JSON.parse(localStorage.getItem('sms_user') || 'null')
    if (!u) { router.push('/'); return }
    if (u.perfil !== 'admin') { router.push('/painel'); return }
    setUsuario(u)
    carregarConversas()
  }, [])

  useEffect(() => {
    if (!autoRefresh) return
    const timer = setInterval(carregarConversas, 10000)
    return () => clearInterval(timer)
  }, [autoRefresh, selecionado])

  useEffect(() => {
    msgEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [mensagens])

  async function carregarConversas() {
    const { data } = await supabase
      .from('whatsapp_conversas')
      .select('telefone, nome, mensagem, papel, criado_em')
      .order('criado_em', { ascending: false })

    if (!data) return

    // Agrupa por telefone
    const mapa = {}
    data.forEach(m => {
      if (!mapa[m.telefone]) {
        mapa[m.telefone] = { telefone: m.telefone, ultima: m.mensagem, hora: m.criado_em, total: 0, escalonado: false }
      }
      mapa[m.telefone].total++
      if (m.papel === 'sistema' && m.mensagem.startsWith('🔴 ESCALONADO')) {
        mapa[m.telefone].escalonado = true
      }
    })

    const lista = Object.values(mapa).sort((a, b) => new Date(b.hora) - new Date(a.hora))
    setConversas(lista)
    setCarregando(false)

    if (selecionado) carregarMensagens(selecionado)
  }

  async function carregarMensagens(telefone) {
    const { data } = await supabase
      .from('whatsapp_conversas')
      .select('papel, mensagem, criado_em')
      .eq('telefone', telefone)
      .order('criado_em', { ascending: true })

    setMensagens(data || [])
  }

  function selecionar(telefone) {
    setSelecionado(telefone)
    carregarMensagens(telefone)
  }

  async function limparConversa(telefone) {
    if (!confirm('Apagar histórico desta conversa?')) return
    await supabase.from('whatsapp_conversas').delete().eq('telefone', telefone)
    setConversas(prev => prev.filter(c => c.telefone !== telefone))
    if (selecionado === telefone) { setSelecionado(null); setMensagens([]) }
  }

  return (
    <Layout usuario={usuario}>
      <div style={{ padding: '28px', maxWidth: '1200px', margin: '0 auto' }}>
        <div style={{ marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h1 style={{ fontFamily: 'Sora, sans-serif', fontSize: '22px', fontWeight: '700', color: '#0f172a', margin: '0 0 4px' }}>
              🤖 Agente Francisco
            </h1>
            <p style={{ color: '#64748b', fontSize: '13px', margin: 0 }}>
              Monitor de conversas do WhatsApp — SMS Conceição do Tocantins
            </p>
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <label style={{ fontSize: '12px', color: '#64748b', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
              <input type="checkbox" checked={autoRefresh} onChange={e => setAutoRefresh(e.target.checked)} />
              Auto-atualizar (10s)
            </label>
            <button onClick={carregarConversas}
              style={{ padding: '7px 14px', background: '#1e293b', border: 'none', borderRadius: '8px', color: 'white', fontSize: '12px', fontWeight: '600', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}>
              🔄 Atualizar
            </button>
            <button onClick={() => router.push('/francisco/teste')}
              style={{ padding: '7px 14px', background: '#075e54', border: 'none', borderRadius: '8px', color: 'white', fontSize: '12px', fontWeight: '600', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}>
              🧪 Testar Francisco
            </button>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: '16px', height: 'calc(100vh - 200px)' }}>

          {/* Lista de conversas */}
          <div className="card" style={{ padding: '0', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '14px 16px', borderBottom: '1px solid #e2e8f0', background: '#f8fafc' }}>
              <p style={{ margin: 0, fontFamily: 'Sora, sans-serif', fontWeight: '700', fontSize: '13px', color: '#0f172a' }}>
                Conversas ({conversas.length})
              </p>
            </div>
            <div style={{ flex: 1, overflowY: 'auto' }}>
              {carregando ? (
                <p style={{ padding: '16px', color: '#94a3b8', fontSize: '13px', textAlign: 'center' }}>Carregando...</p>
              ) : conversas.length === 0 ? (
                <p style={{ padding: '16px', color: '#94a3b8', fontSize: '13px', textAlign: 'center' }}>Nenhuma conversa ainda.</p>
              ) : conversas.map(c => (
                <div key={c.telefone}
                  onClick={() => selecionar(c.telefone)}
                  style={{
                    padding: '12px 14px', borderBottom: '1px solid #f1f5f9', cursor: 'pointer',
                    background: selecionado === c.telefone ? '#eff6ff' : 'white',
                    borderLeft: selecionado === c.telefone ? '3px solid #2563eb' : '3px solid transparent',
                    transition: 'all 0.15s'
                  }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                    <div style={{ overflow: 'hidden', flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
                        <p style={{ margin: 0, fontWeight: '700', fontSize: '12px', color: '#0f172a', fontFamily: 'Sora, sans-serif' }}>
                          {mascaraTel(c.telefone)}
                        </p>
                        {c.escalonado && (
                          <span style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: '4px', fontSize: '10px', color: '#dc2626', fontWeight: '700', padding: '1px 5px' }}>
                            🔴 Aguarda atendimento
                          </span>
                        )}
                      </div>
                      <p style={{ margin: 0, fontSize: '11px', color: '#64748b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {c.ultima}
                      </p>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <p style={{ margin: '0 0 4px', fontSize: '10px', color: '#94a3b8' }}>{formatarHora(c.hora)}</p>
                      <button onClick={e => { e.stopPropagation(); limparConversa(c.telefone) }}
                        style={{ fontSize: '10px', color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer', padding: '0' }}>
                        🗑 limpar
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Mensagens da conversa */}
          <div className="card" style={{ padding: '0', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            {!selecionado ? (
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: '13px', flexDirection: 'column', gap: '8px' }}>
                <span style={{ fontSize: '40px' }}>💬</span>
                <p style={{ margin: 0 }}>Selecione uma conversa para visualizar</p>
              </div>
            ) : (
              <>
                <div style={{ padding: '14px 18px', borderBottom: '1px solid #e2e8f0', background: '#f8fafc', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <p style={{ margin: '0 0 1px', fontFamily: 'Sora, sans-serif', fontWeight: '700', fontSize: '13px', color: '#0f172a' }}>
                      {mascaraTel(selecionado)}
                    </p>
                    <p style={{ margin: 0, fontSize: '11px', color: '#64748b' }}>{mensagens.length} mensagens</p>
                  </div>
                </div>

                <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px', background: '#f8fafc' }}>
                  {mensagens.map((m, i) => (
                    m.papel === 'sistema' ? (
                      <div key={i} style={{ display: 'flex', justifyContent: 'center' }}>
                        <div style={{
                          background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: '8px',
                          padding: '8px 14px', maxWidth: '90%', textAlign: 'center'
                        }}>
                          <p style={{ margin: '0 0 2px', fontSize: '12px', color: '#dc2626', fontWeight: '700' }}>{m.mensagem}</p>
                          <p style={{ margin: 0, fontSize: '10px', color: '#94a3b8' }}>{formatarHora(m.criado_em)}</p>
                        </div>
                      </div>
                    ) : (
                    <div key={i} style={{ display: 'flex', justifyContent: m.papel === 'user' ? 'flex-start' : 'flex-end' }}>
                      <div style={{
                        maxWidth: '75%', padding: '10px 14px', borderRadius: m.papel === 'user' ? '4px 14px 14px 14px' : '14px 4px 14px 14px',
                        background: m.papel === 'user' ? 'white' : '#dcfce7',
                        boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
                        border: m.papel === 'user' ? '1px solid #e2e8f0' : '1px solid #86efac'
                      }}>
                        <p style={{ margin: '0 0 4px', fontSize: '12px', color: '#0f172a', whiteSpace: 'pre-wrap', lineHeight: '1.5' }}>
                          {m.mensagem}
                        </p>
                        <p style={{ margin: 0, fontSize: '10px', color: '#94a3b8', textAlign: 'right' }}>
                          {m.papel === 'assistant' ? '🤖 Francisco · ' : ''}{formatarHora(m.criado_em)}
                        </p>
                      </div>
                    </div>
                    )
                  ))}
                  <div ref={msgEndRef} />
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </Layout>
  )
}
