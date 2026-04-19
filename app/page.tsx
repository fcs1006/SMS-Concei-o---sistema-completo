'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'

type Tela = 'login' | 'cadastro' | 'esqueci'

const GRADIENTES = [
  { id: 'gradient', label: '🎨 Azul', style: { background: 'linear-gradient(135deg, #0f172a 0%, #1e3a8a 100%)' } },
  { id: 'cyan',     label: '🔵 Cyan',   style: { background: 'linear-gradient(135deg, #0f172a 0%, #0891b2 100%)' } },
  { id: 'roxo',     label: '🟣 Roxo',   style: { background: 'linear-gradient(135deg, #1e1b4b 0%, #6366f1 100%)' } },
]

export default function Login() {
  const [tela, setTela] = useState<Tela>('login')
  const [fundoId, setFundoId]   = useState('foto')
  const [customUrl, setCustomUrl] = useState<string>('')
  const [bgSize, setBgSize]     = useState('cover')
  const [bgPos, setBgPos]       = useState('center')
  const [ajuste, setAjuste]     = useState(false)
  const [ajX, setAjX]           = useState(50)
  const [ajY, setAjY]           = useState(50)
  const [ajZoom, setAjZoom]     = useState(100)
  const [modoAj, setModoAj]     = useState(false)
  const [mostrarPainel, setMostrarPainel] = useState(false)
  const fileRef      = useRef<HTMLInputElement>(null)
  const prevRef      = useRef<HTMLDivElement>(null)
  const dragging     = useRef(false)
  const cliquesLogo  = useRef(0)
  const timerLogo    = useRef<ReturnType<typeof setTimeout> | null>(null)
  const router       = useRouter()

  function clicarLogo() {
    cliquesLogo.current += 1
    if (timerLogo.current) clearTimeout(timerLogo.current)
    if (cliquesLogo.current >= 5) {
      cliquesLogo.current = 0
      setMostrarPainel(v => !v)
    } else {
      timerLogo.current = setTimeout(() => { cliquesLogo.current = 0 }, 2000)
    }
  }

  useEffect(() => {
    fetch('/api/config/fundo')
      .then(r => r.json())
      .then(({ cfg }) => {
        if (!cfg) return
        if (cfg.login_fundo_id)     setFundoId(cfg.login_fundo_id)
        if (cfg.login_fundo_bgSize) setBgSize(cfg.login_fundo_bgSize)
        if (cfg.login_fundo_bgPos)  setBgPos(cfg.login_fundo_bgPos)
        if (cfg.login_fundo_ajX)    setAjX(Number(cfg.login_fundo_ajX))
        if (cfg.login_fundo_ajY)    setAjY(Number(cfg.login_fundo_ajY))
        if (cfg.login_fundo_zoom)   setAjZoom(Number(cfg.login_fundo_zoom))
        if (cfg.login_fundo_modoAj) setModoAj(cfg.login_fundo_modoAj === '1')
        if (cfg.login_fundo_url)    setCustomUrl(cfg.login_fundo_url)
      })
      .catch(() => {})
  }, [])

  function salvarNoBanco(campos: Record<string, string>) {
    fetch('/api/config/fundo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(campos)
    }).catch(() => {})
  }

  function trocarFundo(id: string) {
    setFundoId(id)
    salvarNoBanco({ login_fundo_id: id })
  }

  function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => {
      const url = ev.target?.result as string
      setCustomUrl(url); setFundoId('custom')
      salvarNoBanco({ login_fundo_id: 'custom', login_fundo_url: url })
    }
    reader.readAsDataURL(file)
  }

  function aplicarAjuste() {
    setModoAj(true)
    salvarNoBanco({ login_fundo_ajX: String(ajX), login_fundo_ajY: String(ajY), login_fundo_zoom: String(ajZoom), login_fundo_modoAj: '1' })
    setAjuste(false)
  }

  function resetarAjuste() {
    setModoAj(false); setAjX(50); setAjY(50); setAjZoom(100)
    setBgSize('cover'); setBgPos('center')
    salvarNoBanco({ login_fundo_bgSize: 'cover', login_fundo_bgPos: 'center', login_fundo_ajX: '50', login_fundo_ajY: '50', login_fundo_zoom: '100', login_fundo_modoAj: '0' })
    setAjuste(false)
  }

  const onPrevMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    dragging.current = true
    e.preventDefault()
  }, [])
  const onPrevMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!dragging.current || !prevRef.current) return
    const rect = prevRef.current.getBoundingClientRect()
    const x = Math.round(Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width)  * 100)))
    const y = Math.round(Math.max(0, Math.min(100, ((e.clientY - rect.top)  / rect.height) * 100)))
    setAjX(x); setAjY(y)
  }, [])
  const onPrevMouseUp = useCallback(() => { dragging.current = false }, [])

  const ehFoto = fundoId === 'foto' || fundoId === 'custom'
  const fotoUrl = fundoId === 'custom' ? customUrl : '/conceicao-bg.jpg'
  const gradiente = GRADIENTES.find(g => g.id === fundoId)

  const fundoStyle: React.CSSProperties = ehFoto
    ? modoAj
      ? { backgroundImage: `url(${fotoUrl})`, backgroundSize: `${ajZoom}%`, backgroundPosition: `${ajX}% ${ajY}%`, backgroundRepeat: 'no-repeat' }
      : { backgroundImage: `url(${fotoUrl})`, backgroundSize: bgSize, backgroundPosition: bgPos, backgroundRepeat: 'no-repeat' }
    : (gradiente?.style ?? GRADIENTES[0].style)

  return (
    <div style={{
      minHeight: '100vh', ...fundoStyle,
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: '20px', position: 'relative'
    }}>
      {ehFoto && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 0, backdropFilter: 'blur(2px)' }} />
      )}

      <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleUpload} />

      {/* Modal ajuste manual */}
      <AnimatePresence>
        {ajuste && ehFoto && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position: 'fixed', inset: 0, zIndex: 50,
              background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              style={{
                background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
                borderRadius: '20px', padding: '24px', width: '340px',
                border: '1px solid rgba(6,182,212,0.2)', backdropFilter: 'blur(12px)',
                boxShadow: '0 24px 64px rgba(0,0,0,0.6)',
                display: 'flex', flexDirection: 'column', gap: '20px'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <p style={{ color: '#f1f5f9', fontWeight: '700', fontSize: '15px', margin: 0, fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
                  🎛️ Ajuste manual
                </p>
                <button onClick={() => setAjuste(false)} style={{
                  background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)',
                  fontSize: '20px', cursor: 'pointer', lineHeight: 1
                }}>×</button>
              </div>

              <div>
                <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '10px', fontWeight: '700', margin: '0 0 8px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  Preview
                </p>
                <div
                  ref={prevRef}
                  onMouseDown={onPrevMouseDown}
                  onMouseMove={onPrevMouseMove}
                  onMouseUp={onPrevMouseUp}
                  onMouseLeave={onPrevMouseUp}
                  style={{
                    width: '100%', height: '160px', borderRadius: '10px',
                    backgroundImage: `url(${fotoUrl})`,
                    backgroundSize: `${ajZoom}%`,
                    backgroundPosition: `${ajX}% ${ajY}%`,
                    backgroundRepeat: 'no-repeat',
                    cursor: 'grab', userSelect: 'none',
                    border: '1px solid rgba(6,182,212,0.2)',
                    position: 'relative'
                  }}
                >
                  <div style={{
                    position: 'absolute', left: `${ajX}%`, top: `${ajY}%`,
                    transform: 'translate(-50%,-50%)',
                    width: '16px', height: '16px', borderRadius: '50%',
                    border: '2px solid #06b6d4', boxShadow: '0 0 0 1px rgba(0,0,0,0.5)',
                    pointerEvents: 'none'
                  }} />
                </div>
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '10px', fontWeight: '700', margin: 0, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Zoom</p>
                  <span style={{ color: '#06b6d4', fontSize: '11px', fontWeight: '700' }}>{ajZoom}%</span>
                </div>
                <input type="range" min={50} max={300} step={5} value={ajZoom}
                  onChange={e => setAjZoom(Number(e.target.value))} style={{
                    width: '100%', accentColor: '#06b6d4', cursor: 'pointer', height: '4px'
                  }} />
              </div>

              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={resetarAjuste} style={{
                  flex: 1, background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '10px', padding: '10px', color: 'rgba(255,255,255,0.7)',
                  fontSize: '13px', cursor: 'pointer', fontFamily: 'Inter, sans-serif', fontWeight: '600'
                }}>↺ Resetar</button>
                <button onClick={aplicarAjuste} style={{
                  flex: 2, background: 'linear-gradient(135deg, #2563eb, #06b6d4)', border: 'none',
                  borderRadius: '10px', padding: '10px', color: 'white',
                  fontSize: '13px', cursor: 'pointer', fontFamily: 'Plus Jakarta Sans, sans-serif', fontWeight: '700'
                }}>✓ Aplicar</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Painel flutuante */}
      <motion.div style={{ position: 'fixed', bottom: '24px', right: '24px', zIndex: 10 }}>
        <AnimatePresence>
          {mostrarPainel && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 10 }}
              transition={{ type: 'spring', damping: 20, stiffness: 300 }}
              style={{
                position: 'absolute', bottom: '8px', right: 0,
                background: 'rgba(15,23,42,0.9)', backdropFilter: 'blur(12px)',
                borderRadius: '16px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px',
                border: '1px solid rgba(6,182,212,0.2)', width: '220px',
                boxShadow: '0 8px 32px rgba(0,0,0,0.4)'
              }}
            >
              <div>
                <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '10px', fontWeight: '700', margin: '0 0 6px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Foto</p>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button onClick={() => trocarFundo('foto')} style={{
                    flex: 1, background: fundoId === 'foto' ? 'rgba(6,182,212,0.4)' : 'rgba(255,255,255,0.08)',
                    border: fundoId === 'foto' ? '1px solid #06b6d4' : '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '8px', padding: '7px 6px', color: 'white', fontSize: '11px',
                    cursor: 'pointer', fontFamily: 'Inter, sans-serif', fontWeight: '600'
                  }}>🏙️ Padrão</button>
                  <button onClick={() => fileRef.current?.click()} style={{
                    flex: 1, background: fundoId === 'custom' ? 'rgba(6,182,212,0.4)' : 'rgba(255,255,255,0.08)',
                    border: fundoId === 'custom' ? '1px solid #06b6d4' : '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '8px', padding: '7px 6px', color: 'white', fontSize: '11px',
                    cursor: 'pointer', fontFamily: 'Inter, sans-serif', fontWeight: '600'
                  }}>📤 Upload</button>
                </div>
              </div>

              <div>
                <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '10px', fontWeight: '700', margin: '0 0 6px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Gradiente</p>
                <div style={{ display: 'flex', gap: '6px' }}>
                  {GRADIENTES.map(g => (
                    <button key={g.id} onClick={() => trocarFundo(g.id)} style={{
                      flex: 1, ...g.style,
                      border: fundoId === g.id ? '2px solid #06b6d4' : '2px solid transparent',
                      borderRadius: '8px', padding: '6px 4px', color: 'white', fontSize: '11px',
                      cursor: 'pointer', fontFamily: 'Plus Jakarta Sans, sans-serif', fontWeight: '700'
                    }}>{g.label.split(' ')[0]}</button>
                  ))}
                </div>
              </div>

              {ehFoto && (
                <button onClick={() => { setMostrarPainel(false); setAjuste(true) }} style={{
                  background: modoAj ? 'rgba(6,182,212,0.4)' : 'rgba(255,255,255,0.06)',
                  border: modoAj ? '1px solid #06b6d4' : '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '8px', padding: '9px 12px', color: 'white', fontSize: '12px',
                  cursor: 'pointer', fontFamily: 'Inter, sans-serif', fontWeight: '600',
                  textAlign: 'left', display: 'flex', alignItems: 'center', gap: '8px'
                }}>
                  <span>🎛️</span>
                  <span>Ajuste{modoAj ? ' ✓' : ''}</span>
                </button>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, duration: 0.5 }}
        className="login-card"
        style={{ position: 'relative', zIndex: 1 }}
      >
        <div style={{ textAlign: 'center', marginBottom: '20px' }} onClick={clicarLogo}>
          <h1 style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: '18px', fontWeight: '700', color: '#f1f5f9', margin: '0 0 2px' }}>
            SMS Conceição
          </h1>
          <p style={{ color: '#cbd5e1', fontSize: '12px', margin: 0 }}>Secretaria Municipal de Saúde</p>
        </div>

        <AnimatePresence mode="wait">
          {tela === 'login'   && <FormLogin    key="login" irPara={setTela} router={router} />}
          {tela === 'cadastro' && <FormCadastro key="cadastro" irPara={setTela} />}
          {tela === 'esqueci'  && <FormEsqueci  key="esqueci" irPara={setTela} />}
        </AnimatePresence>
      </motion.div>

      <p style={{
        position: 'relative', zIndex: 1,
        marginTop: '24px', color: 'rgba(255,255,255,0.45)',
        fontSize: '12px', fontFamily: 'Inter, sans-serif', textAlign: 'center'
      }}>
        © 2026 GestSus — Todos os direitos reservados
      </p>
    </div>
  )
}

