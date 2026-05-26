'use client'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Layout from '@/components/Layout'
import { Send, RefreshCw, FlaskConical, Phone, User, Bot, Play, Pause, Trash2, XCircle } from 'lucide-react'
import { clientConfig } from '@/lib/config'

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
  const [assistantName, setAssistantName] = useState(() => {
    if (typeof window !== 'undefined') {
      const cached = localStorage.getItem('sms_client_config')
      if (cached) {
        try {
          const cc = JSON.parse(cached)
          if (cc.assistantName) return cc.assistantName
        } catch (e) {}
      }
    }
    return clientConfig.assistantName
  })
  const [municipalityName, setMunicipalityName] = useState(() => {
    if (typeof window !== 'undefined') {
      const cached = localStorage.getItem('sms_client_config')
      if (cached) {
        try {
          const cc = JSON.parse(cached)
          if (cc.municipalityName) return cc.municipalityName
        } catch (e) {}
      }
    }
    return clientConfig.municipalityName
  })
  
  const msgEndRef = useRef(null)
  const inputRef = useRef(null)
  const totalNaoLidasRef = useRef(null)

  useEffect(() => {
    const u = JSON.parse(localStorage.getItem('sms_user') || 'null')
    if (!u) { router.push('/'); return }
    if (u.perfil !== 'admin') { router.push('/painel'); return }
    setUsuario(u)
    
    // Carregar vistos do localStorage
    const v = JSON.parse(localStorage.getItem('francisco_vistos') || '{}')
    setVistos(v)
    
    // Carregar dados inicialmente
    carregarConversas()

    // Carregar identidade da IA
    fetch('/api/config/geral')
      .then(res => res.json())
      .then(data => {
        if (data.ok && data.configs?.client_config) {
          const cc = data.configs.client_config
          if (cc.assistantName) setAssistantName(cc.assistantName)
          if (cc.municipalityName) setMunicipalityName(cc.municipalityName)
          localStorage.setItem('sms_client_config', JSON.stringify(cc))
        }
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (!autoRefresh) return
    const timer = setInterval(carregarConversas, 10000)
    return () => clearInterval(timer)
  }, [autoRefresh, selecionado])

  useEffect(() => {
    msgEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [mensagens])

  // Função para tocar chime sonoro agradável (Web Audio API)
  function tocarNotificacao() {
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext
      if (!AudioContext) return
      const ctx = new AudioContext()
      
      // Tom 1 (D5)
      const osc1 = ctx.createOscillator()
      const gain1 = ctx.createGain()
      osc1.connect(gain1)
      gain1.connect(ctx.destination)
      osc1.type = 'sine'
      osc1.frequency.setValueAtTime(587.33, ctx.currentTime) // D5
      gain1.gain.setValueAtTime(0.12, ctx.currentTime)
      gain1.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15)
      osc1.start(ctx.currentTime)
      osc1.stop(ctx.currentTime + 0.15)
      
      // Tom 2 (A5, atrasado 0.08s)
      const osc2 = ctx.createOscillator()
      const gain2 = ctx.createGain()
      osc2.connect(gain2)
      gain2.connect(ctx.destination)
      osc2.type = 'sine'
      osc2.frequency.setValueAtTime(880.00, ctx.currentTime + 0.08) // A5
      gain2.gain.setValueAtTime(0.12, ctx.currentTime + 0.08)
      gain2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35)
      osc2.start(ctx.currentTime + 0.08)
      osc2.stop(ctx.currentTime + 0.35)
    } catch (e) {
      console.warn('Web Audio not allowed or failed:', e)
    }
  }

  async function carregarConversas() {
    try {
      const vistosSalvos = localStorage.getItem('francisco_vistos') || '{}'
      const resp = await fetch(`/api/whatsapp/conversas?vistos=${encodeURIComponent(vistosSalvos)}`)
      if (!resp.ok) throw new Error('Falha ao obter dados')
      const json = await resp.json()
      
      if (json.ok) {
        const lista = json.conversas || []
        
        // Disparar notificação sonora se o número total de não lidas aumentou
        const novoTotalNaoLidas = lista.reduce((acc, c) => acc + (c.naoLidas || 0), 0)
        if (totalNaoLidasRef.current !== null && novoTotalNaoLidas > totalNaoLidasRef.current) {
          tocarNotificacao()
        }
        totalNaoLidasRef.current = novoTotalNaoLidas

        setConversas(lista)
        setCarregando(false)

        // Se houver conversa selecionada, atualiza as mensagens dela
        if (selecionado) {
          carregarMensagens(selecionado)
        }
      }
    } catch (e) {
      console.error('Erro ao carregar conversas:', e)
    }
  }

  async function carregarMensagens(telefone) {
    try {
      const resp = await fetch(`/api/whatsapp/conversas?telefone=${encodeURIComponent(telefone)}`)
      if (!resp.ok) throw new Error('Erro ao obter mensagens')
      const json = await resp.json()
      if (json.ok) {
        setMensagens(json.mensagens || [])

        // Marcar como visto localmente
        const agora = new Date().toISOString()
        const novosVistos = { ...vistos, [telefone]: agora }
        setVistos(novosVistos)
        localStorage.setItem('francisco_vistos', JSON.stringify(novosVistos))
        
        // Zera o contador de não lidas na lista local imediatamente para melhor UX
        setConversas(prev => prev.map(c => c.telefone === telefone ? { ...c, naoLidas: 0 } : c))
      }
    } catch (e) {
      console.error('Erro ao carregar mensagens:', e)
    }
  }

  function selecionar(telefone) {
    setSelecionado(telefone)
    setResposta('')
    setStatusEnvio('')
    carregarMensagens(telefone)
  }

  async function limparConversa(telefone) {
    if (!confirm('Apagar histórico e redefinir estado desta conversa?')) return
    try {
      const resp = await fetch(`/api/whatsapp/conversas?telefone=${encodeURIComponent(telefone)}`, {
        method: 'DELETE'
      })
      const json = await resp.json()
      if (json.ok) {
        setConversas(prev => prev.filter(c => c.telefone !== telefone))
        if (selecionado === telefone) {
          setSelecionado(null)
          setMensagens([])
        }
      } else {
        alert('Erro ao limpar conversa: ' + (json.error || 'Erro desconhecido'))
      }
    } catch (e) {
      console.error(e)
      alert('Erro de conexão ao limpar conversa.')
    }
  }

  async function enviarResposta() {
    if (!resposta.trim() || !selecionado || enviando) return
    setEnviando(true)
    setStatusEnvio('')
    try {
      const r = await fetch('/api/whatsapp/enviar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ numero: selecionado, texto: resposta.trim() })
      })
      const json = await r.json()
      if (json.ok) {
        setResposta('')
        setStatusEnvio('✅ Mensagem enviada!')
        
        // Recarrega as mensagens do chat selecionado
        await carregarMensagens(selecionado)
        
        // Recarrega todas as conversas para atualizar a lista lateral (última mensagem e novo estado de atendimento)
        await carregarConversas()
      } else {
        setStatusEnvio(`❌ Erro ao enviar: ${json.error || 'Verifique a conexão.'}`)
      }
    } catch (e) {
      console.error(e)
      setStatusEnvio('❌ Erro de conexão ao enviar.')
    }
    setEnviando(false)
  }

  async function alterarEstadoChat(telefone, novoEstado) {
    try {
      const r = await fetch(`/api/whatsapp/conversas?telefone=${encodeURIComponent(telefone)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estado: novoEstado })
      })
      const json = await r.json()
      if (json.ok) {
        // Atualiza estado local
        setConversas(prev => prev.map(c => c.telefone === telefone ? { ...c, estado: novoEstado } : c))
        await carregarConversas()
      } else {
        alert('Erro ao alterar o estado do chat: ' + (json.error || 'Erro desconhecido.'))
      }
    } catch (e) {
      console.error(e)
      alert('Erro de conexão ao alterar estado.')
    }
  }

  async function finalizarAtendimento(telefone) {
    if (!confirm(`Deseja finalizar o atendimento humano? Isso enviará o comando "#fim" para encerrar a sessão e reativar o robô ${assistantName}.`)) return
    setEnviando(true)
    setStatusEnvio('')
    try {
      const r = await fetch('/api/whatsapp/enviar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ numero: telefone, texto: '#fim' })
      })
      const json = await r.json()
      if (json.ok) {
        setResposta('')
        setStatusEnvio('✅ Atendimento finalizado e bot reativado!')
        await carregarConversas()
      } else {
        setStatusEnvio(`❌ Erro ao finalizar: ${json.error || 'Erro desconhecido.'}`)
      }
    } catch (e) {
      console.error(e)
      setStatusEnvio('❌ Erro de conexão ao finalizar.')
    }
    setEnviando(false)
  }

  const conv = selecionado ? conversas.find(c => c.telefone === selecionado) : null
  const totalNaoLidas = conversas.reduce((acc, c) => acc + (c.naoLidas || 0), 0)

  return (
    <Layout usuario={usuario}>
      <div style={{ padding: '20px 28px', maxWidth: '1400px', margin: '0 auto', fontFamily: 'Inter, sans-serif' }}>

        {/* Header */}
        <div style={{ marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '14px' }}>
          <div>
            <h1 style={{ fontFamily: 'Sora, sans-serif', fontSize: '24px', fontWeight: '800', color: '#0f172a', margin: '0 0 4px', display: 'flex', alignItems: 'center', gap: '10px', letterSpacing: '-0.5px' }}>
              🤖 Agente {assistantName}
              {totalNaoLidas > 0 && (
                <span style={{ 
                  background: 'linear-gradient(135deg, #ef4444, #dc2626)', 
                  color: 'white', 
                  borderRadius: '9999px', 
                  fontSize: '11px', 
                  fontWeight: '800', 
                  padding: '2px 10px',
                  boxShadow: '0 2px 4px rgba(239, 68, 68, 0.2)',
                  animation: 'pulse 2s infinite'
                }}>
                  {totalNaoLidas} nova{totalNaoLidas > 1 ? 's' : ''}
                </span>
              )}
            </h1>
            <p style={{ color: '#64748b', fontSize: '13px', margin: 0 }}>
              Gerenciamento e controle de atendimento em tempo real · SMS {municipalityName}
            </p>
          </div>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
            <label style={{ 
              fontSize: '13px', 
              color: '#475569', 
              display: 'flex', 
              alignItems: 'center', 
              gap: '6px', 
              cursor: 'pointer',
              background: '#f1f5f9',
              padding: '6px 12px',
              borderRadius: '8px',
              fontWeight: '500',
              userSelect: 'none'
            }}>
              <input type="checkbox" checked={autoRefresh} onChange={e => setAutoRefresh(e.target.checked)} style={{ cursor: 'pointer' }} />
              Auto-atualizar (10s)
            </label>
            
            <button onClick={carregarConversas}
              style={{ 
                padding: '8px 14px', 
                background: '#1e293b', 
                border: 'none', 
                borderRadius: '8px', 
                color: 'white', 
                fontSize: '13px', 
                fontWeight: '600', 
                cursor: 'pointer', 
                display: 'flex', 
                alignItems: 'center', 
                gap: '6px',
                transition: 'all 0.15s',
                boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
              }}
              onMouseEnter={e => e.currentTarget.style.background = '#0f172a'}
              onMouseLeave={e => e.currentTarget.style.background = '#1e293b'}
            >
              <RefreshCw size={14} /> Atualizar
            </button>

            <button onClick={() => router.push('/francisco/teste')}
              style={{ 
                padding: '8px 14px', 
                background: '#0f766e', 
                border: 'none', 
                borderRadius: '8px', 
                color: 'white', 
                fontSize: '13px', 
                fontWeight: '600', 
                cursor: 'pointer', 
                display: 'flex', 
                alignItems: 'center', 
                gap: '6px',
                transition: 'all 0.15s',
                boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
              }}
              onMouseEnter={e => e.currentTarget.style.background = '#0d9488'}
              onMouseLeave={e => e.currentTarget.style.background = '#0f766e'}
            >
              <FlaskConical size={14} /> Laboratório de Testes
            </button>
          </div>
        </div>

        {/* Layout Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: '16px', height: 'calc(100vh - 200px)' }}>

          {/* Painel Esquerdo: Lista de Conversas */}
          <div className="card" style={{ padding: '0', overflow: 'hidden', display: 'flex', flexDirection: 'column', background: 'white', border: '1px solid #e2e8f0', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)' }}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid #e2e8f0', background: '#f8fafc', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <p style={{ margin: 0, fontFamily: 'Sora, sans-serif', fontWeight: '750', fontSize: '13px', color: '#1e293b' }}>
                Conversas Ativas ({conversas.length})
              </p>
            </div>
            
            <div style={{ flex: 1, overflowY: 'auto' }}>
              {carregando ? (
                <div style={{ padding: '32px', textAlign: 'center', color: '#94a3b8' }}>
                  <RefreshCw size={24} className="animate-spin" style={{ margin: '0 auto 8px', color: '#3b82f6' }} />
                  <p style={{ margin: 0, fontSize: '13px' }}>Carregando atendimentos...</p>
                </div>
              ) : conversas.length === 0 ? (
                <p style={{ padding: '32px', color: '#94a3b8', fontSize: '13px', textAlign: 'center' }}>Nenhum contato recente no WhatsApp.</p>
              ) : conversas.map(c => {
                const isSelected = selecionado === c.telefone
                const isHuman = c.estado === 'aguardando_humano'
                return (
                  <div key={c.telefone}
                    onClick={() => selecionar(c.telefone)}
                    style={{
                      padding: '12px 14px', 
                      borderBottom: '1px solid #f1f5f9', 
                      cursor: 'pointer',
                      background: isSelected ? '#f0f7ff' : 'white',
                      borderLeft: isSelected 
                        ? '4px solid #2563eb' 
                        : isHuman 
                          ? '4px solid #ef4444' 
                          : '4px solid transparent',
                      transition: 'all 0.15s ease'
                    }}
                    onMouseEnter={e => { if(!isSelected) e.currentTarget.style.background = '#f8fafc' }}
                    onMouseLeave={e => { if(!isSelected) e.currentTarget.style.background = 'white' }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                      <div style={{ overflow: 'hidden', flex: 1 }}>

                        {/* Nome / Telefone Header */}
                        <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '5px', marginBottom: '2px' }}>
                          {c.nome ? (
                            <>
                              <User size={12} color="#2563eb" style={{ flexShrink: 0 }} />
                              <p style={{ 
                                margin: 0, 
                                fontWeight: '700', 
                                fontSize: '13px', 
                                color: '#0f172a', 
                                fontFamily: 'Sora, sans-serif', 
                                overflow: 'hidden', 
                                textOverflow: 'ellipsis', 
                                whiteSpace: 'nowrap',
                                maxWidth: '120px'
                              }} title={c.nome}>
                                {c.nome}
                              </p>
                            </>
                          ) : (
                            <>
                              <Phone size={11} color="#94a3b8" style={{ flexShrink: 0 }} />
                              <p style={{ 
                                margin: 0, 
                                fontWeight: '600', 
                                fontSize: '12px', 
                                color: '#475569', 
                                fontFamily: 'Sora, sans-serif' 
                              }}>
                                {mascaraTel(c.telefone)}
                              </p>
                            </>
                          )}

                          {/* Badge de estado (Bot / Humano) */}
                          {isHuman ? (
                            <span style={{ background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: '4px', fontSize: '8px', color: '#b91c1c', fontWeight: '800', padding: '1px 4px', flexShrink: 0 }}>
                              🔴 Humano
                            </span>
                          ) : (
                            <span style={{ background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: '4px', fontSize: '8px', color: '#047857', fontWeight: '800', padding: '1px 4px', flexShrink: 0 }}>
                              🤖 Bot
                            </span>
                          )}
                        </div>

                        {c.nome && (
                          <p style={{ margin: '0 0 3px', fontSize: '10px', color: '#64748b', fontWeight: '500' }}>
                            {mascaraTel(c.telefone)}
                          </p>
                        )}

                        {/* Visualização da última mensagem */}
                        <p style={{ 
                          margin: 0, 
                          fontSize: '11.5px', 
                          color: isSelected ? '#1e40af' : '#64748b', 
                          whiteSpace: 'nowrap', 
                          overflow: 'hidden', 
                          textOverflow: 'ellipsis' 
                        }}>
                          {c.ultimaPapel === 'user' ? '' : c.ultimaPapel === 'sistema' ? '⚙️ ' : '🤖 '}
                          {c.ultima}
                        </p>
                      </div>

                      <div style={{ textAlign: 'right', flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                        <p style={{ margin: '0 0 4px', fontSize: '10px', color: '#94a3b8', fontWeight: '500' }}>
                          {formatarHora(c.hora)}
                        </p>
                        
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          {c.naoLidas > 0 && (
                            <span style={{ 
                              background: '#22c55e', 
                              color: 'white', 
                              borderRadius: '9999px', 
                              fontSize: '10px', 
                              fontWeight: '800', 
                              padding: '2px 6px', 
                              display: 'inline-block',
                              boxShadow: '0 1px 2px rgba(34, 197, 94, 0.2)'
                            }}>
                              {c.naoLidas}
                            </span>
                          )}
                          
                          <button 
                            onClick={e => { e.stopPropagation(); limparConversa(c.telefone) }}
                            title="Apagar histórico e redefinir conversa"
                            style={{ 
                              fontSize: '11px', 
                              color: '#94a3b8', 
                              background: 'none', 
                              border: 'none', 
                              cursor: 'pointer', 
                              padding: '2px', 
                              borderRadius: '4px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              transition: 'color 0.15s, background 0.15s'
                            }}
                            onMouseEnter={e => { e.currentTarget.style.color = '#ef4444'; e.currentTarget.style.background = '#fee2e2' }}
                            onMouseLeave={e => { e.currentTarget.style.color = '#94a3b8'; e.currentTarget.style.background = 'none' }}
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Painel Direito: Histórico de Conversa & Chat */}
          <div className="card" style={{ padding: '0', overflow: 'hidden', display: 'flex', flexDirection: 'column', background: 'white', border: '1px solid #e2e8f0', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)' }}>
            {!selecionado ? (
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: '14px', flexDirection: 'column', gap: '12px', background: '#f8fafc' }}>
                <div style={{ fontSize: '48px', opacity: 0.8, animation: 'bounce 2s infinite' }}>💬</div>
                <p style={{ margin: 0, fontWeight: '600' }}>Selecione um chat para iniciar o atendimento</p>
                <p style={{ margin: 0, fontSize: '12px', color: '#cbd5e1' }}>Monitore conversações ou assuma chats pausando o robô</p>
              </div>
            ) : (
              <>
                {/* Header do Chat Selecionado */}
                <div style={{ 
                  padding: '14px 20px', 
                  borderBottom: '1px solid #e2e8f0', 
                  background: 'white', 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.02)',
                  flexWrap: 'wrap',
                  gap: '10px'
                }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '8px', marginBottom: '2px' }}>
                      {conv?.nome ? (
                        <span style={{ fontFamily: 'Sora, sans-serif', fontWeight: '750', fontSize: '14px', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '5px' }}>
                          <User size={15} color="#2563eb" /> {conv.nome}
                        </span>
                      ) : (
                        <span style={{ fontFamily: 'Sora, sans-serif', fontWeight: '750', fontSize: '14px', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '5px' }}>
                          <Phone size={14} color="#64748b" /> {mascaraTel(selecionado)}
                        </span>
                      )}

                      {/* Status da conversa */}
                      {conv?.estado === 'aguardando_humano' ? (
                        <span style={{ 
                          background: '#fee2e2', 
                          border: '1px solid #fca5a5', 
                          borderRadius: '9999px', 
                          fontSize: '10px', 
                          color: '#b91c1c', 
                          fontWeight: '800', 
                          padding: '2px 10px',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          boxShadow: '0 1px 2px rgba(239, 68, 68, 0.05)'
                        }}>
                          <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#ef4444', display: 'inline-block' }}></span>
                          Controle Humano Ativo
                        </span>
                      ) : (
                        <span style={{ 
                          background: '#ecfdf5', 
                          border: '1px solid #a7f3d0', 
                          borderRadius: '9999px', 
                          fontSize: '10px', 
                          color: '#047857', 
                          fontWeight: '800', 
                          padding: '2px 10px',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          boxShadow: '0 1px 2px rgba(16, 185, 129, 0.05)'
                        }}>
                          <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10b981', display: 'inline-block' }}></span>
                          Bot {assistantName} Ativo
                        </span>
                      )}
                    </div>
                    
                    <p style={{ margin: 0, fontSize: '11px', color: '#64748b', display: 'flex', alignItems: 'center', gap: '5px' }}>
                      <Phone size={11} /> {mascaraTel(selecionado)} · {mensagens.length} mensagens no histórico
                    </p>
                  </div>

                  {/* Ações de controle de controle do robô */}
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    {conv?.estado === 'aguardando_humano' ? (
                      <>
                        <button
                          onClick={() => alterarEstadoChat(selecionado, 'menu')}
                          style={{
                            padding: '7px 12px',
                            background: '#eff6ff',
                            border: '1px solid #bfdbfe',
                            borderRadius: '8px',
                            color: '#1e40af',
                            fontSize: '12px',
                            fontWeight: '600',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '5px',
                            transition: 'all 0.15s ease',
                          }}
                          onMouseEnter={e => { e.currentTarget.style.background = '#dbeafe' }}
                          onMouseLeave={e => { e.currentTarget.style.background = '#eff6ff' }}
                        >
                          <Play size={13} /> Devolver ao Bot
                        </button>
                        <button
                          onClick={() => finalizarAtendimento(selecionado)}
                          style={{
                            padding: '7px 12px',
                            background: 'linear-gradient(135deg, #ef4444, #dc2626)',
                            border: 'none',
                            borderRadius: '8px',
                            color: 'white',
                            fontSize: '12px',
                            fontWeight: '600',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '5px',
                            transition: 'all 0.15s ease',
                            boxShadow: '0 2px 4px rgba(220, 38, 38, 0.1)'
                          }}
                          onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 4px 6px rgba(220, 38, 38, 0.15)' }}
                          onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0px)'; e.currentTarget.style.boxShadow = '0 2px 4px rgba(220, 38, 38, 0.1)' }}
                        >
                          <XCircle size={13} /> Finalizar e Reativar Bot
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => alterarEstadoChat(selecionado, 'aguardando_humano')}
                        style={{
                          padding: '7px 12px',
                          background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                          border: 'none',
                          borderRadius: '8px',
                          color: 'white',
                          fontSize: '12px',
                          fontWeight: '600',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '5px',
                          transition: 'all 0.15s ease',
                          boxShadow: '0 2px 4px rgba(217, 119, 6, 0.1)'
                        }}
                        onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 4px 6px rgba(217, 119, 6, 0.15)' }}
                        onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0px)'; e.currentTarget.style.boxShadow = '0 2px 4px rgba(217, 119, 6, 0.1)' }}
                      >
                        <Pause size={13} /> Pausar Bot e Assumir
                      </button>
                    )}
                  </div>
                </div>

                {/* Histórico de Mensagens */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px', background: '#f1f5f9' }}>
                  {mensagens.map((m, i) => {
                    if (m.papel === 'sistema') {
                      const isBotActivation = m.mensagem.includes('reativado')
                      return (
                        <div key={i} style={{ display: 'flex', justifyContent: 'center', margin: '6px 0' }}>
                          <div style={{ 
                            background: isBotActivation ? '#e6f4ea' : '#fce8e6', 
                            border: isBotActivation ? '1px solid #a3cfec' : '1px solid #f5c2c2', 
                            borderRadius: '8px', 
                            padding: '6px 14px', 
                            maxWidth: '85%', 
                            textAlign: 'center',
                            boxShadow: '0 1px 2px rgba(0,0,0,0.02)'
                          }}>
                            <p style={{ 
                              margin: '0 0 2px', 
                              fontSize: '11px', 
                              color: isBotActivation ? '#137333' : '#c5221f', 
                              fontWeight: '600' 
                            }}>{m.mensagem}</p>
                            <p style={{ margin: 0, fontSize: '9px', color: '#94a3b8' }}>{formatarHora(m.criado_em)}</p>
                          </div>
                        </div>
                      )
                    }

                    const isUser = m.papel === 'user'
                    const isManual = m.mensagem.startsWith('[ATENDENTE]')
                    
                    return (
                      <div key={i} style={{ display: 'flex', justifyContent: isUser ? 'flex-start' : 'flex-end' }}>
                        <div style={{
                          maxWidth: '75%', 
                          padding: '10px 14px',
                          borderRadius: isUser ? '4px 16px 16px 16px' : '16px 4px 16px 16px',
                          background: isUser ? 'white' : isManual ? '#eff6ff' : '#ecfdf5',
                          boxShadow: '0 1.5px 3px rgba(0, 0, 0, 0.05)',
                          border: isUser 
                            ? '1px solid #e2e8f0' 
                            : isManual 
                              ? '1px solid #bfdbfe' 
                              : '1px solid #a7f3d0',
                          transition: 'all 0.2s'
                        }}>
                          <p style={{ margin: '0 0 4px', fontSize: '13px', color: '#1e293b', whiteSpace: 'pre-wrap', lineHeight: '1.5' }}>
                            {isManual ? m.mensagem.replace('[ATENDENTE] ', '') : m.mensagem}
                          </p>
                          
                          <p style={{ margin: 0, fontSize: '9.5px', color: '#94a3b8', textAlign: 'right', fontWeight: '500' }}>
                            {!isUser && (
                              <span style={{ fontWeight: '600', color: isManual ? '#2563eb' : '#059669' }}>
                                {isManual ? '👤 Atendente · ' : `🤖 Bot ${assistantName} · `}
                              </span>
                            )}
                            {formatarHora(m.criado_em)}
                          </p>
                        </div>
                      </div>
                    )
                  })}
                  <div ref={msgEndRef} />
                </div>

                {/* Caixa de Resposta e Input */}
                <div style={{ padding: '14px 20px', borderTop: '1px solid #e2e8f0', background: 'white' }}>
                  {statusEnvio && (
                    <p style={{ 
                      margin: '0 0 8px', 
                      fontSize: '12px', 
                      color: statusEnvio.startsWith('✅') ? '#15803d' : '#b91c1c', 
                      fontWeight: '600',
                      background: statusEnvio.startsWith('✅') ? '#f0fdf4' : '#fef2f2',
                      padding: '4px 10px',
                      borderRadius: '6px',
                      display: 'inline-block'
                    }}>
                      {statusEnvio}
                    </p>
                  )}
                  
                  <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-end' }}>
                    <textarea
                      ref={inputRef}
                      value={resposta}
                      onChange={e => setResposta(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviarResposta() } }}
                      placeholder={
                        conv?.estado === 'aguardando_humano'
                          ? "Escreva sua resposta como atendente humano..."
                          : "O bot está respondendo. Digite e envie para silenciar o bot e assumir..."
                      }
                      rows={2}
                      style={{
                        flex: 1, 
                        resize: 'none', 
                        border: '1px solid #cbd5e1', 
                        borderRadius: '10px',
                        padding: '10px 14px', 
                        fontSize: '13px', 
                        fontFamily: 'Inter, sans-serif',
                        outline: 'none', 
                        lineHeight: '1.5',
                        boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.02)',
                        transition: 'border-color 0.15s, box-shadow 0.15s'
                      }}
                      onFocus={e => { e.currentTarget.style.borderColor = '#3b82f6'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.1)' }}
                      onBlur={e => { e.currentTarget.style.borderColor = '#cbd5e1'; e.currentTarget.style.boxShadow = 'none' }}
                    />
                    
                    <button
                      onClick={enviarResposta}
                      disabled={!resposta.trim() || enviando}
                      style={{
                        padding: '12px 18px', 
                        background: resposta.trim() ? 'linear-gradient(135deg, #2563eb, #1d4ed8)' : '#f1f5f9',
                        border: 'none', 
                        borderRadius: '10px', 
                        color: resposta.trim() ? 'white' : '#94a3b8',
                        cursor: resposta.trim() ? 'pointer' : 'not-allowed',
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: '6px',
                        fontWeight: '600', 
                        fontSize: '13px', 
                        transition: 'all 0.15s',
                        boxShadow: resposta.trim() ? '0 2px 4px rgba(37, 99, 235, 0.15)' : 'none'
                      }}
                      onMouseEnter={e => { if (resposta.trim()) { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 4px 6px rgba(37, 99, 235, 0.2)' } }}
                      onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0px)'; e.currentTarget.style.boxShadow = resposta.trim() ? '0 2px 4px rgba(37, 99, 235, 0.15)' : 'none' }}
                    >
                      <Send size={14} /> {enviando ? 'Enviando...' : 'Enviar'}
                    </button>
                  </div>
                  
                  <p style={{ margin: '6px 0 0', fontSize: '11px', color: '#94a3b8', fontWeight: '500' }}>
                    {conv?.estado === 'aguardando_humano' 
                      ? "O bot está silenciado para este contato. Suas mensagens serão enviadas diretamente pelo WhatsApp."
                      : `Atenção: enviar uma mensagem silenciará automaticamente o bot ${assistantName} para este contato.`
                    }
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
