'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'

type Tela = 'login' | 'cadastro' | 'esqueci'

const GRADIENTES = [
  { id: 'gradient', label: '🎨 Padrão', style: { background: 'linear-gradient(135deg, #0f172a 0%, #134e4a 100%)' } },
  { id: 'azul',     label: '🔵 Azul',   style: { background: 'linear-gradient(135deg, #0f172a 0%, #1e3a8a 100%)' } },
  { id: 'roxo',     label: '🟣 Roxo',   style: { background: 'linear-gradient(135deg, #1e1b4b 0%, #4f46e5 100%)' } },
]

export default function Login() {
  const [tela, setTela] = useState<Tela>('login')
  const [fundoId, setFundoId]   = useState('foto')
  const [customUrl, setCustomUrl] = useState<string>('')
  const [bgSize, setBgSize]     = useState('cover')
  const [bgPos, setBgPos]       = useState('center')
  // ajuste manual
  const [ajuste, setAjuste]     = useState(false)   // modal aberto
  const [ajX, setAjX]           = useState(50)      // 0–100
  const [ajY, setAjY]           = useState(50)      // 0–100
  const [ajZoom, setAjZoom]     = useState(100)     // 50–300
  const [modoAj, setModoAj]     = useState(false)   // usando ajuste manual
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
    const f   = localStorage.getItem('login_fundo')      || 'foto'
    const cu  = localStorage.getItem('login_custom_url') || ''
    const bs  = localStorage.getItem('login_bg_size')    || 'cover'
    const bp  = localStorage.getItem('login_bg_pos')     || 'center'
    const ma  = localStorage.getItem('login_modo_aj')    === '1'
    const ax  = Number(localStorage.getItem('login_aj_x')    || 50)
    const ay  = Number(localStorage.getItem('login_aj_y')    || 50)
    const az  = Number(localStorage.getItem('login_aj_zoom') || 100)
    setFundoId(f); setCustomUrl(cu); setBgSize(bs); setBgPos(bp)
    setModoAj(ma); setAjX(ax); setAjY(ay); setAjZoom(az)
  }, [])

  function salvar(key: string, val: string) { localStorage.setItem(key, val) }

  function trocarFundo(id: string) { setFundoId(id); salvar('login_fundo', id) }

  function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => {
      const url = ev.target?.result as string
      setCustomUrl(url); setFundoId('custom')
      salvar('login_fundo', 'custom'); salvar('login_custom_url', url)
    }
    reader.readAsDataURL(file)
  }

  function aplicarAjuste() {
    setModoAj(true)
    salvar('login_modo_aj', '1')
    salvar('login_aj_x',    String(ajX))
    salvar('login_aj_y',    String(ajY))
    salvar('login_aj_zoom', String(ajZoom))
    setAjuste(false)
  }

  function resetarAjuste() {
    setModoAj(false); setAjX(50); setAjY(50); setAjZoom(100)
    localStorage.removeItem('login_modo_aj')
    localStorage.removeItem('login_aj_x')
    localStorage.removeItem('login_aj_y')
    localStorage.removeItem('login_aj_zoom')
    setBgSize('cover'); setBgPos('center')
    salvar('login_bg_size', 'cover'); salvar('login_bg_pos', 'center')
    setAjuste(false)
  }

  // Arrastar no preview para ajustar posição
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

  const sliderStyle: React.CSSProperties = {
    width: '100%', accentColor: '#6366f1', cursor: 'pointer', height: '4px'
  }

  return (
    <div style={{
      minHeight: '100vh', ...fundoStyle,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '20px', position: 'relative'
    }}>
      {ehFoto && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 0 }} />
      )}

      <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleUpload} />

      {/* ── Modal ajuste manual ── */}
      {ajuste && ehFoto && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 50,
          background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          <div style={{
            background: '#0f172a', borderRadius: '20px', padding: '24px', width: '340px',
            border: '1px solid rgba(255,255,255,0.12)', boxShadow: '0 24px 64px rgba(0,0,0,0.6)',
            display: 'flex', flexDirection: 'column', gap: '20px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <p style={{ color: 'white', fontWeight: '700', fontSize: '15px', margin: 0, fontFamily: 'DM Sans, sans-serif' }}>
                🎛️ Ajuste manual da foto
              </p>
              <button onClick={() => setAjuste(false)} style={{
                background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)',
                fontSize: '20px', cursor: 'pointer', lineHeight: 1
              }}>×</button>
            </div>

            {/* Preview arrastável */}
            <div>
              <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '10px', fontWeight: '700', margin: '0 0 8px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                Preview — arraste para reposicionar
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
                  border: '1px solid rgba(255,255,255,0.15)',
                  position: 'relative'
                }}
              >
                {/* Mira central */}
                <div style={{
                  position: 'absolute', left: `${ajX}%`, top: `${ajY}%`,
                  transform: 'translate(-50%,-50%)',
                  width: '16px', height: '16px', borderRadius: '50%',
                  border: '2px solid white', boxShadow: '0 0 0 1px rgba(0,0,0,0.5)',
                  pointerEvents: 'none'
                }} />
              </div>
            </div>

            {/* Zoom */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '10px', fontWeight: '700', margin: 0, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Zoom</p>
                <span style={{ color: 'white', fontSize: '11px', fontWeight: '700' }}>{ajZoom}%</span>
              </div>
              <input type="range" min={50} max={300} step={5} value={ajZoom}
                onChange={e => setAjZoom(Number(e.target.value))} style={sliderStyle} />
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px' }}>
                <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: '10px' }}>50%</span>
                <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: '10px' }}>300%</span>
              </div>
            </div>

            {/* Posição X */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '10px', fontWeight: '700', margin: 0, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Posição horizontal</p>
                <span style={{ color: 'white', fontSize: '11px', fontWeight: '700' }}>{ajX}%</span>
              </div>
              <input type="range" min={0} max={100} step={1} value={ajX}
                onChange={e => setAjX(Number(e.target.value))} style={sliderStyle} />
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px' }}>
                <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: '10px' }}>Esquerda</span>
                <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: '10px' }}>Direita</span>
              </div>
            </div>

            {/* Posição Y */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '10px', fontWeight: '700', margin: 0, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Posição vertical</p>
                <span style={{ color: 'white', fontSize: '11px', fontWeight: '700' }}>{ajY}%</span>
              </div>
              <input type="range" min={0} max={100} step={1} value={ajY}
                onChange={e => setAjY(Number(e.target.value))} style={sliderStyle} />
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px' }}>
                <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: '10px' }}>Topo</span>
                <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: '10px' }}>Base</span>
              </div>
            </div>

            {/* Botões */}
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={resetarAjuste} style={{
                flex: 1, background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '10px', padding: '10px', color: 'rgba(255,255,255,0.7)',
                fontSize: '13px', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif', fontWeight: '600'
              }}>↺ Resetar</button>
              <button onClick={aplicarAjuste} style={{
                flex: 2, background: '#4f46e5', border: 'none',
                borderRadius: '10px', padding: '10px', color: 'white',
                fontSize: '13px', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif', fontWeight: '700'
              }}>✓ Aplicar</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Painel de fundo — canto inferior direito (ativado por 5 cliques no logo) ── */}
      <div style={{ position: 'fixed', bottom: '24px', right: '24px', zIndex: 10 }}>
        {mostrarPainel && (
          <div style={{
            position: 'absolute', bottom: '8px', right: 0,
            background: 'rgba(15,23,42,0.95)', backdropFilter: 'blur(12px)',
            borderRadius: '16px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px',
            border: '1px solid rgba(255,255,255,0.12)', width: '220px',
            boxShadow: '0 8px 32px rgba(0,0,0,0.4)'
          }}>
            {/* Foto */}
            <div>
              <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '10px', fontWeight: '700', margin: '0 0 6px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Foto</p>
              <div style={{ display: 'flex', gap: '6px' }}>
                <button onClick={() => trocarFundo('foto')} style={{
                  flex: 1, background: fundoId === 'foto' ? 'rgba(79,70,229,0.6)' : 'rgba(255,255,255,0.08)',
                  border: fundoId === 'foto' ? '1px solid #6366f1' : '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '8px', padding: '7px 6px', color: 'white', fontSize: '11px',
                  cursor: 'pointer', fontFamily: 'DM Sans, sans-serif', fontWeight: '600'
                }}>🏙️ Conceição</button>
                <button onClick={() => fileRef.current?.click()} style={{
                  flex: 1, background: fundoId === 'custom' ? 'rgba(79,70,229,0.6)' : 'rgba(255,255,255,0.08)',
                  border: fundoId === 'custom' ? '1px solid #6366f1' : '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '8px', padding: '7px 6px', color: 'white', fontSize: '11px',
                  cursor: 'pointer', fontFamily: 'DM Sans, sans-serif', fontWeight: '600'
                }}>📤 Upload</button>
              </div>
            </div>

            {/* Gradiente */}
            <div>
              <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '10px', fontWeight: '700', margin: '0 0 6px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Gradiente</p>
              <div style={{ display: 'flex', gap: '6px' }}>
                {GRADIENTES.map(g => (
                  <button key={g.id} onClick={() => trocarFundo(g.id)} style={{
                    flex: 1, ...g.style,
                    border: fundoId === g.id ? '2px solid white' : '2px solid transparent',
                    borderRadius: '8px', padding: '6px 4px', color: 'white', fontSize: '11px',
                    cursor: 'pointer', fontFamily: 'DM Sans, sans-serif', fontWeight: '700'
                  }}>{g.label.split(' ')[0]}</button>
                ))}
              </div>
            </div>

            {/* Ajuste manual (só quando foto) */}
            {ehFoto && (
              <button onClick={() => { setMostrarPainel(false); setAjuste(true) }} style={{
                background: modoAj ? 'rgba(79,70,229,0.4)' : 'rgba(255,255,255,0.06)',
                border: modoAj ? '1px solid #6366f1' : '1px solid rgba(255,255,255,0.1)',
                borderRadius: '8px', padding: '9px 12px', color: 'white', fontSize: '12px',
                cursor: 'pointer', fontFamily: 'DM Sans, sans-serif', fontWeight: '600',
                textAlign: 'left', display: 'flex', alignItems: 'center', gap: '8px'
              }}>
                <span>🎛️</span>
                <span>Ajuste manual{modoAj ? ' ✓' : ''}</span>
              </button>
            )}
          </div>
        )}
      </div>

      <div className="login-card" style={{ position: 'relative', zIndex: 1 }}>
        {/* Logo / Header — 5 cliques rápidos abre o painel de personalização */}
        <div style={{ textAlign: 'center', marginBottom: '20px' }}>
          <img src="/logo.jpg" alt="SMS Conceição" onClick={clicarLogo}
            style={{ width: '64px', height: '64px', objectFit: 'contain', margin: '0 auto 12px', display: 'block', cursor: 'default' }} />
          <h1 style={{ fontFamily: 'Sora, sans-serif', fontSize: '18px', fontWeight: '700', color: '#0f172a', margin: '0 0 2px' }}>
            SMS Conceição
          </h1>
          <p style={{ color: '#64748b', fontSize: '12px', margin: 0 }}>Secretaria Municipal de Saúde</p>
        </div>

        {tela === 'login'   && <FormLogin    irPara={setTela} router={router} />}
        {tela === 'cadastro' && <FormCadastro  irPara={setTela} />}
        {tela === 'esqueci'  && <FormEsqueci   irPara={setTela} />}
      </div>
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
    <form onSubmit={fazerLogin} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
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
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#0d9488', fontSize: '13px', fontFamily: 'DM Sans, sans-serif', padding: 0 }}>
          Criar conta
        </button>
        <button type="button" onClick={() => irPara('esqueci')}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', fontSize: '13px', fontFamily: 'DM Sans, sans-serif', padding: 0 }}>
          Esqueci minha senha
        </button>
      </div>
    </form>
  )
}

