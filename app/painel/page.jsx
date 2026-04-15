'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Layout from '@/components/Layout'

const COR       = '#34d399'
const COR_BG    = 'rgba(52,211,153,0.12)'
const COR_TEXT  = '#6ee7b7'

function Card({ titulo, valor, sub, icon, cor, corBg }) {
  return (
    <div style={{
      background: '#fff',
      borderRadius: '16px',
      padding: '24px',
      boxShadow: '0 1px 8px rgba(0,0,0,0.07)',
      border: '1px solid #e2e8f0',
      display: 'flex', flexDirection: 'column', gap: '8px',
      minWidth: 0
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: '13px', fontWeight: '500', color: '#64748b', fontFamily: 'DM Sans, sans-serif' }}>{titulo}</span>
        <span style={{
          background: corBg || COR_BG, borderRadius: '10px',
          width: '38px', height: '38px', display: 'flex', alignItems: 'center',
          justifyContent: 'center', fontSize: '18px'
        }}>{icon}</span>
      </div>
      <span style={{ fontSize: '32px', fontWeight: '700', color: '#1e293b', fontFamily: 'Sora, sans-serif', lineHeight: '1' }}>
        {valor ?? <span style={{ fontSize: '20px', color: '#94a3b8' }}>—</span>}
      </span>
      {sub && <span style={{ fontSize: '12px', color: '#94a3b8', fontFamily: 'DM Sans, sans-serif' }}>{sub}</span>}
    </div>
  )
}