/* ─── LOGIN ─────────────────────────────────────────────────────── */
function FormLogin({ irPara, router }: { irPara: (t: Tela) => void; router: any }) {
  const [usuario, setUsuario] = useState('')
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState('')
  const [carregando, setCarregando] = useState(false)

  async function fazerLogin(e: React.FormEvent) {
    e.preventDefault()
    setCarregando(true)
    setErro('')
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ usuario: usuario.replace(/\D/g, ''), senha: senha.trim() })
      })
      const data = await res.json()
      if (!data?.ok) { setErro('Usuário ou senha incorretos.'); setCarregando(false); return }
      localStorage.setItem('sms_user', JSON.stringify(data))
      router.push('/painel')
    } catch {
      setErro('Erro de conexão. Tente novamente.')
      setCarregando(false)
    }
  }

  return (
    <motion.form
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onSubmit={fazerLogin}
      style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}
    >
      <div>
        <label className="label-modern">Usuário (CPF)</label>
        <input
          className="input-modern" type="text" value={usuario}
          onChange={e => {
            const d = e.target.value.replace(/\D/g, '').slice(0, 11)
            setUsuario(d.replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d{1,2})$/, '$1-$2'))
          }}
          placeholder="000.000.000-00" inputMode="numeric" required
        />
      </div>
      <div>
        <label className="label-modern">Senha</label>
        <input className="input-modern" type="password" value={senha}
          onChange={e => setSenha(e.target.value)} placeholder="••••••••" required />
      </div>
      {erro && <div className="status-err" style={{ textAlign: 'center' }}>{erro}</div>}
      <button type="submit" disabled={carregando} className="btn-primary"
        style={{ width: '100%', padding: '13px', fontSize: '14px', marginTop: '4px' }}>
        {carregando ? 'Entrando...' : 'ENTRAR'}
      </button>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px' }}>
        <button type="button" onClick={() => irPara('cadastro')}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#06b6d4', fontSize: '13px', fontFamily: 'Inter, sans-serif', padding: 0 }}>
          Criar conta
        </button>
        <button type="button" onClick={() => irPara('esqueci')}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#cbd5e1', fontSize: '13px', fontFamily: 'Inter, sans-serif', padding: 0 }}>
          Esqueci minha senha
        </button>
      </div>
    </motion.form>
  )
}