/* ─── CADASTRO ───────────────────────────────────────────────────── */
function FormCadastro({ irPara }: { irPara: (t: Tela) => void }) {
  const [form, setForm] = useState({ nome: '', cpf: '', senha: '', confirmar: '' })
  const [erro, setErro] = useState('')
  const [sucesso, setSucesso] = useState(false)
  const [salvando, setSalvando] = useState(false)

  function mascaraCPF(v: string) {
    const d = v.replace(/\D/g, '').slice(0, 11)
    return d.replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d{1,2})$/, '$1-$2')
  }

  async function cadastrar(e: React.FormEvent) {
    e.preventDefault()
    setErro('')
    if (form.senha !== form.confirmar) { setErro('As senhas não coincidem.'); return }
    if (form.senha.length < 6) { setErro('A senha deve ter pelo menos 6 caracteres.'); return }
    setSalvando(true)
    try {
      const res = await fetch('/api/auth/cadastro', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nome: form.nome.trim().toUpperCase(), cpf: form.cpf.replace(/\D/g, ''), senha: form.senha })
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
    <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={{ fontSize: '40px' }}>✅</div>
      <p style={{ fontFamily: 'Sora, sans-serif', fontWeight: '700', color: '#0f172a', margin: 0 }}>Cadastro realizado!</p>
      <p style={{ color: '#64748b', fontSize: '13px', fontFamily: 'DM Sans, sans-serif', margin: 0 }}>
        Sua conta foi criada e está aguardando aprovação do administrador. Após a liberação, você poderá fazer login.
      </p>
      <button className="btn-primary" onClick={() => irPara('login')} style={{ padding: '12px', fontSize: '14px' }}>
        IR PARA O LOGIN
      </button>
    </div>
  )

  return (
    <form onSubmit={cadastrar} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      <p style={{ fontFamily: 'Sora, sans-serif', fontWeight: '700', fontSize: '15px', color: '#0f172a', margin: 0 }}>Criar conta</p>
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
        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', fontSize: '13px', fontFamily: 'DM Sans, sans-serif', textAlign: 'center' }}>
        ← Voltar ao login
      </button>
    </form>
  )
}

