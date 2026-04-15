'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

type Tela = 'login' | 'cadastro' | 'esqueci'

const FUNDOS = [
  { id: 'foto',      label: '🏙️ Foto',      style: { backgroundImage: 'url(/conceicao-bg.jpg)', backgroundSize: 'cover', backgroundPosition: 'center' } },
  { id: 'gradient',  label: '🎨 Padrão',    style: { background: 'linear-gradient(135deg, #0f172a 0%, #134e4a 100%)' } },
  { id: 'azul',      label: '🔵 Azul',      style: { background: 'linear-gradient(135deg, #0f172a 0%, #1e3a8a 100%)' } },
  { id: 'roxo',      label: '🟣 Roxo',      style: { background: 'linear-gradient(135deg, #1e1b4b 0%, #4f46e5 100%)' } },
]

export default function Login() {
  const [tela, setTela] = useState<Tela>('login')
  const [fundoId, setFundoId] = useState('foto')
  const [mostrarFundos, setMostrarFundos] = useState(false)
  const router = useRouter()

  useEffect(() => {
    const salvo = localStorage.getItem('login_fundo')
    if (salvo) setFundoId(salvo)
  }, [])

  function trocarFundo(id: string) {
    setFundoId(id)
    localStorage.setItem('login_fundo', id)
    setMostrarFundos(false)
  }

  const fundo = FUNDOS.find(f => f.id === fundoId) || FUNDOS[0]

  return (
    <div style={{
      minHeight: '100vh',
      ...fundo.style,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '20px', position: 'relative'
    }}>
      {/* Overlay escuro quando foto */}
      {fundoId === 'foto' && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 0 }} />
      )}

      {/* Ícone trocar fundo — canto inferior esquerdo */}
      <div style={{ position: 'fixed', bottom: '24px', left: '24px', zIndex: 10 }}>
        {mostrarFundos && (
          <div style={{
            position: 'absolute', bottom: '52px', left: 0,
            background: 'rgba(15,23,42,0.92)', backdropFilter: 'blur(8px)',
            borderRadius: '12px', padding: '8px', display: 'flex', flexDirection: 'column', gap: '4px',
            border: '1px solid rgba(255,255,255,0.1)', minWidth: '140px'
          }}>
            {FUNDOS.map(f => (
              <button key={f.id} onClick={() => trocarFundo(f.id)} style={{
                background: fundoId === f.id ? 'rgba(255,255,255,0.15)' : 'none',
                border: 'none', borderRadius: '8px', padding: '8px 12px',
                color: 'white', fontSize: '13px', fontWeight: fundoId === f.id ? '700' : '400',
                cursor: 'pointer', textAlign: 'left', fontFamily: 'DM Sans, sans-serif'
              }}>
                {f.label} {fundoId === f.id ? '✓' : ''}
              </button>
            ))}
          </div>
        )}
        <button
          onClick={() => setMostrarFundos(v => !v)}
          title="Trocar fundo"
          style={{
            width: '40px', height: '40px', borderRadius: '50%',
            background: 'rgba(15,23,42,0.7)', backdropFilter: 'blur(8px)',
            border: '1px solid rgba(255,255,255,0.2)',
            cursor: 'pointer', fontSize: '18px', display: 'flex',
            alignItems: 'center', justifyContent: 'center',
            transition: 'all 0.2s'
          }}>
          🖼️
        </button>
      </div>
      <div className="login-card" style={{ position: 'relative', zIndex: 1 }}>
        {/* Logo / Header */}
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <img src="/logo.jpg" alt="SMS Conceição"
            style={{ width: '80px', height: '80px', objectFit: 'contain', margin: '0 auto 16px', display: 'block' }} />
          <h1 style={{ fontFamily: 'Sora, sans-serif', fontSize: '20px', fontWeight: '700', color: '#0f172a', margin: '0 0 4px' }}>
            SMS Conceição
          </h1>
          <p style={{ color: '#64748b', fontSize: '13px', margin: 0 }}>Secretaria Municipal de Saúde</p>
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