/* ─── CADASTRO ───────────────────────────────────────────────────── */
function FormCadastro({ irPara }: { irPara: (t: Tela) => void }) {
  const [form, setForm] = useState({ nome: '', cpf: '', telefone: '', email: '', senha: '', confirmar: '' })
  const [erro, setErro] = useState('')
  const [sucesso, setSucesso] = useState(false)
  const [salvando, setSalvando] = useState(false)

  function mascaraCPF(v: string) {
    const d = v.replace(/\D/g, '').slice(0, 11)
    return d.replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d{1,2})$/, '$1-$2')
  }

  function mascaraTel(v: string) {
    const d = v.replace(/\D/g, '').slice(0, 11)
    if (d.length <= 10) return d.replace(/(\d{2})(\d{4})(\d{0,4})/, '($1) $2-$3').trim().replace(/-$/, '')
    return d.replace(/(\d{2})(\d{5})(\d{0,4})/, '($1) $2-$3').trim().replace(/-$/, '')
  }

  async function cadastrar(e: React.FormEvent) {
    e.preventDefault()
    setErro('')
    if (form.senha !== form.confirmar) { setErro('As senhas não coincidem.'); return }
    if (form.senha.length < 6) { setErro('A senha deve ter pelo menos 6 caracteres.'); return }
    if (!form.email.includes('@')) { setErro('E-mail inválido.'); return }
    setSalvando(true)
    try {
      const res = await fetch('/api/auth/cadastro', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nome: form.nome.trim().replace(/\b\w/g, c => c.toUpperCase()),
          cpf: form.cpf.replace(/\D/g, ''),
          telefone: form.telefone,
          email: form.email.trim().toLowerCase(),
          senha: form.senha
        })
      })
      const data = await res.json()
      if (!data?.ok) { setErro(data.error || 'Erro ao cadastrar.'); setSalvando(false); return }
      setSucesso(true)
    } catch {
      setErro('Erro de conexão. Tente novamente.')
    }
    setSalvando(false)
  }

  if (sucesso) return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '16px' }}
    >
      <div style={{ fontSize: '40px' }}>✅</div>
      <p style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontWeight: '700', color: '#f1f5f9', margin: 0 }}>Cadastro realizado!</p>
      <p style={{ color: '#cbd5e1', fontSize: '13px', fontFamily: 'Inter, sans-serif', margin: 0 }}>
        Sua conta foi criada e está aguardando aprovação do administrador.
      </p>
      <button className="btn-primary" onClick={() => irPara('login')} style={{ padding: '12px', fontSize: '14px' }}>
        IR PARA O LOGIN
      </button>
    </motion.div>
  )

  return (
    <motion.form
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onSubmit={cadastrar}
      style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}
    >
      <p style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontWeight: '700', fontSize: '15px', color: '#f1f5f9', margin: 0 }}>Criar conta</p>
      <div>
        <label className="label-modern">Nome completo</label>
        <input className="input-modern" value={form.nome} required
          onChange={e => setForm(f => ({ ...f, nome: e.target.value }))}
          placeholder="Seu nome completo" />
      </div>
      <div>
        <label className="label-modern">CPF (será seu usuário)</label>
        <input className="input-modern" value={form.cpf} inputMode="numeric" required
          onChange={e => setForm(f => ({ ...f, cpf: mascaraCPF(e.target.value) }))}
          placeholder="000.000.000-00" />
      </div>
      <div>
        <label className="label-modern">Telefone</label>
        <input className="input-modern" value={form.telefone} inputMode="numeric" required
          onChange={e => setForm(f => ({ ...f, telefone: mascaraTel(e.target.value) }))}
          placeholder="(00) 00000-0000" />
      </div>
      <div>
        <label className="label-modern">E-mail</label>
        <input className="input-modern" type="email" value={form.email} required
          onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
          placeholder="seu@email.com" />
      </div>
      <div>
        <label className="label-modern">Senha</label>
        <input className="input-modern" type="password" value={form.senha} required
          onChange={e => setForm(f => ({ ...f, senha: e.target.value }))}
          placeholder="Mínimo 6 caracteres" />
      </div>
      <div>
        <label className="label-modern">Confirmar senha</label>
        <input className="input-modern" type="password" value={form.confirmar} required
          onChange={e => setForm(f => ({ ...f, confirmar: e.target.value }))}
          placeholder="Repita a senha" />
      </div>
      {erro && <div className="status-err" style={{ textAlign: 'center' }}>{erro}</div>}
      <button type="submit" disabled={salvando} className="btn-primary" style={{ padding: '12px', fontSize: '14px' }}>
        {salvando ? 'Cadastrando...' : 'CADASTRAR'}
      </button>
      <button type="button" onClick={() => irPara('login')}
        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#cbd5e1', fontSize: '13px', fontFamily: 'Inter, sans-serif', textAlign: 'center' }}>
        ← Voltar ao login
      </button>
    </motion.form>
  )
}