export default function PainelGeral() {
  const router = useRouter()
  const [usuario, setUsuario] = useState(null)
  const [carregando, setCarregando] = useState(true)
  const [stats, setStats] = useState({
    viagensHoje: null,
    viagensMes: null,
    totalPacientes: null,
    servidoresAtivos: null,
    destinosTop: [],
    ultimasViagens: []
  })

  useEffect(() => {
    const u = localStorage.getItem('sms_user')
    if (!u) { router.push('/'); return }
    setUsuario(JSON.parse(u))
    carregarDados()
  }, [])

  async function carregarDados() {
    setCarregando(true)
    const hoje = new Date()
    const pad = (n) => String(n).padStart(2, '0')
    const hojeStr = `${hoje.getFullYear()}-${pad(hoje.getMonth() + 1)}-${pad(hoje.getDate())}`
    const inicioMes = `${hoje.getFullYear()}-${pad(hoje.getMonth() + 1)}-01`

    const [
      { count: viagensHoje },
      { count: viagensMes },
      { count: totalPacientes },
      { count: servidoresAtivos },
      { data: viagensDestinoRaw },
      { data: ultimasViagens }
    ] = await Promise.all([
      supabase.from('viagens').select('*', { count: 'exact', head: true }).eq('data_viagem', hojeStr),
      supabase.from('viagens').select('*', { count: 'exact', head: true }).gte('data_viagem', inicioMes),
      supabase.from('pacientes').select('*', { count: 'exact', head: true }),
      supabase.from('servidores').select('*', { count: 'exact', head: true }).eq('ativo', true),
      supabase.from('viagens').select('destino').gte('data_viagem', inicioMes),
      supabase.from('viagens').select('data_viagem, hora, paciente_nome, destino, created_at').order('created_at', { ascending: false }).limit(5)
    ])

    // Contagem por destino
    const contagem = {}
    for (const v of (viagensDestinoRaw || [])) {
      const d = v.destino || 'Não informado'
      contagem[d] = (contagem[d] || 0) + 1
    }
    const destinosTop = Object.entries(contagem)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([destino, total]) => ({ destino, total }))

    setStats({ viagensHoje, viagensMes, totalPacientes, servidoresAtivos, destinosTop, ultimasViagens: ultimasViagens || [] })
    setCarregando(false)
  }

  const mesAtual = new Date().toLocaleString('pt-BR', { month: 'long', year: 'numeric' })

  return (
    <Layout usuario={usuario}>
      <div style={{ padding: '32px', maxWidth: '1100px' }}>

        {/* Cabeçalho */}
        <div style={{ marginBottom: '28px' }}>
          <h1 style={{
            fontFamily: 'Sora, sans-serif', fontWeight: '700',
            fontSize: '22px', color: '#1e293b', margin: '0 0 4px'
          }}>Painel Geral</h1>
          <p style={{ color: '#64748b', fontSize: '13px', fontFamily: 'DM Sans, sans-serif', margin: 0 }}>
            Visão geral do sistema — {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}
          </p>
        </div>

        {carregando ? (
          <div style={{ color: '#94a3b8', fontFamily: 'DM Sans, sans-serif', fontSize: '14px', padding: '40px 0' }}>
            Carregando dados...
          </div>
        ) : (
          <>
            {/* Cards de métricas */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '28px' }}>
              <Card
                titulo="Viagens hoje"
                valor={stats.viagensHoje}
                sub="agendamentos para hoje"
                icon="🚐"
                corBg="rgba(59,130,246,0.12)"
              />
              <Card
                titulo={`Viagens previstas em ${mesAtual}`}
                valor={stats.viagensMes}
                sub="no mês corrente"
                icon="📋"
                corBg="rgba(139,92,246,0.12)"
              />
              <Card
                titulo="Pacientes cadastrados"
                valor={stats.totalPacientes}
                sub="no banco de dados"
                icon="🧑‍⚕️"
                corBg="rgba(16,185,129,0.12)"
              />
              <Card
                titulo="Servidores ativos"
                valor={stats.servidoresAtivos}
                sub="em atividade"
                icon="👥"
                corBg="rgba(245,158,11,0.12)"
              />
            </div>

            {/* Linha inferior: destinos + últimas viagens */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>

              {/* Top destinos */}
              <div style={{
                background: '#fff', borderRadius: '16px', padding: '24px',
                boxShadow: '0 1px 8px rgba(0,0,0,0.07)', border: '1px solid #e2e8f0'
              }}>
                <h2 style={{ fontFamily: 'Sora, sans-serif', fontWeight: '700', fontSize: '14px', color: '#1e293b', margin: '0 0 16px' }}>
                  Principais destinos — {mesAtual}
                </h2>
                {stats.destinosTop.length === 0 ? (
                  <p style={{ color: '#94a3b8', fontSize: '13px', fontFamily: 'DM Sans, sans-serif' }}>Nenhuma viagem no mês.</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {stats.destinosTop.map(({ destino, total }, i) => {
                      const max = stats.destinosTop[0].total
                      const pct = Math.round((total / max) * 100)
                      return (
                        <div key={destino}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                            <span style={{ fontSize: '13px', color: '#334155', fontFamily: 'DM Sans, sans-serif', fontWeight: '500' }}>{destino}</span>
                            <span style={{ fontSize: '12px', color: '#64748b', fontFamily: 'DM Sans, sans-serif' }}>{total} viagem{total !== 1 ? 's' : ''}</span>
                          </div>
                          <div style={{ height: '6px', background: '#f1f5f9', borderRadius: '99px', overflow: 'hidden' }}>
                            <div style={{
                              height: '100%', width: `${pct}%`,
                              background: i === 0 ? '#3b82f6' : i === 1 ? '#8b5cf6' : '#10b981',
                              borderRadius: '99px', transition: 'width 0.5s'
                            }} />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* Últimas viagens */}
              <div style={{
                background: '#fff', borderRadius: '16px', padding: '24px',
                boxShadow: '0 1px 8px rgba(0,0,0,0.07)', border: '1px solid #e2e8f0'
              }}>
                <h2 style={{ fontFamily: 'Sora, sans-serif', fontWeight: '700', fontSize: '14px', color: '#1e293b', margin: '0 0 16px' }}>
                  Últimas viagens registradas
                </h2>
                {stats.ultimasViagens.length === 0 ? (
                  <p style={{ color: '#94a3b8', fontSize: '13px', fontFamily: 'DM Sans, sans-serif' }}>Nenhuma viagem encontrada.</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {stats.ultimasViagens.map((v, i) => (
                      <div key={i} style={{
                        display: 'flex', alignItems: 'center', gap: '12px',
                        padding: '10px 12px', background: '#f8fafc',
                        borderRadius: '10px', border: '1px solid #e2e8f0'
                      }}>
                        <div style={{
                          width: '32px', height: '32px', borderRadius: '8px',
                          background: 'rgba(59,130,246,0.1)', display: 'flex',
                          alignItems: 'center', justifyContent: 'center', fontSize: '14px', flexShrink: 0
                        }}>🚐</div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ fontSize: '13px', fontWeight: '600', color: '#1e293b', margin: 0, fontFamily: 'DM Sans, sans-serif', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {v.paciente_nome || 'Paciente'}
                          </p>
                          <p style={{ fontSize: '11px', color: '#94a3b8', margin: 0, fontFamily: 'DM Sans, sans-serif' }}>
                            {v.destino} · {v.data_viagem ? new Date(v.data_viagem + 'T12:00:00').toLocaleDateString('pt-BR') : ''}
                            {v.hora ? ` às ${v.hora}` : ''}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </div>
          </>
        )}
      </div>
    </Layout>
  )
}
