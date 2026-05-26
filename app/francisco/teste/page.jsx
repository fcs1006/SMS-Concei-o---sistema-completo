'use client'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { clientConfig } from '@/lib/config'

const TELEFONE_TESTE = '5500000000000'

export default function FranciscoTeste() {
  const router = useRouter()
  const [mensagens, setMensagens] = useState([])
  const [texto, setTexto] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [limpar, setLimpar] = useState(false)
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

    // Carrega identidade da IA
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
  }, [])

  useEffect(() => {
    msgEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [mensagens])

  async function enviar(textoOverride) {
    const msgVal = typeof textoOverride === 'string' ? textoOverride : texto
    const msg = (msgVal || '').trim()
    if (!msg || enviando) return
    if (typeof textoOverride !== 'string') {
      setTexto('')
    }
    setMensagens(prev => [...prev, { papel: 'user', mensagem: msg, hora: new Date() }])
    setEnviando(true)

    try {
      const antes = await fetch(`/api/whatsapp/teste?telefone=${TELEFONE_TESTE}`)
      const ultimaAntes = await antes.json()
      const ultimaAntesId = ultimaAntes?.ultima?.id || null

      const res = await fetch('/api/whatsapp/webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event: 'messages.upsert',
          data: {
            key: { fromMe: false, remoteJid: `${TELEFONE_TESTE}@s.whatsapp.net` },
            message: { conversation: msg }
          }
        })
      })
      const json = await res.json()

      // Tenta buscar a resposta por até 5 segundos
      let tentativasDb = 0
      let encontrouNova = false

      while (tentativasDb < 20 && !encontrouNova) {
        await new Promise(r => setTimeout(r, 500))
        const res2 = await fetch(`/api/whatsapp/teste?telefone=${TELEFONE_TESTE}&after_id=${ultimaAntesId || 0}`)
        const json2 = await res2.json()
        const novas = json2.mensagens || []
        
        if (json2.ok && novas.length > 0) {
          setMensagens(prev => [
            ...prev,
            ...novas.map(m => ({ papel: m.papel, mensagem: m.mensagem, hora: new Date(m.criado_em) }))
          ])
          encontrouNova = true
        }
        tentativasDb++
      }

      if (!json.ok && !encontrouNova) {
        setMensagens(prev => [...prev, { papel: 'erro', mensagem: `Erro: ${json.error}`, hora: new Date() }])
      } else if (!encontrouNova) {
        setMensagens(prev => [...prev, { papel: 'erro', mensagem: `Nenhuma resposta nova foi gravada pelo ${assistantName}. Verifique o log do servidor.`, hora: new Date() }])
      }
    } catch (e) {
      setMensagens(prev => [...prev, { papel: 'erro', mensagem: `Erro de conexão: ${e.message}`, hora: new Date() }])
    }
    setEnviando(false)
  }

  async function limparConversa() {
    await fetch(`/api/whatsapp/teste?telefone=${TELEFONE_TESTE}`, { method: 'DELETE' })
    setMensagens([])
  }

  function hora(d) {
    return new Date(d).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#e5ddd5', fontFamily: 'DM Sans, sans-serif' }}>

      {/* Header */}
      <div style={{ background: '#075e54', padding: '12px 18px', display: 'flex', alignItems: 'center', gap: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.2)' }}>
        <button onClick={() => router.push('/francisco')} style={{ background: 'none', border: 'none', color: 'white', fontSize: '18px', cursor: 'pointer', padding: '0 4px' }}>←</button>
        <div style={{ width: '38px', height: '38px', borderRadius: '50%', background: '#25d366', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px' }}>🤖</div>
        <div>
          <p style={{ margin: 0, color: 'white', fontWeight: '700', fontSize: '15px' }}>{assistantName}</p>
          <p style={{ margin: 0, color: '#b2dfdb', fontSize: '11px' }}>Teste de simulação — não usa WhatsApp real</p>
        </div>
        <button onClick={limparConversa} style={{ marginLeft: 'auto', background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: '8px', color: 'white', fontSize: '11px', padding: '6px 12px', cursor: 'pointer' }}>
          🗑 Limpar
        </button>
      </div>

      {/* Aviso */}
      <div style={{ background: '#fff3cd', borderBottom: '1px solid #ffc107', padding: '8px 18px', fontSize: '12px', color: '#856404', textAlign: 'center' }}>
        ⚠️ Ambiente de teste — mensagens salvas com telefone <code>{TELEFONE_TESTE}</code> e <strong>enviadas ao banco de dados</strong>
      </div>

      {/* Mensagens */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {mensagens.length === 0 && (
          <div style={{ textAlign: 'center', color: '#666', fontSize: '13px', marginTop: '40px' }}>
            <p style={{ fontSize: '40px', marginBottom: '8px' }}>🤖</p>
            <p>Envie uma mensagem para testar o {assistantName}</p>
            <div style={{ marginTop: '16px', display: 'flex', flexWrap: 'wrap', gap: '8px', justifyContent: 'center' }}>
              {['Olá', 'Quais são os serviços?', 'Qual o horário?', 'Preciso de ajuda com meu agendamento'].map(s => (
                <button key={s} onClick={() => setTexto(s)}
                  style={{ background: 'white', border: '1px solid #ddd', borderRadius: '16px', padding: '6px 14px', fontSize: '12px', cursor: 'pointer', color: '#075e54', fontWeight: '600' }}>
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

          // Analisa se a mensagem do assistente tem botões/opções estruturadas no padrão de fallback
          let cleanText = m.mensagem
          const options = []
          
          if (m.papel === 'assistant') {
            const lines = m.mensagem.split('\n')
            const cleanLines = []
            
            lines.forEach(line => {
              const match = line.match(/^(\d+)(?:️⃣|️⃣)?\s*\*([^*]+)\*(?:\s*-\s*(.+))?$/)
              if (match) {
                options.push({
                  id: match[1],
                  label: match[2].trim(),
                  description: match[3] ? match[3].trim() : ''
                })
              } else {
                cleanLines.push(line)
              }
            })
            cleanText = cleanLines.join('\n').trim()
          }

          return (
            <div key={i} style={{ display: 'flex', justifyContent: m.papel === 'user' ? 'flex-end' : 'flex-start' }}>
              <div style={{
                maxWidth: '75%', padding: '8px 12px',
                borderRadius: m.papel === 'user' ? '12px 12px 4px 12px' : '12px 12px 12px 4px',
                background: m.papel === 'user' ? '#dcf8c6' : 'white',
                boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
                display: 'flex',
                flexDirection: 'column'
              }}>
                {cleanText && (
                  <p style={{ margin: '0 0 4px', fontSize: '13px', color: '#111', whiteSpace: 'pre-wrap', lineHeight: '1.5' }}>
                    {cleanText}
                  </p>
                )}

                {options.length > 0 && (
                  <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '6px', minWidth: '180px' }}>
                    {options.map(opt => (
                      <button
                        key={opt.id}
                        onClick={() => enviar(opt.id)}
                        disabled={enviando}
                        style={{
                          background: '#f0fdf4',
                          border: '1px solid #bbf7d0',
                          borderRadius: '8px',
                          padding: '8px 10px',
                          fontSize: '12.5px',
                          color: '#166534',
                          fontWeight: '600',
                          cursor: enviando ? 'default' : 'pointer',
                          textAlign: 'left',
                          width: '100%',
                          transition: 'background 0.2s',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '2px',
                          boxShadow: '0 1px 1px rgba(0,0,0,0.05)',
                          outline: 'none'
                        }}
                        onMouseOver={e => { if (!enviando) e.currentTarget.style.background = '#dcfce7' }}
                        onMouseOut={e => { if (!enviando) e.currentTarget.style.background = '#f0fdf4' }}
                      >
                        <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ fontSize: '10px' }}>🟢</span>
                          <span>{opt.label}</span>
                        </span>
                        {opt.description && (
                          <span style={{ fontSize: '10.5px', color: '#15803d', fontWeight: 'normal', paddingLeft: '16px' }}>
                            {opt.description}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                )}

                <p style={{ margin: '4px 0 0', fontSize: '10px', color: '#999', textAlign: 'right' }}>
                  {hora(m.hora)}
                </p>
              </div>
            </div>
          )
        })}

        {enviando && (
          <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
            <div style={{ background: 'white', borderRadius: '12px 12px 12px 4px', padding: '10px 16px', boxShadow: '0 1px 2px rgba(0,0,0,0.1)' }}>
              <span style={{ fontSize: '18px', letterSpacing: '2px' }}>•••</span>
            </div>
          </div>
        )}
        <div ref={msgEndRef} />
      </div>

      {/* Input */}
      <div style={{ background: '#f0f0f0', padding: '10px 12px', display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
        <textarea
          value={texto}
          onChange={e => setTexto(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviar() } }}
          placeholder="Digite uma mensagem..."
          rows={1}
          style={{
            flex: 1, borderRadius: '20px', border: 'none', padding: '10px 16px',
            fontSize: '14px', resize: 'none', outline: 'none', fontFamily: 'inherit',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)', lineHeight: '1.4'
          }}
        />
        <button
          onClick={enviar}
          disabled={!texto.trim() || enviando}
          style={{
            width: '44px', height: '44px', borderRadius: '50%', border: 'none',
            background: texto.trim() && !enviando ? '#075e54' : '#ccc',
            color: 'white', fontSize: '18px', cursor: texto.trim() && !enviando ? 'pointer' : 'default',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
          }}>
          ➤
        </button>
      </div>
    </div>
  )
}