/* ─── ESQUECI A SENHA ────────────────────────────────────────────── */
function FormEsqueci({ irPara }: { irPara: (t: Tela) => void }) {
  const [form, setForm] = useState({ cpf: '', novaSenha: '', confirmar: '' })
  const [erro, setErro] = useState('')
  const [sucesso, setSucesso] = useState(false)
  const [salvando, setSalvando] = useState(false)

  function mascaraCPF(v: string) {
    const d = v.replace(/\D/g, '').slice(0, 11)
    return d.replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d{1,2})$/, '$1-$2')
  }

  async function redefinir(e: React.FormEvent) {
    e.preventDefault()
    setErro('')
    if (form.novaSenha !== form.confirmar) { setErro('As senhas não coincidem.'); return }
    if (form.novaSenha.length < 6) { setErro('A senha deve ter pelo menos 6 caracteres.'); return }
    setSalvando(true)
    try {
      const res = await fetch('/api/auth/redefinir-senha', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cpf: form.cpf.replace(/\D/g, ''), novaSenha: form.novaSenha })
      })
      const data = await res.json()
      if (!data?.ok) { setErro(data.error || 'CPF não encontrado no sistema.'); setSalvando(false); return }
      setSucesso(true)
    } catch {
      setErro('Erro de conexão. Tente novamente.')
    }
    setSalvando(false)
  }

  if (sucesso) return (
    <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={{ fontSize: '40px' }}>🔒</div>
      <p style={{ fontFamily: 'Sora, sans-serif', fontWeight: '700', color: '#0f172a', margin: 0 }}>Senha redefinida!</p>
      <p style={{ color: '#64748b', fontSize: '13px', fontFamily: 'DM Sans, sans-serif', margin: 0 }}>
        Sua senha foi atualizada. Faça login com a nova senha.
      </p>
      <button className="btn-primary" onClick={() => irPara('login')} style={{ padding: '12px', fontSize: '14px' }}>
        IR PARA O LOGIN
      </button>
    </div>
  )

  return (
    <form onSubmit={redefinir} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      <p style={{ fontFamily: 'Sora, sans-serif', fontWeight: '700', fontSize: '15px', color: '#0f172a', margin: 0 }}>Redefinir senha</p>
      <p style={{ color: '#64748b', fontSize: '12px', fontFamily: 'DM Sans, sans-serif', margin: 0 }}>
        Informe seu CPF e escolha uma nova senha.
      </p>
      <div>
        <label className="label-modern">CPF</label>
        <input className="input-modern" value={form.cpf} inputMode="numeric" required
          onChange={e => setForm(f => ({ ...f, cpf: mascaraCPF(e.target.value) }))}
          placeholder="000.000.000-00" />
      </div>
      <div>
        <label className="label-modern">Nova senha</label>
        <input className="input-modern" type="password" value={form.novaSenha} required
          onChange={e => setForm(f => ({ ...f, novaSenha: e.target.value }))}
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
        {salvando ? 'Redefinindo...' : 'REDEFINIR SENHA'}
      </button>
      <button type="button" onClick={() => irPara('login')}
        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', fontSize: '13px', fontFamily: 'DM Sans, sans-serif', textAlign: 'center' }}>
        ← Voltar ao login
      </button>
    </form>
  )
}
