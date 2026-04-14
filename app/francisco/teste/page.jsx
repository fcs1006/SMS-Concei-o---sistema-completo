'use client'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'

const TELEFONE_TESTE = '5500000000000'

export default function FranciscoTeste() {
  const router = useRouter()
  const [mensagens, setMensagens] = useState([])
  const [texto, setTexto] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [limpar, setLimpar] = useState(false)
  const msgEndRef = useRef(null)

  useEffect(() => {
    const u = JSON.parse(localStorage.getItem('sms_user') || 'null')
    if (!u || u.perfil !== 'admin') { router.push('/'); return }
  }, [])

  useEffect(() => {
    msgEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [mensagens])

  async function enviar() {
    if (!texto.trim() || enviando) return
    const msg = texto.trim()
    setTexto('')
    setMensagens(prev => [...prev, { papel: 'user', mensagem: msg, hora: new Date() }])
    setEnviando(true)

    try {
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

      // Busca a última resposta do Francisco no banco
      await new Promise(r => setTimeout(r, 800))
      const res2 = await fetch(`/api/whatsapp/teste?telefone=${TELEFONE_TESTE}`)
      const json2 = await res2.json()
      if (json2.ok && json2.ultima) {
        setMensagens(prev => [...prev, { papel: json2.ultima.papel, mensagem: json2.ultima.mensagem, hora: new Date(json2.ultima.criado_em) }])
      } else if (!json.ok) {
        setMensagens(prev => [...prev, { papel: 'erro', mensagem: `Erro: ${json.error}`, hora: new Date() }])
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
          <p style={{ margin: 0, color: 'white', fontWeight: '700', fontSize: '15px' }}>Francisco</p>
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
            <p>Envie uma mensagem para testar o Francisco</p>
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

        {mensagens.map((m, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: m.papel === 'user' ? 'flex-end' : m.papel === 'erro' ? 'center' : 'flex-start' }}>
            {m.papel === 'erro' ? (
              <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: '8px', padding: '8px 14px', fontSize: '12px', color: '#dc2626' }}>
                {m.mensagem}
              </div>
            ) : (
              <div style={{
                maxWidth: '75%', padding: '8px 12px',
                borderRadius: m.papel === 'user' ? '12px 12px 4px 12px' : '12px 12px 12px 4px',
                background: m.papel === 'user' ? '#dcf8c6' : 'white',
                boxShadow: '0 1px 2px rgba(0,0,0,0.1)'
              }}>
                <p style={{ margin: '0 0 4px', fontSize: '13px', color: '#111', whiteSpace: 'pre-wrap', lineHeight: '1.5' }}>{m.mensagem}</p>
                <p style={{ margin: 0, fontSize: '10px', color: '#999', textAlign: 'right' }}>{hora(m.hora)}</p>
              </div>
            )}
          </div>
        ))}

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
