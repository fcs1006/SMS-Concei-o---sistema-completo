'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Layout from '@/components/Layout'

function mascaraCPF(v) {
  const d = String(v || '').replace(/\D/g, '')
  return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')
}

export default function Usuarios() {
  const router = useRouter()
  const [usuario, setUsuario] = useState(null)
  const [lista, setLista] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [status, setStatus] = useState({ msg: '', tipo: '' })

  useEffect(() => {
    const u = JSON.parse(localStorage.getItem('sms_user') || 'null')
    if (!u) { router.push('/'); return }
    if (u.perfil !== 'admin') { router.push('/painel'); return }
    setUsuario(u)
    carregar(u.usuario)
  }, [])

  async function carregar(cpfAdmin) {
    setCarregando(true)
    const { data, error } = await supabase.rpc('listar_usuarios', { p_admin_cpf: cpfAdmin })
    if (error || !data?.ok) {
      setStatus({ msg: '❌ Erro ao carregar: ' + (error?.message || data?.error), tipo: 'erro' })
    } else {
      setLista(data.data || [])
    }
    setCarregando(false)
  }

  async function atualizar(cpfAlvo, ativo, perfil) {
    setStatus({ msg: '', tipo: '' })
    const { data, error } = await supabase.rpc('atualizar_usuario', {
      p_admin_cpf: usuario.usuario,
      p_cpf_alvo: cpfAlvo,
      p_ativo: ativo,
      p_perfil: perfil
    })
    if (error || !data?.ok) {
      setStatus({ msg: '❌ Erro: ' + (error?.message || data?.error), tipo: 'erro' })
    } else {
      setStatus({ msg: '✅ Usuário atualizado.', tipo: 'ok' })
      carregar(usuario.usuario)
    }
  }

  function formatarData(v) {
    if (!v) return '-'
    const d = new Date(v)
    return d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  }

  return (
    <Layout usuario={usuario}>
      <div style={{ padding: '28px', maxWidth: '900px', margin: '0 auto' }}>
        <div style={{ marginBottom: '24px' }}>
          <h1 style={{ fontFamily: 'Sora, sans-serif', fontSize: '22px', fontWeight: '700', color: '#0f172a', margin: '0 0 4px' }}>
            Usuários do Sistema
          </h1>
          <p style={{ color: '#64748b', fontSize: '13px', margin: 0 }}>
            Aprove novos cadastros e gerencie permissões de acesso.
          </p>
        </div>

        {status.msg && (
          <div className={status.tipo === 'ok' ? 'status-ok' : 'status-err'} style={{ marginBottom: '16px' }}>
            {status.msg}
          </div>
        )}

        <div className="card" style={{ padding: '0', overflow: 'hidden' }}>
          {carregando ? (
            <p style={{ padding: '24px', color: '#64748b', fontSize: '13px', margin: 0 }}>Carregando usuários...</p>
          ) : lista.length === 0 ? (
            <p style={{ padding: '24px', color: '#64748b', fontSize: '13px', margin: 0 }}>Nenhum usuário encontrado.</p>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                  {['Nome', 'CPF (usuário)', 'Cadastro', 'Perfil', 'Situação', 'Ações'].map(h => (
                    <th key={h} style={{
                      padding: '12px 16px', textAlign: 'left',
                      fontSize: '11px', fontWeight: '700',
                      color: '#64748b', fontFamily: 'DM Sans, sans-serif',
                      textTransform: 'uppercase', letterSpacing: '0.05em'
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {lista.map((u, i) => (
                  <tr key={u.id} style={{
                    borderBottom: '1px solid #f1f5f9',
                    background: i % 2 === 0 ? '#fff' : '#fafafa'
                  }}>
                    <td style={{ padding: '14px 16px' }}>
                      <p style={{ margin: 0, fontWeight: '600', fontSize: '13px', color: '#0f172a', fontFamily: 'Sora, sans-serif' }}>
                        {u.nome}
                      </p>
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <span style={{ fontSize: '13px', color: '#475569', fontFamily: 'monospace' }}>
                        {mascaraCPF(u.usuario)}
                      </span>
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <span style={{ fontSize: '12px', color: '#64748b' }}>{formatarData(u.criado_em)}</span>
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <select
                        value={u.perfil}
                        onChange={e => atualizar(u.usuario, u.ativo, e.target.value)}
                        disabled={u.usuario === usuario?.usuario}
                        style={{
                          fontSize: '12px', padding: '4px 8px', borderRadius: '6px',
                          border: '1px solid #e2e8f0', background: '#fff',
                          cursor: u.usuario === usuario?.usuario ? 'not-allowed' : 'pointer',
                          color: u.perfil === 'admin' ? '#7c3aed' : '#475569',
                          fontWeight: u.perfil === 'admin' ? '700' : '400'
                        }}
                      >
                        <option value="usuario">Usuário</option>
                        <option value="admin">Admin</option>
                      </select>
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <span style={{
                        display: 'inline-block', padding: '3px 10px',
                        borderRadius: '20px', fontSize: '11px', fontWeight: '700',
                        background: u.ativo ? '#dcfce7' : '#fef9c3',
                        color: u.ativo ? '#16a34a' : '#92400e'
                      }}>
                        {u.ativo ? 'Ativo' : 'Pendente'}
                      </span>
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      {u.usuario !== usuario?.usuario && (
                        <button
                          onClick={() => atualizar(u.usuario, !u.ativo, u.perfil)}
                          style={{
                            fontSize: '12px', fontWeight: '600', padding: '6px 14px',
                            borderRadius: '8px', border: 'none', cursor: 'pointer',
                            background: u.ativo ? '#fee2e2' : '#dcfce7',
                            color: u.ativo ? '#dc2626' : '#16a34a'
                          }}
                        >
                          {u.ativo ? 'Suspender' : 'Aprovar'}
                        </button>
                      )}
                      {u.usuario === usuario?.usuario && (
                        <span style={{ fontSize: '11px', color: '#94a3b8' }}>você</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </Layout>
  )
}
