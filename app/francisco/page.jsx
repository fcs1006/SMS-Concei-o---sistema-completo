'use client'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Layout from '@/components/Layout'
import { Send, RefreshCw, FlaskConical, Phone, User } from 'lucide-react'

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
  const [resposta, setResposta] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [statusEnvio, setStatusEnvio] = useState('')
  const [vistos, setVistos] = useState({}) // { telefone: timestamp do ultimo visto }
  const msgEndRef = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => {
    const u = JSON.parse(localStorage.getItem('sms_user') || 'null')
    if (!u) { router.push('/'); return }
    if (u.perfil !== 'admin') { router.push('/painel'); return }
    setUsuario(u)
    // Carregar vistos do localStorage
    const v = JSON.parse(localStorage.getItem('francisco_vistos') || '{}')
    setVistos(v)
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

    // Busca nomes de pacientes pelos telefones
    const telefones = [...new Set(data.map(m => m.telefone))]
    let mapaNomes = {}
    if (telefones.length > 0) {
      const soDigitos = telefones.map(t => String(t).replace(/\D/g, ''))
      const { data: pacs } = await supabase
        .from('pacientes')
        .select('nome, telefone')
        .in('telefone', soDigitos)
      if (pacs) pacs.forEach(p => {
        const t = String(p.telefone || '').replace(/\D/g, '')
        mapaNomes[t] = p.nome
      })
    }

    // Agrupa por telefone
    const mapa = {}
    data.forEach(m => {
      const tel = String(m.telefone || '').replace(/\D/g, '')
      if (!mapa[m.telefone]) {
        mapa[m.telefone] = {
          telefone: m.telefone,
          nome: mapaNomes[tel] || null,
          ultima: m.mensagem,
          ultimaPapel: m.papel,
          hora: m.criado_em,
          total: 0,
          escalonado: false,
          naoLidas: 0
        }
      }
      mapa[m.telefone].total++
      if (m.papel === 'sistema' && m.mensagem.startsWith('🔴 ESCALONADO')) {
        mapa[m.telefone].escalonado = true
      }
    })

    // Calcula não lidas
    const vistosSalvos = JSON.parse(localStorage.getItem('francisco_vistos') || '{}')
    Object.values(mapa).forEach(c => {
      const ultimoVisto = vistosSalvos[c.telefone]
      if (ultimoVisto) {
        c.naoLidas = data.filter(m => m.telefone === c.telefone && new Date(m.criado_em) > new Date(ultimoVisto) && m.papel === 'user').length
      } else {
        c.naoLidas = data.filter(m => m.telefone === c.telefone && m.papel === 'user').length
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

    // Marcar como visto
    const agora = new Date().toISOString()
    const novosVistos = { ...vistos, [telefone]: agora }
    setVistos(novosVistos)
    localStorage.setItem('francisco_vistos', JSON.stringify(novosVistos))
    setConversas(prev => prev.map(c => c.telefone === telefone ? { ...c, naoLidas: 0 } : c))
  }

  function selecionar(telefone) {
    setSelecionado(telefone)
    setResposta('')
    setStatusEnvio('')
    carregarMensagens(telefone)
  }

  async function limparConversa(telefone) {
    if (!confirm('Apagar histórico desta conversa?')) return
    await supabase.from('whatsapp_conversas').delete().eq('telefone', telefone)
    await supabase.from('whatsapp_estados').delete().eq('telefone', telefone)
    setConversas(prev => prev.filter(c => c.telefone !== telefone))
    if (selecionado === telefone) { setSelecionado(null); setMensagens([]) }
  }

  async function enviarResposta() {
    if (!resposta.trim() || !selecionado || enviando) return
    setEnviando(true)
    setStatusEnvio('')
    try {
      const r = await fetch('/api/whatsapp/enviar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ numero: selecionado, texto: resposta.trim(), manual: true })
      })
      const json = await r.json()
      if (json.ok) {
        // Salvar no histórico como papel 'atendente'
        await supabase.from('whatsapp_conversas').insert([{
          telefone: selecionado,
          papel: 'assistant',
          mensagem: `[ATENDENTE] ${resposta.trim()}`
        }])
        setResposta('')
        setStatusEnvio('✅ Mensagem enviada!')
        carregarMensagens(selecionado)
      } else {
        setStatusEnvio('❌ Erro ao enviar. Verifique a conexão.')
      }
    } catch {
      setStatusEnvio('❌ Erro ao enviar.')
    }
    setEnviando(false)
  }

  const conv = selecionado ? conversas.find(c => c.telefone === selecionado) : null
  const totalNaoLidas = conversas.reduce((acc, c) => acc + (c.naoLidas || 0), 0)

  return (
    <Layout usuario={usuario}>
      <div style={{ padding: '20px 28px', maxWidth: '1300px', margin: '0 auto' }}>

        {/* Header */}
        <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '10px' }}>
          <div>
            <h1 style={{ fontFamily: 'Sora, sans-serif', fontSize: '21px', fontWeight: '700', color: '#0f172a', margin: '0 0 2px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              🤖 Agente Francisco
              {totalNaoLidas > 0 && (
                <span style={{ background: '#ef4444', color: 'white', borderRadius: '12px', fontSize: '11px', fontWeight: '700', padding: '2px 8px' }}>
                  {totalNaoLidas} nova{totalNaoLidas > 1 ? 's' : ''}
                </span>
              )}
            </h1>
            <p style={{ color: '#64748b', fontSize: '12px', margin: 0 }}>
              Monitor de conversas WhatsApp — SMS Conceição do Tocantins
            </p>
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <label style={{ fontSize: '12px', color: '#64748b', display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer' }}>
              <input type="checkbox" checked={autoRefresh} onChange={e => setAutoRefresh(e.target.checked)} />
              Auto (10s)
            </label>
            <button onClick={carregarConversas}
              style={{ padding: '7px 12px', background: '#1e293b', border: 'none', borderRadius: '8px', color: 'white', fontSize: '12px', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px' }}>
              <RefreshCw size={13} /> Atualizar
            </button>
            <button onClick={() => router.push('/francisco/teste')}
              style={{ padding: '7px 12px', background: '#075e54', border: 'none', borderRadius: '8px', color: 'white', fontSize: '12px', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px' }}>
              <FlaskConical size={13} /> Testar
            </button>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: '14px', height: 'calc(100vh - 190px)' }}>

          {/* Lista de conversas */}
          <div className="card" style={{ padding: '0', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '10px 14px', borderBottom: '1px solid #e2e8f0', background: '#f8fafc' }}>
              <p style={{ margin: 0, fontFamily: 'Sora, sans-serif', fontWeight: '700', fontSize: '12px', color: '#0f172a' }}>
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
                    padding: '10px 12px', borderBottom: '1px solid #f1f5f9', cursor: 'pointer',
                    background: selecionado === c.telefone ? '#eff6ff' : 'white',
                    borderLeft: selecionado === c.telefone ? '3px solid #2563eb' : c.escalonado ? '3px solid #ef4444' : '3px solid transparent',
                    transition: 'all 0.12s'
                  }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '6px' }}>
                    <div style={{ overflow: 'hidden', flex: 1 }}>

                      {/* Nome do paciente ou telefone */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '1px' }}>
                        {c.nome ? (
                          <><User size={10} color="#2563eb" /><p style={{ margin: 0, fontWeight: '700', fontSize: '12px', color: '#0f172a', fontFamily: 'Sora, sans-serif', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.nome}</p></>
                        ) : (
                          <><Phone size={10} color="#94a3b8" /><p style={{ margin: 0, fontWeight: '600', fontSize: '11px', color: '#475569', fontFamily: 'Sora, sans-serif' }}>{mascaraTel(c.telefone)}</p></>
                        )}
                        {c.escalonado && (
                          <span style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: '4px', fontSize: '9px', color: '#dc2626', fontWeight: '700', padding: '1px 4px', flexShrink: 0 }}>🔴 aguarda</span>
                        )}
                      </div>

                      {/* Telefone se tiver nome */}
                      {c.nome && (
                        <p style={{ margin: '0 0 2px', fontSize: '10px', color: '#94a3b8' }}>{mascaraTel(c.telefone)}</p>
                      )}

                      <p style={{ margin: 0, fontSize: '11px', color: '#64748b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {c.ultimaPapel === 'user' ? '' : '🤖 '}{c.ultima}
                      </p>
                    </div>

                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <p style={{ margin: '0 0 3px', fontSize: '10px', color: '#94a3b8' }}>{formatarHora(c.hora)}</p>
                      {c.naoLidas > 0 && (
                        <span style={{ background: '#22c55e', color: 'white', borderRadius: '10px', fontSize: '10px', fontWeight: '700', padding: '1px 6px', display: 'inline-block' }}>
                          {c.naoLidas}
                        </span>
                      )}
                      <button onClick={e => { e.stopPropagation(); limparConversa(c.telefone) }}
                        style={{ fontSize: '10px', color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer', padding: '0', display: 'block', marginTop: '2px' }}>
                        🗑 limpar
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Painel de mensagens */}
          <div className="card" style={{ padding: '0', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            {!selecionado ? (
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: '13px', flexDirection: 'column', gap: '8px' }}>
                <span style={{ fontSize: '40px' }}>💬</span>
                <p style={{ margin: 0 }}>Selecione uma conversa para visualizar</p>
              </div>
            ) : (
              <>
                {/* Header da conversa */}
                <div style={{ padding: '12px 18px', borderBottom: '1px solid #e2e8f0', background: '#f8fafc', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    {conv?.nome && (
                      <p style={{ margin: '0 0 1px', fontFamily: 'Sora, sans-serif', fontWeight: '700', fontSize: '13px', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '5px' }}>
                        <User size={13} color="#2563eb" /> {conv.nome}
                      </p>
                    )}
                    <p style={{ margin: 0, fontSize: '11px', color: '#64748b', display: 'flex', alignItems: 'center', gap: '5px' }}>
                      <Phone size={11} /> {mascaraTel(selecionado)} · {mensagens.length} mensagens
                    </p>
                  </div>
                  {conv?.escalonado && (
                    <span style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: '6px', fontSize: '11px', color: '#dc2626', fontWeight: '700', padding: '4px 10px' }}>
                      🔴 Aguarda atendimento humano
                    </span>
                  )}
                </div>

                {/* Mensagens */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '14px', display: 'flex', flexDirection: 'column', gap: '8px', background: '#f1f5f9' }}>
                  {mensagens.map((m, i) => (
                    m.papel === 'sistema' ? (
                      <div key={i} style={{ display: 'flex', justifyContent: 'center' }}>
                        <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: '8px', padding: '6px 12px', maxWidth: '90%', textAlign: 'center' }}>
                          <p style={{ margin: '0 0 1px', fontSize: '11px', color: '#dc2626', fontWeight: '700' }}>{m.mensagem}</p>
                          <p style={{ margin: 0, fontSize: '10px', color: '#94a3b8' }}>{formatarHora(m.criado_em)}</p>
                        </div>
                      </div>
                    ) : (
                      <div key={i} style={{ display: 'flex', justifyContent: m.papel === 'user' ? 'flex-start' : 'flex-end' }}>
                        <div style={{
                          maxWidth: '75%', padding: '8px 12px',
                          borderRadius: m.papel === 'user' ? '4px 14px 14px 14px' : '14px 4px 14px 14px',
                          background: m.papel === 'user' ? 'white' : m.mensagem.startsWith('[ATENDENTE]') ? '#dbeafe' : '#dcfce7',
                          boxShadow: '0 1px 3px rgba(0,0,0,0.07)',
                          border: m.papel === 'user' ? '1px solid #e2e8f0' : m.mensagem.startsWith('[ATENDENTE]') ? '1px solid #93c5fd' : '1px solid #86efac'
                        }}>
                          <p style={{ margin: '0 0 3px', fontSize: '12px', color: '#0f172a', whiteSpace: 'pre-wrap', lineHeight: '1.5' }}>
                            {m.mensagem.replace('[ATENDENTE] ', '')}
                          </p>
                          <p style={{ margin: 0, fontSize: '10px', color: '#94a3b8', textAlign: 'right' }}>
                            {m.papel === 'assistant'
                              ? (m.mensagem.startsWith('[ATENDENTE]') ? '👤 Atendente · ' : '🤖 Francisco · ')
                              : ''}
                            {formatarHora(m.criado_em)}
                          </p>
                        </div>
                      </div>
                    )
                  ))}
                  <div ref={msgEndRef} />
                </div>

                {/* Caixa de resposta manual */}
                <div style={{ padding: '10px 14px', borderTop: '1px solid #e2e8f0', background: 'white' }}>
                  {statusEnvio && (
                    <p style={{ margin: '0 0 6px', fontSize: '12px', color: statusEnvio.startsWith('✅') ? '#16a34a' : '#dc2626', fontWeight: '600' }}>
                      {statusEnvio}
                    </p>
                  )}
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
                    <textarea
                      ref={inputRef}
                      value={resposta}
                      onChange={e => setResposta(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviarResposta() } }}
                      placeholder="Responder como atendente... (Enter para enviar, Shift+Enter para nova linha)"
                      rows={2}
                      style={{
                        flex: 1, resize: 'none', border: '1px solid #e2e8f0', borderRadius: '10px',
                        padding: '8px 12px', fontSize: '12px', fontFamily: 'DM Sans, sans-serif',
                        outline: 'none', lineHeight: '1.5'
                      }}
                    />
                    <button
                      onClick={enviarResposta}
                      disabled={!resposta.trim() || enviando}
                      style={{
                        padding: '10px 16px', background: resposta.trim() ? 'linear-gradient(135deg, #075e54, #128c7e)' : '#e2e8f0',
                        border: 'none', borderRadius: '10px', color: resposta.trim() ? 'white' : '#94a3b8',
                        cursor: resposta.trim() ? 'pointer' : 'not-allowed',
                        display: 'flex', alignItems: 'center', gap: '5px',
                        fontWeight: '600', fontSize: '12px', transition: 'all 0.15s'
                      }}>
                      <Send size={14} /> {enviando ? '...' : 'Enviar'}
                    </button>
                  </div>
          <p style={{ margin: '4px 0 0', fontSize: '10px', color: '#94a3b8' }}>
                    Esta mensagem será enviada pelo WhatsApp como atendente humano
                  </p>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </Layout>
  )
}
