'use client'
import { useState, useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { motion } from 'framer-motion'
import {
  LayoutDashboard, Users, CalendarDays, BarChart2, Bus,
  CalendarCheck, FileText, Package, FlaskConical, Stethoscope,
  Bot, Settings, LogOut, ChevronLeft, ChevronRight
} from 'lucide-react'

export default function Layout({ children, usuario }) {
  const router = useRouter()
  const pathname = usePathname()
  const [recolhido, setRecolhido] = useState(false)
  const [anoAtual, setAnoAtual] = useState('')

  useEffect(() => { setAnoAtual(String(new Date().getFullYear())) }, [])

  useEffect(() => {
    const salvo = localStorage.getItem('sidebar_recolhido')
    if (salvo === 'true') setRecolhido(true)
  }, [])

  function toggleSidebar() {
    setRecolhido(v => {
      localStorage.setItem('sidebar_recolhido', String(!v))
      return !v
    })
  }

  const menus = [
    { label: 'Painel Geral',   Icon: LayoutDashboard, path: '/painel',       acento: '#94a3b8' },
    { label: 'Pacientes',      Icon: Users,            path: '/cadastro',     acento: '#60a5fa' },
    { label: 'Agendamento',    Icon: CalendarDays,     path: '/agendamento',  acento: '#93c5fd' },
    { label: 'Relatório',      Icon: BarChart2,        path: '/relatorio',    acento: '#c084fc' },
    { label: 'TFD',            Icon: Bus,              path: '/tfd',          acento: '#f87171' },
    { label: 'Frequência',     Icon: CalendarCheck,    path: '/frequencia',   acento: '#38bdf8' },
    { label: 'BPA',            Icon: FileText,         path: '/bpa',          acento: '#34d399' },
    { label: 'Almoxarifado',   Icon: Package,          path: '/almoxarifado', acento: '#818cf8' },
    { label: 'SIGTAP',         Icon: FlaskConical,     path: '/sigtap',       acento: '#34d399' },
    { label: 'Especialidades', Icon: Stethoscope,      path: '/especialidades', acento: '#fbbf24' },
    { label: 'Francisco IA',   Icon: Bot,              path: '/francisco',    acento: '#34d399', adminOnly: true },
  ]

  const aliasMap = { '/resumo': '/tfd', '/bpa/config': '/bpa' }
  const pathEfetivo = aliasMap[pathname] || pathname
  const paginaAtiva = menus.find(m => pathEfetivo === m.path) || menus[0]

  const sidebarBg = '#0f172a'
  const sidebarBorder = 'rgba(255,255,255,0.06)'

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#f1f5f9' }}>

      <motion.aside
        animate={{ width: recolhido ? 64 : 216, minWidth: recolhido ? 64 : 216 }}
        transition={{ duration: 0.25, ease: 'easeInOut' }}
        style={{
          background: sidebarBg,
          display: 'flex', flexDirection: 'column',
          boxShadow: '2px 0 12px rgba(0,0,0,0.18)',
          position: 'sticky', top: 0, height: '100vh',
          overflow: 'hidden'
        }}>

        {/* Logo */}
        <div style={{
          padding: recolhido ? '18px 0' : '18px 16px',
          borderBottom: `1px solid ${sidebarBorder}`,
          display: 'flex', alignItems: 'center',
          justifyContent: recolhido ? 'center' : 'space-between',
          gap: '8px'
        }}>
          {!recolhido && (
            <div style={{ overflow: 'hidden' }}>
              <p style={{ fontFamily: 'Sora, sans-serif', fontWeight: '700', fontSize: '12px', color: 'white', margin: '0 0 1px', whiteSpace: 'nowrap' }}>
                SMS Conceição
              </p>
              <p style={{ color: '#64748b', fontSize: '10px', margin: 0, whiteSpace: 'nowrap' }}>
                Secretaria de Saúde
              </p>
            </div>
          )}
          <button
            onClick={toggleSidebar}
            title={recolhido ? 'Expandir menu' : 'Recolher menu'}
            style={{
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '6px',
              color: '#64748b',
              cursor: 'pointer',
              width: '24px', height: '24px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0, transition: 'all 0.2s', padding: 0
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.12)'; e.currentTarget.style.color = 'white' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; e.currentTarget.style.color = '#64748b' }}
          >
            {recolhido
              ? <ChevronRight size={13} />
              : <ChevronLeft size={13} />
            }
          </button>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: '8px 8px', display: 'flex', flexDirection: 'column', gap: '1px', overflowY: 'auto', overflowX: 'hidden' }}>
          {menus.filter(m => !m.adminOnly || usuario?.perfil === 'admin').map(m => {
            const ativo = pathEfetivo === m.path
            return (
              <button
                key={m.path}
                onClick={() => router.push(m.path)}
                title={recolhido ? m.label : ''}
                style={{
                  display: 'flex', alignItems: 'center',
                  gap: '10px',
                  justifyContent: recolhido ? 'center' : 'flex-start',
                  padding: recolhido ? '9px 0' : '9px 12px',
                  borderRadius: '8px', width: '100%',
                  textAlign: 'left', cursor: 'pointer',
                  background: ativo ? `${m.acento}18` : 'transparent',
                  border: 'none',
                  color: ativo ? m.acento : '#64748b',
                  fontSize: '13px', fontWeight: ativo ? '600' : '400',
                  fontFamily: 'DM Sans, sans-serif', transition: 'all 0.15s',
                  overflow: 'hidden', whiteSpace: 'nowrap'
                }}
                onMouseEnter={e => { if (!ativo) { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.color = '#cbd5e1' } }}
                onMouseLeave={e => { if (!ativo) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#64748b' } }}
              >
                <m.Icon size={16} strokeWidth={ativo ? 2.2 : 1.7} style={{ flexShrink: 0 }} />
                {!recolhido && (
                  <>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', flexGrow: 1 }}>{m.label}</span>
                    {ativo && <span style={{ width: '5px', height: '5px', background: m.acento, borderRadius: '50%', flexShrink: 0 }} />}
                  </>
                )}
              </button>
            )
          })}
        </nav>

        {/* Usuário */}
        <div style={{ padding: recolhido ? '10px 8px' : '10px 8px', borderTop: `1px solid ${sidebarBorder}` }}>
          {!recolhido ? (
            <>
              <div style={{
                display: 'flex', alignItems: 'center', gap: '8px',
                padding: '8px 10px', borderRadius: '8px',
                background: 'rgba(255,255,255,0.04)', marginBottom: '6px'
              }}>
                <div style={{
                  width: '28px', height: '28px', flexShrink: 0,
                  background: 'rgba(99,102,241,0.2)',
                  border: '1px solid rgba(99,102,241,0.3)',
                  borderRadius: '7px', display: 'flex', alignItems: 'center',
                  justifyContent: 'center', fontSize: '12px', fontWeight: '700',
                  color: '#818cf8', fontFamily: 'Sora, sans-serif'
                }}>
                  {usuario?.nome?.charAt(0) || 'U'}
                </div>
                <div style={{ overflow: 'hidden', flexGrow: 1 }}>
                  <p style={{ color: '#e2e8f0', fontSize: '11px', fontWeight: '600', margin: 0, fontFamily: 'Sora, sans-serif', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {usuario?.nome || 'Usuário'}
                  </p>
                  <p style={{ color: '#475569', fontSize: '10px', margin: 0 }}>
                    {usuario?.perfil === 'admin' ? 'Administrador' : 'Usuário'}
                  </p>
                </div>
                {usuario?.perfil === 'admin' && (
                  <button
                    title="Gerenciar usuários"
                    onClick={() => router.push('/usuarios')}
                    style={{
                      background: 'transparent', border: 'none',
                      color: '#475569', cursor: 'pointer', padding: '4px',
                      borderRadius: '6px', display: 'flex', alignItems: 'center',
                      transition: 'color 0.2s'
                    }}
                    onMouseEnter={e => e.currentTarget.style.color = '#94a3b8'}
                    onMouseLeave={e => e.currentTarget.style.color = '#475569'}
                  >
                    <Settings size={14} />
                  </button>
                )}
              </div>
              <button
                onClick={() => { localStorage.clear(); router.push('/') }}
                style={{
                  width: '100%', padding: '7px 10px',
                  background: 'transparent',
                  border: '1px solid rgba(239,68,68,0.2)',
                  borderRadius: '8px', color: '#64748b',
                  fontSize: '12px', fontWeight: '500',
                  cursor: 'pointer', fontFamily: 'DM Sans, sans-serif',
                  display: 'flex', alignItems: 'center', gap: '6px',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={e => { e.currentTarget.style.color = '#f87171'; e.currentTarget.style.borderColor = 'rgba(239,68,68,0.4)'; e.currentTarget.style.background = 'rgba(239,68,68,0.06)' }}
                onMouseLeave={e => { e.currentTarget.style.color = '#64748b'; e.currentTarget.style.borderColor = 'rgba(239,68,68,0.2)'; e.currentTarget.style.background = 'transparent' }}
              >
                <LogOut size={13} /> Sair
              </button>
            </>
          ) : (
            <>
              <div title={usuario?.nome || 'Usuário'} style={{
                width: '36px', height: '36px', margin: '0 auto 6px',
                background: 'rgba(99,102,241,0.2)',
                border: '1px solid rgba(99,102,241,0.3)',
                borderRadius: '8px', display: 'flex', alignItems: 'center',
                justifyContent: 'center', fontSize: '14px', fontWeight: '700',
                color: '#818cf8', fontFamily: 'Sora, sans-serif', cursor: 'default'
              }}>
                {usuario?.nome?.charAt(0) || 'U'}
              </div>
              <button
                title="Sair"
                onClick={() => { localStorage.clear(); router.push('/') }}
                style={{
                  width: '100%', padding: '7px 0',
                  background: 'transparent',
                  border: '1px solid rgba(239,68,68,0.2)',
                  borderRadius: '8px', color: '#64748b',
                  fontSize: '13px', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={e => { e.currentTarget.style.color = '#f87171'; e.currentTarget.style.background = 'rgba(239,68,68,0.06)' }}
                onMouseLeave={e => { e.currentTarget.style.color = '#64748b'; e.currentTarget.style.background = 'transparent' }}
              >
                <LogOut size={14} />
              </button>
            </>
          )}
        </div>
      </motion.aside>

      <main style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
        <div style={{ flex: 1 }}>
          {children}
        </div>
        <footer style={{
          textAlign: 'center', padding: '12px',
          color: '#94a3b8', fontSize: '11px',
          fontFamily: 'DM Sans, sans-serif', letterSpacing: '0.03em'
        }}>
          {anoAtual ? `© ${anoAtual} GestSus — Todos os direitos reservados` : ''}
        </footer>
      </main>
    </div>
  )
}
