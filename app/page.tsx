'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

type Tela = 'login' | 'cadastro' | 'esqueci'

export default function Login() {
  const [tela, setTela] = useState<Tela>('login')
  const router = useRouter()

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #0f172a 0%, #134e4a 100%)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '20px'
    }}>
      <div className="login-card">
        {/* Logo / Header */}
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <div style={{
            width: '56px', height: '56px',
            background: 'linear-gradient(135deg, #0d9488, #14b8a6)',
            borderRadius: '16px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 16px', fontSize: '24px',
            boxShadow: '0 8px 24px rgba(13,148,136,0.4)'
          }}>🏥</div>
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
        body: JSON.stringify({ usuario: usuario.trim(), senha: senha.trim() })
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
        Sua conta foi criada. Você já pode fazer login.
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
