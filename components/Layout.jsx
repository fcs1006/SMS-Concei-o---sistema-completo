'use client'
import { useRouter, usePathname } from 'next/navigation'

export default function Layout({ children, usuario }) {
  const router = useRouter()
  const pathname = usePathname()

  const menus = [
    {
      label: 'Painel Geral', icon: '🏠', path: '/painel',
      bg1: '#0f172a', bg2: '#1e293b', cor: '#94a3b8', corBg: 'rgba(148,163,184,0.15)', acento: '#cbd5e1'
    },
    {
      label: 'Pacientes', icon: '👨🏾', path: '/cadastro',
      cor: '#93c5fd', corBg: 'rgba(147,197,253,0.15)',
      bg1: '#0f172a', bg2: '#1d4ed8', acento: '#60a5fa'
    },
    {
      label: 'Agendamento', icon: '📋', path: '/agendamento',
      bg1: '#172554', bg2: '#1e3a8a', cor: '#93c5fd', corBg: 'rgba(147,197,253,0.15)', acento: '#93c5fd'
    },
    {
      label: 'Relatório', icon: '📊', path: '/relatorio',
      bg1: '#1a1035', bg2: '#2e1065', cor: '#d8b4fe', corBg: 'rgba(216,180,254,0.15)', acento: '#c084fc'
    },
    {
      label: 'TFD', icon: '🚌', path: '/tfd',
      bg1: '#450a0a', bg2: '#7f1d1d', cor: '#fca5a5', corBg: 'rgba(252,165,165,0.15)', acento: '#fca5a5'
    },
    {
      label: 'Frequência', icon: '📆', path: '/frequencia',
      cor: '#0891b2', corBg: 'rgba(8,145,178,0.2)',
      bg1: '#0c2340', bg2: '#0e3460', acento: '#38bdf8'
    },
    {
      label: 'BPA', icon: '🗂️', path: '/bpa',
      cor: '#6ee7b7', corBg: 'rgba(110,231,183,0.15)',
      bg1: '#064e3b', bg2: '#065f46', acento: '#34d399'
    },
    {
      label: 'Almoxarifado', icon: '📦', path: '/almoxarifado',
      cor: '#a5b4fc', corBg: 'rgba(165,180,252,0.15)',
      bg1: '#1e1b4b', bg2: '#312e81', acento: '#818cf8'
    },
    {
      label: 'SIGTAP', icon: '🔬', path: '/sigtap',
      cor: '#6ee7b7', corBg: 'rgba(110,231,183,0.15)',
      bg1: '#022c22', bg2: '#064e3b', acento: '#34d399'
    },
    {
      label: 'Especialidades', icon: '🏥', path: '/especialidades',
      cor: '#fcd34d', corBg: 'rgba(252,211,77,0.15)',
      bg1: '#451a03', bg2: '#92400e', acento: '#f59e0b'
    },
    {
      label: 'Usuários', icon: '👥', path: '/usuarios', adminOnly: true,
      cor: '#f9a8d4', corBg: 'rgba(249,168,212,0.15)',
      bg1: '#4a044e', bg2: '#701a75', acento: '#e879f9'
    },
  ]

  const aliasMap = { '/resumo': '/tfd', '/bpa/config': '/bpa' }
  const pathEfetivo = aliasMap[pathname] || pathname
  const paginaAtiva = menus.find(m => pathEfetivo === m.path) || menus[1]

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#f1f5f9' }}>

      <aside style={{
        width: '220px', minWidth: '220px',
        background: `linear-gradient(180deg, ${paginaAtiva.bg1} 0%, ${paginaAtiva.bg2} 100%)`,
        display: 'flex', flexDirection: 'column',
        boxShadow: '4px 0 20px rgba(0,0,0,0.2)',
        position: 'sticky', top: 0, height: '100vh',
        transition: 'background 0.4s ease'
      }}>

        {/* Logo */}
        <div style={{ padding: '24px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <img src="/logo.jpg" alt="SMS Conceição"
            style={{ width: '48px', height: '48px', objectFit: 'contain', marginBottom: '12px', display: 'block' }} />
          <p style={{
            fontFamily: 'Sora, sans-serif', fontWeight: '700',
            fontSize: '13px', color: 'white', margin: '0 0 2px', lineHeight: '1.3'
          }}>SMS Conceição</p>
          <p style={{ color: paginaAtiva.acento, fontSize: '11px', margin: 0, opacity: 0.7 }}>
            Secretaria de Saúde
          </p>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: '12px 10px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
          {menus.filter(m => !m.adminOnly || usuario?.perfil === 'admin').map(m => {
            const ativo = pathname === m.path
            return (
              <button key={m.path} onClick={() => router.push(m.path)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '10px',
                  padding: '10px 12px', borderRadius: '10px', width: '100%',
                  textAlign: 'left', cursor: 'pointer',
                  background: ativo ? m.corBg : 'transparent',
                  border: ativo ? `1px solid ${m.acento}50` : '1px solid transparent',
                  color: ativo ? m.cor : '#9ca3af',
                  fontSize: '13px', fontWeight: ativo ? '600' : '400',
                  fontFamily: 'DM Sans, sans-serif', transition: 'all 0.2s'
                }}
                onMouseEnter={e => { if (!ativo) { e.currentTarget.style.background = 'rgba(255,255,255,0.07)'; e.currentTarget.style.color = 'white' } }}
                onMouseLeave={e => { if (!ativo) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#9ca3af' } }}
              >
                <span style={{ fontSize: '16px' }}>{m.icon}</span>
                {m.label}
                {ativo && <span style={{ marginLeft: 'auto', width: '6px', height: '6px', background: m.acento, borderRadius: '50%' }}></span>}
              </button>
            )
          })}
        </nav>

        {/* User + Sair */}
        <div style={{ padding: '16px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: '10px',
            padding: '10px 12px', borderRadius: '10px',
            background: 'rgba(255,255,255,0.05)', marginBottom: '8px'
          }}>
            <div style={{
              width: '32px', height: '32px',
              background: paginaAtiva.corBg,
              border: `1px solid ${paginaAtiva.acento}40`,
              borderRadius: '8px', display: 'flex', alignItems: 'center',
              justifyContent: 'center', fontSize: '14px', fontWeight: '700',
              color: paginaAtiva.acento, fontFamily: 'Sora, sans-serif'
            }}>
              {usuario?.nome?.charAt(0) || 'U'}
            </div>
            <div>
              <p style={{ color: 'white', fontSize: '12px', fontWeight: '600', margin: 0, fontFamily: 'Sora, sans-serif' }}>
                {usuario?.nome || 'Usuário'}
              </p>
              <p style={{ color: paginaAtiva.acento, fontSize: '10px', margin: 0, opacity: 0.7 }}>Online</p>
            </div>
          </div>
          <button
            onClick={() => { localStorage.clear(); router.push('/') }}
            style={{
              width: '100%', padding: '9px',
              background: 'rgba(239,68,68,0.1)',
              border: '1px solid rgba(239,68,68,0.2)',
              borderRadius: '10px', color: '#f87171',
              fontSize: '12px', fontWeight: '600',
              cursor: 'pointer', fontFamily: 'DM Sans, sans-serif'
            }}>
            ← Sair
          </button>
        </div>
      </aside>

      <main style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
        <div style={{ flex: 1 }}>
          {children}
        </div>
        <footer style={{
          textAlign: 'center',
          padding: '12px',
          color: '#94a3b8',
          fontSize: '11px',
          fontFamily: 'DM Sans, sans-serif',
          letterSpacing: '0.03em'
        }}>
          © Fernando Cerqueira de Sousa
        </footer>
      </main>
    </div>
  )
}