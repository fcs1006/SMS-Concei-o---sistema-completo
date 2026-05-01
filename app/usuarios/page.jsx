'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Layout from '@/components/Layout'
import { Pencil, UserX, UserCheck, KeyRound } from 'lucide-react'

function mascaraCPF(v) {
  const d = String(v || '').replace(/\D/g, '')
  if (d.length < 3) return d
  return d.slice(0, 3) + '.***.***-**'
}

export default function Usuarios() {
  const router = useRouter()
  const [usuario, setUsuario] = useState(null)
  const [lista, setLista] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [status, setStatus] = useState({ msg: '', tipo: '' })
  const [modalSenha, setModalSenha] = useState(null)
  const [novaSenha, setNovaSenha] = useState('')
  const [confirmarSenha, setConfirmarSenha] = useState('')
  const [salvandoSenha, setSalvandoSenha] = useState(false)
  const [erroSenha, setErroSenha] = useState('')
  const [modalEditar, setModalEditar] = useState(null)
  const [editForm, setEditForm] = useState({ nome: '', telefone: '', email: '', perfil: 'usuario', ativo: true })
  const [salvandoEdit, setSalvandoEdit] = useState(false)
  const [erroEdit, setErroEdit] = useState('')

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

  async function redefinirSenha(e) {
    e.preventDefault()
    setErroSenha('')
    if (novaSenha !== confirmarSenha) { setErroSenha('As senhas não coincidem.'); return }
    if (novaSenha.length < 6) { setErroSenha('Mínimo 6 caracteres.'); return }
    setSalvandoSenha(true)
    const { data, error } = await supabase.rpc('admin_redefinir_senha', {
      p_admin_cpf:  usuario.usuario,
      p_cpf_alvo:   modalSenha.usuario,
      p_nova_senha: novaSenha
    })
    setSalvandoSenha(false)
    if (error || !data?.ok) {
      setErroSenha(error?.message || data?.error || 'Erro ao redefinir.')
    } else {
      setModalSenha(null)
      setNovaSenha('')
      setConfirmarSenha('')
      setStatus({ msg: `Senha de ${modalSenha.nome} redefinida com sucesso.`, tipo: 'ok' })
    }
  }

  function abrirEditar(u) {
    setEditForm({ nome: u.nome, telefone: u.telefone || '', email: u.email || '', perfil: u.perfil, ativo: u.ativo })
    setErroEdit('')
    setModalEditar(u)
  }

  async function salvarEdicao(e) {
    e.preventDefault()
    setErroEdit('')
    if (!editForm.nome.trim()) { setErroEdit('Nome é obrigatório.'); return }
    setSalvandoEdit(true)
    const { data, error } = await supabase.rpc('admin_editar_usuario', {
      p_admin_cpf: usuario.usuario,
      p_cpf_alvo:  modalEditar.usuario,
      p_nome:      editForm.nome.trim().replace(/\b\w/g, c => c.toUpperCase()),
      p_telefone:  editForm.telefone || null,
      p_email:     editForm.email || null,
      p_perfil:    editForm.perfil,
      p_ativo:     editForm.ativo
    })
    setSalvandoEdit(false)
    if (error || !data?.ok) {
      setErroEdit(error?.message || data?.error || 'Erro ao salvar.')
    } else {
      setModalEditar(null)
      setStatus({ msg: `Usuário ${editForm.nome} atualizado com sucesso.`, tipo: 'ok' })
      carregar(usuario.usuario)
    }
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
            <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
              <colgroup>
                <col style={{ width: '20%' }} />
                <col style={{ width: '13%' }} />
                <col style={{ width: '12%' }} />
                <col style={{ width: '17%' }} />
                <col style={{ width: '11%' }} />
                <col style={{ width: '11%' }} />
                <col style={{ width: '16%' }} />
              </colgroup>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                  {['Nome', 'CPF', 'Telefone', 'E-mail', 'Perfil', 'Situação', 'Ações'].map(h => (
                    <th key={h} style={{
                      padding: '11px 14px', textAlign: 'left',
                      fontSize: '10px', fontWeight: '700',
                      color: '#94a3b8', fontFamily: 'DM Sans, sans-serif',
                      textTransform: 'uppercase', letterSpacing: '0.06em'
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {lista.map((u, i) => (
                  <tr key={u.usuario} style={{
                    borderBottom: '1px solid #f1f5f9',
                    background: i % 2 === 0 ? '#fff' : '#fafafa'
                  }}>
                    <td style={{ padding: '12px 14px', overflow: 'hidden' }}>
                      <p style={{
                        margin: 0, fontWeight: '600', fontSize: '13px',
                        color: '#0f172a', fontFamily: 'Sora, sans-serif',
                        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'
                      }}>
                        {u.nome}
                      </p>
                    </td>
                    <td style={{ padding: '12px 14px' }}>
                      <span style={{ fontSize: '12px', color: '#475569', fontFamily: 'monospace', whiteSpace: 'nowrap' }}>
                        {mascaraCPF(u.usuario)}
                      </span>
                    </td>
                    <td style={{ padding: '12px 14px' }}>
                      <span style={{ fontSize: '12px', color: '#475569', whiteSpace: 'nowrap' }}>{u.telefone || '-'}</span>
                    </td>
                    <td style={{ padding: '12px 14px', overflow: 'hidden' }}>
                      <span style={{ fontSize: '12px', color: '#475569', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'block' }}>{u.email || '-'}</span>
                    </td>
                    <td style={{ padding: '12px 14px' }}>
                      <select
                        value={u.perfil}
                        onChange={e => atualizar(u.usuario, u.ativo, e.target.value)}
                        disabled={u.usuario === usuario?.usuario}
                        style={{
                          fontSize: '11px', padding: '4px 6px', borderRadius: '6px',
                          border: '1px solid #e2e8f0', background: '#fff', width: '100%',
                          cursor: u.usuario === usuario?.usuario ? 'not-allowed' : 'pointer',
                          color: u.perfil === 'admin' ? '#7c3aed' : '#475569',
                          fontWeight: u.perfil === 'admin' ? '700' : '400',
                          fontFamily: 'DM Sans, sans-serif'
                        }}
                      >
                        <option value="usuario">Usuário</option>
                        <option value="admin">Admin</option>
                      </select>
                    </td>
                    <td style={{ padding: '12px 14px' }}>
                      <span style={{
                        display: 'inline-block', padding: '3px 10px',
                        borderRadius: '20px', fontSize: '11px', fontWeight: '700',
                        whiteSpace: 'nowrap',
                        background: u.ativo ? '#dcfce7' : '#fef9c3',
                        color: u.ativo ? '#16a34a' : '#92400e',
                        fontFamily: 'DM Sans, sans-serif'
                      }}>
                        {u.ativo ? 'Ativo' : 'Pendente'}
                      </span>
                    </td>
                    <td style={{ padding: '12px 14px' }}>
                      <div style={{ display: 'flex', gap: '6px', flexWrap: 'nowrap', alignItems: 'center' }}>
                        <button title="Editar usuário"
                          onClick={() => abrirEditar(u)}
                          style={{ width: '30px', height: '30px', borderRadius: '8px', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f0fdf4', color: '#15803d', flexShrink: 0 }}>
                          <Pencil size={13} />
                        </button>
                        {u.usuario !== usuario?.usuario ? (
                          <button title={u.ativo ? 'Suspender acesso' : 'Aprovar acesso'}
                            onClick={() => atualizar(u.usuario, !u.ativo, u.perfil)}
                            style={{ width: '30px', height: '30px', borderRadius: '8px', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, background: u.ativo ? '#fee2e2' : '#dcfce7', color: u.ativo ? '#dc2626' : '#16a34a' }}>
                            {u.ativo ? <UserX size={13} /> : <UserCheck size={13} />}
                          </button>
                        ) : (
                          <div style={{ width: '30px' }} />
                        )}
                        <button title="Redefinir senha"
                          onClick={() => { setModalSenha({ usuario: u.usuario, nome: u.nome }); setNovaSenha(''); setConfirmarSenha(''); setErroSenha('') }}
                          style={{ width: '30px', height: '30px', borderRadius: '8px', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#eff6ff', color: '#2563eb', flexShrink: 0 }}>
                          <KeyRound size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Modal redefinir senha */}
      {modalSenha && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)',
          backdropFilter: 'blur(4px)', zIndex: 200,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px'
        }}>
          <div style={{
            background: '#fff', borderRadius: '16px', padding: '28px',
            width: '100%', maxWidth: '400px', boxShadow: '0 20px 60px rgba(0,0,0,0.2)'
          }}>
            <h2 style={{ fontFamily: 'Sora, sans-serif', fontSize: '16px', fontWeight: '700', color: '#0f172a', margin: '0 0 4px' }}>
              Redefinir Senha
            </h2>
            <p style={{ color: '#64748b', fontSize: '12px', margin: '0 0 20px', fontFamily: 'DM Sans, sans-serif' }}>
              Usuário: <strong>{modalSenha.nome}</strong>
            </p>
            <form onSubmit={redefinirSenha} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', color: '#64748b', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Nova Senha
                </label>
                <input
                  type="password" value={novaSenha} required
                  onChange={e => setNovaSenha(e.target.value)}
                  placeholder="Mínimo 6 caracteres"
                  style={{ width: '100%', border: '1.5px solid #e2e8f0', borderRadius: '10px', padding: '10px 12px', fontSize: '13px', color: '#1e293b', background: '#fff', outline: 'none', boxSizing: 'border-box' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', color: '#64748b', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Confirmar Senha
                </label>
                <input
                  type="password" value={confirmarSenha} required
                  onChange={e => setConfirmarSenha(e.target.value)}
                  placeholder="Repita a senha"
                  style={{ width: '100%', border: '1.5px solid #e2e8f0', borderRadius: '10px', padding: '10px 12px', fontSize: '13px', color: '#1e293b', background: '#fff', outline: 'none', boxSizing: 'border-box' }}
                />
              </div>
              {erroSenha && (
                <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', color: '#991b1b', padding: '10px 14px', borderRadius: '8px', fontSize: '13px' }}>
                  {erroSenha}
                </div>
              )}
              <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                <button type="button" onClick={() => setModalSenha(null)}
                  style={{ flex: 1, padding: '10px', background: '#f1f5f9', border: 'none', borderRadius: '10px', fontWeight: '600', fontSize: '13px', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif', color: '#475569' }}>
                  Cancelar
                </button>
                <button type="submit" disabled={salvandoSenha}
                  style={{ flex: 2, padding: '10px', background: 'linear-gradient(135deg, #2563eb, #1d4ed8)', border: 'none', borderRadius: '10px', fontWeight: '700', fontSize: '13px', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif', color: '#fff', opacity: salvandoSenha ? 0.6 : 1 }}>
                  {salvandoSenha ? 'Salvando...' : 'Redefinir Senha'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal editar usuário */}
      {modalEditar && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)',
          backdropFilter: 'blur(4px)', zIndex: 200,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px'
        }}>
          <div style={{
            background: '#fff', borderRadius: '16px', padding: '28px',
            width: '100%', maxWidth: '460px', boxShadow: '0 20px 60px rgba(0,0,0,0.2)'
          }}>
            <h2 style={{ fontFamily: 'Sora, sans-serif', fontSize: '16px', fontWeight: '700', color: '#0f172a', margin: '0 0 4px' }}>
              Editar Usuário
            </h2>
            <p style={{ color: '#64748b', fontSize: '12px', margin: '0 0 20px', fontFamily: 'DM Sans, sans-serif' }}>
              CPF: <strong style={{ fontFamily: 'monospace' }}>{mascaraCPF(modalEditar.usuario)}</strong>
            </p>
            <form onSubmit={salvarEdicao} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {[
                { label: 'Nome completo', key: 'nome', type: 'text', placeholder: 'Nome completo' },
                { label: 'Telefone', key: 'telefone', type: 'text', placeholder: '(00) 00000-0000' },
                { label: 'E-mail', key: 'email', type: 'email', placeholder: 'email@exemplo.com' },
              ].map(({ label, key, type, placeholder }) => (
                <div key={key}>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', color: '#64748b', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    {label}
                  </label>
                  <input
                    type={type} value={editForm[key]} placeholder={placeholder}
                    onChange={e => setEditForm(f => ({ ...f, [key]: e.target.value }))}
                    style={{ width: '100%', border: '1.5px solid #e2e8f0', borderRadius: '10px', padding: '10px 12px', fontSize: '13px', color: '#1e293b', background: '#fff', outline: 'none', boxSizing: 'border-box' }}
                  />
                </div>
              ))}
              <div style={{ display: 'flex', gap: '12px' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', color: '#64748b', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Perfil
                  </label>
                  <select value={editForm.perfil} onChange={e => setEditForm(f => ({ ...f, perfil: e.target.value }))}
                    disabled={modalEditar.usuario === usuario?.usuario}
                    style={{ width: '100%', border: '1.5px solid #e2e8f0', borderRadius: '10px', padding: '10px 12px', fontSize: '13px', color: '#1e293b', background: '#fff', outline: 'none', boxSizing: 'border-box' }}>
                    <option value="usuario">Usuário</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', color: '#64748b', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Situação
                  </label>
                  <select value={editForm.ativo ? 'ativo' : 'pendente'} onChange={e => setEditForm(f => ({ ...f, ativo: e.target.value === 'ativo' }))}
                    disabled={modalEditar.usuario === usuario?.usuario}
                    style={{ width: '100%', border: '1.5px solid #e2e8f0', borderRadius: '10px', padding: '10px 12px', fontSize: '13px', color: '#1e293b', background: '#fff', outline: 'none', boxSizing: 'border-box' }}>
                    <option value="ativo">Ativo</option>
                    <option value="pendente">Pendente</option>
                  </select>
                </div>
              </div>
              {erroEdit && (
                <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', color: '#991b1b', padding: '10px 14px', borderRadius: '8px', fontSize: '13px' }}>
                  {erroEdit}
                </div>
              )}
              <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                <button type="button" onClick={() => setModalEditar(null)}
                  style={{ flex: 1, padding: '10px', background: '#f1f5f9', border: 'none', borderRadius: '10px', fontWeight: '600', fontSize: '13px', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif', color: '#475569' }}>
                  Cancelar
                </button>
                <button type="submit" disabled={salvandoEdit}
                  style={{ flex: 2, padding: '10px', background: 'linear-gradient(135deg, #15803d, #16a34a)', border: 'none', borderRadius: '10px', fontWeight: '700', fontSize: '13px', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif', color: '#fff', opacity: salvandoEdit ? 0.6 : 1 }}>
                  {salvandoEdit ? 'Salvando...' : 'Salvar Alterações'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </Layout>
  )
}
