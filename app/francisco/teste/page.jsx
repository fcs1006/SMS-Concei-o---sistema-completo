'use client'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { clientConfig } from '@/lib/config'
import { 
  Bot, Send, RefreshCw, Trash2, ArrowLeft, Play, CheckCircle2, 
  XCircle, Clock, Zap, Shield, UserCheck, Mic, HelpCircle, Activity 
} from 'lucide-react'

const PACIENTES_TESTE = [
  { label: '👤 Paciente Cadastrado (Fernando Cerqueira)', tel: '5500000000000', desc: 'Simula cidadão com CPF/CNS no sistema' },
  { label: '👤 Paciente Anônimo (Novo Usuário)', tel: '5599999999999', desc: 'Simula cidadão sem cadastro prévio' }
]

export default function FranciscoTeste() {
  const router = useRouter()
  const [mensagens, setMensagens] = useState([])
  const [texto, setTexto] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [telefoneTeste, setTelefoneTeste] = useState('5500000000000')
  const [estadoAtual, setEstadoAtual] = useState('menu')
  const [latenciaMs, setLatenciaMs] = useState(null)
  const [painelInspecao, setPainelInspecao] = useState(true)
  
  // Estados do Runner de Testes Automáticos
  const [rodandoBateria, setRodandoBateria] = useState(false)
  const [progressoBateria, setProgressoBateria] = useState([])
  const [mostrarModalBateria, setMostrarModalBateria] = useState(false)
  const [itemExpandido, setItemExpandido] = useState(null)

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

  const msgEndRef = useRef(null)

  useEffect(() => {
    const u = JSON.parse(localStorage.getItem('sms_user') || 'null')
    if (!u || u.perfil !== 'admin') { router.push('/'); return }

    fetch('/api/config/geral')
      .then(res => res.json())
      .then(data => {
        if (data.ok && data.configs?.client_config) {
          const cc = data.configs.client_config
          if (cc.assistantName) setAssistantName(cc.assistantName)
          localStorage.setItem('sms_client_config', JSON.stringify(cc))
        }
      })
      .catch(() => {})

    carregarEstadoEConversa()
  }, [telefoneTeste])

  useEffect(() => {
    msgEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [mensagens])

  async function carregarEstadoEConversa() {
    try {
      const res = await fetch(`/api/whatsapp/teste?telefone=${telefoneTeste}`)
      const json = await res.json()
      if (json.ok) {
        setEstadoAtual(json.estado || 'menu')
      }
    } catch (e) {
      console.error(e)
    }
  }

  async function enviar(textoOverride, isAudioSim = false) {
    const msgVal = typeof textoOverride === 'string' ? textoOverride : texto
    const msg = (msgVal || '').trim()
    if ((!msg && !isAudioSim) || enviando) return null

    if (typeof textoOverride !== 'string') {
      setTexto('')
    }

    const tInicio = performance.now()
    setMensagens(prev => [...prev, { papel: 'user', mensagem: isAudioSim ? '🎙️ [Mensagem de Voz Simulada]' : msg, hora: new Date() }])
    setEnviando(true)

    try {
      const antes = await fetch(`/api/whatsapp/teste?telefone=${telefoneTeste}`)
      const ultimaAntes = await antes.json()
      const ultimaAntesId = ultimaAntes?.ultima?.id || null

      // Monta evento do webhook
      const webhookBody = isAudioSim ? {
        event: 'messages.upsert',
        data: {
          key: { fromMe: false, remoteJid: `${telefoneTeste}@s.whatsapp.net` },
          message: {
            audioMessage: {
              url: 'https://example.com/audio.ogg',
              mimetype: 'audio/ogg'
            }
          }
        }
      } : {
        event: 'messages.upsert',
        data: {
          key: { fromMe: false, remoteJid: `${telefoneTeste}@s.whatsapp.net` },
          message: { conversation: msg }
        }
      }

      const res = await fetch('/api/whatsapp/webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(webhookBody)
      })
      const json = await res.json()

      let tentativasDb = 0
      let encontrouNova = false
      let respostaTexto = ''

      while (tentativasDb < 20 && !encontrouNova) {
        await new Promise(r => setTimeout(r, 400))
        const res2 = await fetch(`/api/whatsapp/teste?telefone=${telefoneTeste}&after_id=${ultimaAntesId || 0}`)
        const json2 = await res2.json()
        const novas = json2.mensagens || []
        
        if (json2.ok) {
          setEstadoAtual(json2.estado || 'menu')
        }

        if (json2.ok && novas.length > 0) {
          const tFim = performance.now()
          const latencia = Math.round(tFim - tInicio)
          setLatenciaMs(latencia)

          respostaTexto = novas.map(m => m.mensagem).join('\n')
          setMensagens(prev => [
            ...prev,
            ...novas.map(m => ({ papel: m.papel, mensagem: m.mensagem, hora: new Date(m.criado_em), latencia }))
          ])
          encontrouNova = true
        }
        tentativasDb++
      }

      setEnviando(false)
      if (encontrouNova) {
        return { ok: true, resposta: respostaTexto }
      } else {
        return { ok: false, error: json.error || 'Nenhuma resposta gravada no banco' }
      }
    } catch (e) {
      setEnviando(false)
      return { ok: false, error: e.message }
    }
  }

  async function limparConversa() {
    await fetch(`/api/whatsapp/teste?telefone=${telefoneTeste}`, { method: 'DELETE' })
    setMensagens([])
    setEstadoAtual('menu')
    setLatenciaMs(null)
  }

  // ── Runner da Bateria de Testes de Sanidade (8 Cenários) ─────────────────────
  async function executarBateriaTestes() {
    setRodandoBateria(true)
    setMostrarModalBateria(true)
    setProgressoBateria([])
    
    // Limpa a conversa de teste antes de iniciar
    await limparConversa()

    const cenarios = [
      {
        id: 1,
        nome: '👋 1. Menu Principal & Apresentação',
        input: 'Olá',
        validador: (resp) => resp.toLowerCase().includes('assistente') || resp.toLowerCase().includes('menu') || resp.toLowerCase().includes('opções'),
        desc: 'Verifica se a IA se apresenta e oferece o menu de opções.'
      },
      {
        id: 2,
        nome: '📅 2. Consulta de Agendamentos / Especialidades',
        input: '1',
        validador: (resp) => resp.toLowerCase().includes('agendamento') || resp.toLowerCase().includes('cpf') || resp.toLowerCase().includes('consulta') || resp.toLowerCase().includes('usg'),
        desc: 'Verifica o fluxo de busca de agendamentos municipais.'
      },
      {
        id: 3,
        nome: '🚗 3. Consulta de Viagens de TFD',
        input: '2',
        validador: (resp) => resp.toLowerCase().includes('tfd') || resp.toLowerCase().includes('viagem') || resp.toLowerCase().includes('transporte') || resp.toLowerCase().includes('cpf'),
        desc: 'Verifica o fluxo de consulta de viagens de TFD.'
      },
      {
        id: 4,
        nome: '🩺 4. Consulta de Status no SISREG',
        input: '3',
        validador: (resp) => resp.toLowerCase().includes('sisreg') || resp.toLowerCase().includes('estado') || resp.toLowerCase().includes('cpf'),
        desc: 'Verifica o fluxo de consulta ao sistema SISREG do Estado.'
      },
      {
        id: 5,
        nome: '🚨 5. Alerta de Urgência / Protocolo de Segurança',
        input: 'Estou passando muito mal com dor no peito',
        validador: (resp) => resp.toLowerCase().includes('urgência') || resp.toLowerCase().includes('emergência') || resp.toLowerCase().includes('ubs') || resp.toLowerCase().includes('hospital') || resp.includes('99130-6916'),
        desc: 'Verifica o aviso obrigatório de urgência e número de suporte médico.'
      },
      {
        id: 6,
        nome: '👤 6. Transferência para Atendente Humano',
        input: '#humano',
        validador: (resp) => resp.toLowerCase().includes('transferido') || resp.toLowerCase().includes('atendente') || resp.toLowerCase().includes('humano') || resp.toLowerCase().includes('aguarde'),
        desc: 'Verifica a pausa do robô e escalonamento para atendente humano.'
      },
      {
        id: 7,
        nome: '🎙️ 7. Transcrição de Voz / Mídia',
        input: '[AUDIO_SIMULADO]',
        isAudio: true,
        validador: (resp) => resp.length > 0,
        desc: 'Verifica o tratamento de mensagens de voz recebidas.'
      },
      {
        id: 8,
        nome: '🔐 8. Proteção LGPD de Dados',
        input: 'Consultar CPF 12345678900',
        validador: (resp) => resp.toLowerCase().includes('nascimento') || resp.toLowerCase().includes('data') || resp.toLowerCase().includes('lgpd') || resp.toLowerCase().includes('autoriz'),
        desc: 'Verifica se a consulta exige validação da data de nascimento para LGPD.'
      }
    ]

    const resultados = []

    for (const item of cenarios) {
      // Limpa a conversa e reseta o estado do banco para isolar cada teste
      await fetch(`/api/whatsapp/teste?telefone=${telefoneTeste}`, { method: 'DELETE' })
      setEstadoAtual('menu')

      setProgressoBateria(prev => [...prev, { ...item, status: 'rodando' }])
      
      const tStart = performance.now()
      const res = item.isAudio 
        ? await enviar(null, true)
        : await enviar(item.input)
      const tEnd = performance.now()
      const tempo = Math.round(tEnd - tStart)

      const aprovado = res.ok && item.validador(res.resposta || '')

      const itemRes = {
        ...item,
        status: aprovado ? 'sucesso' : 'falha',
        resposta: res.resposta || res.error || 'Sem resposta',
        tempo
      }

      resultados.push(itemRes)
      setProgressoBateria(prev => prev.map(p => p.id === item.id ? itemRes : p))

      // Pequena pausa entre testes
      await new Promise(r => setTimeout(r, 600))
    }

    setRodandoBateria(false)
  }

  function copiarLogTestes() {
    const dataHora = new Date().toLocaleString('pt-BR')
    let logTxt = `=====================================================\n`
    logTxt += `  RELATÓRIO DE HOMOLOGAÇÃO & SANIDADE - AGENTE ${assistantName.toUpperCase()}\n`
    logTxt += `  Data/Hora: ${dataHora}\n`
    logTxt += `  Perfil Simulado: ${telefoneTeste}\n`
    logTxt += `=====================================================\n\n`

    progressoBateria.forEach((p) => {
      const icon = p.status === 'sucesso' ? '✅ PASSOU' : p.status === 'falha' ? '❌ FALHOU' : '⏳ RODANDO'
      logTxt += `[${icon}] ${p.nome} (${p.tempo || 0}ms)\n`
      logTxt += `  - Descrição: ${p.desc}\n`
      logTxt += `  - Entrada Enviada: "${p.input || (p.isAudio ? 'Mensagem de voz simulada' : '')}"\n`
      logTxt += `  - Resposta do Francisco: ${p.resposta ? JSON.stringify(p.resposta) : 'Sem resposta'}\n`
      if (p.status === 'falha') {
        logTxt += `  - Diagnóstico do Erro: A resposta obtida não continha os critérios esperados para homologação.\n`
      }
      logTxt += `-----------------------------------------------------\n\n`
    })

    navigator.clipboard.writeText(logTxt)
    alert('📋 Relatório detalhado dos testes e erros copiado para a área de transferência!')
  }

  function hora(d) {
    return new Date(d).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#f8fafc', fontFamily: 'Inter, sans-serif' }}>

      {/* Top Header */}
      <div style={{ background: '#0f172a', padding: '12px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #1e293b', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <button 
            onClick={() => router.push('/francisco')} 
            style={{ background: '#1e293b', border: '1px solid #334155', color: '#94a3b8', borderRadius: '8px', padding: '6px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: '600' }}
          >
            <ArrowLeft size={16} /> Voltar ao Painel
          </button>
          
          <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: 'linear-gradient(135deg, #2563eb, #1d4ed8)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}>
            <Bot size={22} />
          </div>

          <div>
            <h1 style={{ margin: 0, color: 'white', fontWeight: '800', fontSize: '16px', fontFamily: 'Sora, sans-serif', display: 'flex', alignItems: 'center', gap: '8px' }}>
              Laboratório de Homologação — {assistantName}
              <span style={{ background: '#059669', color: 'white', borderRadius: '9999px', fontSize: '10px', padding: '2px 8px', fontWeight: '700' }}>
                Ambiente de Testes
              </span>
            </h1>
            <p style={{ margin: 0, color: '#94a3b8', fontSize: '12px' }}>
              Simulador oficial de interações e bateria de validação de qualidade
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            onClick={executarBateriaTestes}
            disabled={rodandoBateria}
            style={{
              padding: '8px 16px',
              background: 'linear-gradient(135deg, #059669, #047857)',
              border: 'none',
              borderRadius: '8px',
              color: 'white',
              fontSize: '13px',
              fontWeight: '700',
              cursor: rodandoBateria ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: '0 2px 4px rgba(5, 150, 105, 0.2)'
            }}
          >
            <Play size={14} /> {rodandoBateria ? 'Executando Testes...' : '▶ Executar Bateria de Testes'}
          </button>

          <button 
            onClick={limparConversa} 
            style={{ background: '#334155', border: 'none', borderRadius: '8px', color: '#e2e8f0', fontSize: '12px', padding: '8px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: '600' }}
          >
            <Trash2 size={14} /> Limpar
          </button>
        </div>
      </div>

      {/* Subheader / Seletor de Perfil do Paciente */}
      <div style={{ background: 'white', borderBottom: '1px solid #e2e8f0', padding: '10px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, minWidth: '280px' }}>
          <UserCheck size={16} color="#2563eb" />
          <span style={{ fontSize: '12px', fontWeight: '700', color: '#475569', textTransform: 'uppercase' }}>Perfil Simulado:</span>
          
          <select 
            value={telefoneTeste} 
            onChange={e => setTelefoneTeste(e.target.value)}
            style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', fontWeight: '600', color: '#0f172a', background: '#f8fafc', outline: 'none', flex: 1, maxWidth: '420px' }}
          >
            {PACIENTES_TESTE.map(p => (
              <option key={p.tel} value={p.tel}>{p.label}</option>
            ))}
          </select>
        </div>

        {/* Métricas em Tempo Real */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#64748b' }}>
            <Zap size={14} color="#f59e0b" />
            <span>Latência:</span>
            <strong style={{ color: latenciaMs ? (latenciaMs < 2000 ? '#16a34a' : '#d97706') : '#94a3b8' }}>
              {latenciaMs ? `${latenciaMs} ms` : '—'}
            </strong>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#64748b' }}>
            <Activity size={14} color="#2563eb" />
            <span>Estado DB:</span>
            <span style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '4px', padding: '1px 6px', fontSize: '11px', fontWeight: '700', color: '#1e40af' }}>
              {estadoAtual}
            </span>
          </div>
        </div>
      </div>

      {/* Área Principal de Chat & Inspeção */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        
        {/* Janela de Chat Simulada (Estilo WhatsApp) */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#efeae2', backgroundPattern: 'radial-gradient(#cbd5e1 1px, transparent 1px)' }}>
          
          <div style={{ flex: 1, overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {mensagens.length === 0 && (
              <div style={{ textAlign: 'center', color: '#64748b', fontSize: '13px', margin: 'auto 0', padding: '40px 20px', background: 'rgba(255,255,255,0.8)', borderRadius: '16px', maxWidth: '520px', alignSelf: 'center', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
                <Bot size={44} color="#2563eb" style={{ margin: '0 auto 12px' }} />
                <h3 style={{ margin: '0 0 6px', fontFamily: 'Sora, sans-serif', color: '#0f172a' }}>Laboratório de Testes Ativo</h3>
                <p style={{ margin: '0 0 16px', fontSize: '12.5px', color: '#64748b', lineHeight: '1.5' }}>
                  Envie mensagens abaixo para testar as respostas do {assistantName} ou clique em <strong>"▶ Executar Bateria de Testes"</strong> para rodar os testes automatizados de sanidade.
                </p>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', justifyContent: 'center' }}>
                  {['Olá', 'Quero ver meus agendamentos', 'Tenho viagem de TFD marcada?', 'Como está meu pedido no SISREG?'].map(s => (
                    <button 
                      key={s} 
                      onClick={() => enviar(s)}
                      style={{ background: 'white', border: '1px solid #cbd5e1', borderRadius: '16px', padding: '6px 12px', fontSize: '12px', cursor: 'pointer', color: '#1e40af', fontWeight: '600', transition: 'all 0.15s' }}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {mensagens.map((m, i) => {
              if (m.papel === 'erro') {
                return (
                  <div key={i} style={{ display: 'flex', justifyContent: 'center' }}>
                    <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: '8px', padding: '8px 14px', fontSize: '12px', color: '#dc2626' }}>
                      {m.mensagem}
                    </div>
                  </div>
                )
              }

              const isUser = m.papel === 'user'

              return (
                <div key={i} style={{ display: 'flex', justifyContent: isUser ? 'flex-end' : 'flex-start' }}>
                  <div style={{
                    maxWidth: '75%', 
                    padding: '10px 14px',
                    borderRadius: isUser ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
                    background: isUser ? '#dcf8c6' : 'white',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
                    display: 'flex',
                    flexDirection: 'column'
                  }}>
                    <p style={{ margin: '0 0 4px', fontSize: '13px', color: '#111', whiteSpace: 'pre-wrap', lineHeight: '1.5' }}>
                      {m.mensagem}
                    </p>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px', gap: '8px' }}>
                      {!isUser && m.latencia && (
                        <span style={{ fontSize: '9.5px', color: '#059669', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '2px' }}>
                          <Zap size={10} /> {m.latencia}ms
                        </span>
                      )}
                      <span style={{ fontSize: '9.5px', color: '#888', marginLeft: 'auto' }}>
                        {hora(m.hora)}
                      </span>
                    </div>
                  </div>
                </div>
              )
            })}

            {enviando && (
              <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                <div style={{ background: 'white', borderRadius: '12px 12px 12px 2px', padding: '10px 16px', boxShadow: '0 1px 2px rgba(0,0,0,0.1)' }}>
                  <span style={{ fontSize: '16px', color: '#3b82f6', letterSpacing: '3px' }}>•••</span>
                </div>
              </div>
            )}
            <div ref={msgEndRef} />
          </div>

          {/* Input Bar */}
          <div style={{ background: '#f0f2f5', padding: '12px 16px', borderTop: '1px solid #cbd5e1', display: 'flex', gap: '10px', alignItems: 'center' }}>
            <button
              onClick={() => enviar(null, true)}
              title="Simular Envio de Mensagem de Voz (Áudio)"
              style={{ padding: '10px', borderRadius: '50%', border: '1px solid #cbd5e1', background: 'white', color: '#2563eb', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              <Mic size={18} />
            </button>

            <textarea
              value={texto}
              onChange={e => setTexto(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviar() } }}
              placeholder="Digite uma mensagem para simular o atendimento no WhatsApp..."
              rows={1}
              style={{
                flex: 1, borderRadius: '20px', border: '1px solid #cbd5e1', padding: '10px 18px',
                fontSize: '13.5px', resize: 'none', outline: 'none', fontFamily: 'inherit',
                lineHeight: '1.4', background: 'white'
              }}
            />

            <button
              onClick={() => enviar()}
              disabled={!texto.trim() || enviando}
              style={{
                width: '42px', height: '42px', borderRadius: '50%', border: 'none',
                background: texto.trim() && !enviando ? 'linear-gradient(135deg, #2563eb, #1d4ed8)' : '#cbd5e1',
                color: 'white', cursor: texto.trim() && !enviando ? 'pointer' : 'default',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
              }}
            >
              <Send size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Modal / Overlay da Bateria Automática de Testes */}
      {mostrarModalBateria && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.75)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999, padding: '20px' }}>
          <div style={{ background: 'white', borderRadius: '16px', width: '100%', maxWidth: '640px', overflow: 'hidden', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.3)' }}>
            
            <div style={{ padding: '18px 24px', background: '#0f172a', color: 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ margin: 0, fontFamily: 'Sora, sans-serif', fontSize: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Activity size={18} color="#10b981" /> Bateria de Testes de Sanidade do Francisco
                </h3>
                <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#94a3b8' }}>
                  Executando verificação de homologação de fluxos em tempo real
                </p>
              </div>

              {!rodandoBateria && (
                <button 
                  onClick={() => setMostrarModalBateria(false)}
                  style={{ background: '#334155', border: 'none', borderRadius: '6px', color: 'white', padding: '4px 10px', fontSize: '12px', cursor: 'pointer' }}
                >
                  Fechar
                </button>
              )}
            </div>

            <div style={{ padding: '20px', maxHeight: '420px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {progressoBateria.map(p => {
                const isExpanded = itemExpandido === p.id
                return (
                  <div 
                    key={p.id}
                    onClick={() => setItemExpandido(isExpanded ? null : p.id)}
                    style={{
                      padding: '12px 14px',
                      borderRadius: '10px',
                      border: '1px solid #e2e8f0',
                      background: p.status === 'sucesso' ? '#f0fdf4' : p.status === 'falha' ? '#fef2f2' : '#f8fafc',
                      borderColor: p.status === 'sucesso' ? '#bbf7d0' : p.status === 'falha' ? '#fca5a5' : '#cbd5e1',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '6px',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontWeight: '700', fontSize: '13px', color: '#0f172a' }}>{p.nome}</span>
                      
                      {p.status === 'rodando' && (
                        <span style={{ fontSize: '11px', color: '#2563eb', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <RefreshCw size={12} className="animate-spin" /> Testando...
                        </span>
                      )}

                      {p.status === 'sucesso' && (
                        <span style={{ fontSize: '11px', color: '#15803d', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <CheckCircle2 size={14} /> PASSOU ({p.tempo}ms) {isExpanded ? '▲' : '▼'}
                        </span>
                      )}

                      {p.status === 'falha' && (
                        <span style={{ fontSize: '11px', color: '#b91c1c', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <XCircle size={14} /> FALHOU ({p.tempo}ms) {isExpanded ? '▲' : '▼'}
                        </span>
                      )}
                    </div>

                    <p style={{ margin: 0, fontSize: '11px', color: '#64748b' }}>{p.desc}</p>

                    {/* Detalhes expandidos do teste */}
                    {isExpanded && (
                      <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid rgba(0,0,0,0.08)', fontSize: '11px', fontFamily: 'monospace', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <div style={{ background: 'white', padding: '6px 10px', borderRadius: '6px', border: '1px solid #cbd5e1' }}>
                          <strong style={{ color: '#475569' }}>📩 Entrada Enviada:</strong>
                          <pre style={{ margin: '2px 0 0', whiteSpace: 'pre-wrap', color: '#0f172a' }}>{p.input || (p.isAudio ? '[MENSAGEM_DE_VOZ_SIMULADA]' : '—')}</pre>
                        </div>
                        <div style={{ background: 'white', padding: '6px 10px', borderRadius: '6px', border: '1px solid #cbd5e1' }}>
                          <strong style={{ color: '#475569' }}>📤 Resposta do Francisco:</strong>
                          <pre style={{ margin: '2px 0 0', whiteSpace: 'pre-wrap', color: p.status === 'falha' ? '#b91c1c' : '#15803d' }}>{p.resposta || 'Nenhuma resposta recebida'}</pre>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            <div style={{ padding: '14px 24px', background: '#f8fafc', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '12px', fontWeight: '600', color: '#475569' }}>
                Status: {rodandoBateria ? 'Executando testes...' : 'Bateria concluída! Clique no teste para ver detalhes.'}
              </span>

              {!rodandoBateria && (
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    onClick={copiarLogTestes}
                    style={{ padding: '8px 14px', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '8px', color: '#1e40af', fontSize: '12px', fontWeight: '700', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                  >
                    📋 Copiar Log de Erros
                  </button>

                  <button
                    onClick={() => setMostrarModalBateria(false)}
                    style={{ padding: '8px 16px', background: '#0f172a', border: 'none', borderRadius: '8px', color: 'white', fontSize: '13px', fontWeight: '700', cursor: 'pointer' }}
                  >
                    Concluir Homologação
                  </button>
                </div>
              )}
            </div>

          </div>
        </div>
      )}

    </div>
  )
}
