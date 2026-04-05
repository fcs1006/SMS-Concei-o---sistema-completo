'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
export default function Login() {
  const [usuario, setUsuario] = useState('')
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState('')
  const [carregando, setCarregando] = useState(false)
  const router = useRouter()

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

      if (!data?.ok) {
        setErro('Usuário ou senha incorretos.')
        setCarregando(false)
        return
      }

      localStorage.setItem('sms_user', JSON.stringify(data))
      router.push('/agendamento')
    } catch {
      setErro('Erro de conexão. Tente novamente.')
      setCarregando(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #0f172a 0%, #134e4a 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px'
    }}>
      <div className="login-card">
        {/* Logo / Header */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{
            width: '56px', height: '56px',
            background: 'linear-gradient(135deg, #0d9488, #14b8a6)',
            borderRadius: '16px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 16px',
            fontSize: '24px',
            boxShadow: '0 8px 24px rgba(13,148,136,0.4)'
          }}>🏥</div>
          <h1 style={{
            fontFamily: 'Sora, sans-serif',
            fontSize: '20px',
            fontWeight: '700',
            color: '#0f172a',
            margin: '0 0 4px'
          }}>SMS Conceição</h1>
          <p style={{ color: '#64748b', fontSize: '13px', margin: 0 }}>
            Secretaria Municipal de Saúde
          </p>
        </div>

        <form onSubmit={fazerLogin} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label className="label-modern">Usuário</label>
            <input
              className="input-modern"
              type="text"
              value={usuario}
              onChange={e => {
                const digits = e.target.value.replace(/\D/g, '').slice(0, 11)
                const masked = digits
                  .replace(/(\d{3})(\d)/, '$1.$2')
                  .replace(/(\d{3})(\d)/, '$1.$2')
                  .replace(/(\d{3})(\d{1,2})$/, '$1-$2')
                setUsuario(masked)
              }}
              placeholder="000.000.000-00"
              inputMode="numeric"
              required
            />
          </div>

          <div>
            <label className="label-modern">Senha</label>
            <input
              className="input-modern"
              type="password"
              value={senha}
              onChange={e => setSenha(e.target.value)}
              placeholder="••••••••"
              required
            />
          </div>

          {erro && (
            <div className="status-err" style={{ textAlign: 'center' }}>{erro}</div>
          )}

          <button
            type="submit"
            disabled={carregando}
            className="btn-primary"
            style={{ width: '100%', padding: '13px', fontSize: '14px', marginTop: '4px' }}
          >
            {carregando ? 'Entrando...' : 'ENTRAR'}
          </button>
        </form>
      </div>
    </div>
  )
}