/* ─── ESQUECI A SENHA ────────────────────────────────────────────── */
function FormEsqueci({ irPara }: { irPara: (t: Tela) => void }) {
  const [form, setForm] = useState({ cpf: '', contato: '', senha: '', confirmar: '' })
  const [erro, setErro] = useState('')
  const [sucesso, setSucesso] = useState(false)
  const [salvando, setSalvando] = useState(false)

  function mascaraCPF(v: string) {
    const d = v.replace(/\D/g, '').slice(0, 11)
    return d.replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d{1,2})$/, '$1-$2')
  }

  async function recuperar(e: React.FormEvent) {
    e.preventDefault()
    setErro('')
    if (form.senha !== form.confirmar) { setErro('As senhas não coincidem.'); return }
    if (form.senha.length < 6) { setErro('Mínimo 6 caracteres.'); return }
    setSalvando(true)
    try {
      const res = await fetch('/api/auth/recuperar-senha', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cpf: form.cpf.replace(/\D/g, ''),
          contato: form.contato.trim(),
          novaSenha: form.senha
        })
      })
      const data = await res.json()
      if (!data?.ok) { setErro(data.error || 'Erro ao recuperar.'); setSalvando(false); return }
      setSucesso(true)
    } catch {
      setErro('Erro de conexão. Tente novamente.')
    }
    setSalvando(false)
  }

  if (sucesso) return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={{ fontSize: '40px' }}>✅</div>
      <p style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontWeight: '700', color: '#f1f5f9', margin: 0 }}>Senha redefinida!</p>
      <p style={{ color: '#cbd5e1', fontSize: '13px', fontFamily: 'Inter, sans-serif', margin: 0 }}>
        Sua senha foi atualizada com sucesso.
      </p>
      <button className="btn-primary" onClick={() => irPara('login')} style={{ padding: '12px', fontSize: '14px' }}>
        IR PARA O LOGIN
      </button>
    </motion.div>
  )

  return (
    <motion.form
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onSubmit={recuperar}
      style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}
    >
      <p style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontWeight: '700', fontSize: '15px', color: '#f1f5f9', margin: 0 }}>
        Recuperar senha
      </p>
      <div>
        <label className="label-modern">CPF (seu usuário)</label>
        <input className="input-modern" value={form.cpf} inputMode="numeric" required
          onChange={e => setForm(f => ({ ...f, cpf: mascaraCPF(e.target.value) }))}
          placeholder="000.000.000-00" />
      </div>
      <div>
        <label className="label-modern">Telefone ou e-mail cadastrado</label>
        <input className="input-modern" value={form.contato} required
          onChange={e => setForm(f => ({ ...f, contato: e.target.value }))}
          placeholder="(00) 00000-0000 ou email@..." />
      </div>
      <div>
        <label className="label-modern">Nova senha</label>
        <input className="input-modern" type="password" value={form.senha} required
          onChange={e => setForm(f => ({ ...f, senha: e.target.value }))}
          placeholder="Mínimo 6 caracteres" />
      </div>
      <div>
        <label className="label-modern">Confirmar nova senha</label>
        <input className="input-modern" type="password" value={form.confirmar} required
          onChange={e => setForm(f => ({ ...f, confirmar: e.target.value }))}
          placeholder="Repita a senha" />
      </div>
      {erro && <div className="status-err" style={{ textAlign: 'center' }}>{erro}</div>}
      <button type="submit" disabled={salvando} className="btn-primary" style={{ padding: '12px', fontSize: '14px' }}>
        {salvando ? 'Verificando...' : 'REDEFINIR SENHA'}
      </button>
      <button type="button" onClick={() => irPara('login')}
        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#cbd5e1', fontSize: '13px', fontFamily: 'Inter, sans-serif', textAlign: 'center' }}>
        ← Voltar ao login
      </button>
    </motion.form>
  )
}
