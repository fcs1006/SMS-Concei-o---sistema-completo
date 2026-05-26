'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import LayoutComponent from '@/components/Layout'
const Layout = LayoutComponent as any
import { 
  Send, Trash2, CheckSquare, Square, RefreshCw, Bell, 
  Calendar, User, Phone, Check, AlertCircle, Search, Edit, X
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

interface LembretePendente {
  id: string
  tipo: string
  referencia_id: string
  data_evento: string
  paciente_nome: string
  telefone: string
  mensagem: string
  botoes: Array<{ id: string; label: string }> | null
  canal: string
  criado_em: string
}

export default function LembretesFila() {
  const router = useRouter()
  const [usuario, setUsuario] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [processando, setProcessando] = useState(false)
  const [varrendo, setVarrendo] = useState(false)
  const [lembretes, setLembretes] = useState<LembretePendente[]>([])
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [filtroNome, setFiltroNome] = useState('')
  const [filtroTipo, setFiltroTipo] = useState('todos')
  const [status, setStatus] = useState({ txt: '', ok: true })

  // States for bulk editing
  const [modalEditarOpen, setModalEditarOpen] = useState(false)
  const [mensagemEditada, setMensagemEditada] = useState('')

  useEffect(() => {
    if (selectedIds.length === 1) {
      const selectedLemb = lembretes.find(l => l.id === selectedIds[0])
      if (selectedLemb) {
        setMensagemEditada(selectedLemb.mensagem)
      }
    } else if (selectedIds.length > 1) {
      const firstLemb = lembretes.find(l => l.id === selectedIds[0])
      if (firstLemb) {
        setMensagemEditada(firstLemb.mensagem)
      } else {
        setMensagemEditada('')
      }
    }
  }, [selectedIds, modalEditarOpen])

  useEffect(() => {
    const u = localStorage.getItem('sms_user')
    if (!u) {
      router.push('/')
      return
    }
    const parsedUser = JSON.parse(u)
    setUsuario(parsedUser)
    carregarLembretes(parsedUser.usuario)
  }, [])

  function mostrarMsg(txt: string, ok = true) {
    setStatus({ txt, ok })
    setTimeout(() => setStatus({ txt: '', ok: true }), 5000)
  }

  async function carregarLembretes(userCpf: string) {
    setLoading(true)
    try {
      const res = await fetch(`/api/whatsapp/lembretes/pendentes?userCpf=${userCpf}`)
      const data = await res.json()
      if (data.ok) {
        setLembretes(data.lembretes || [])
      } else {
        mostrarMsg(data.error || 'Erro ao carregar fila de lembretes.', false)
      }
    } catch (err: any) {
      mostrarMsg('Erro de conexão ao carregar lembretes: ' + err.message, false)
    } finally {
      setLoading(false)
    }
  }

  async function executarVarredura() {
    if (!usuario?.usuario) return
    setVarrendo(true)
    mostrarMsg('Sincronizando dados com o SISREG...', true)
    try {
      // 1. Sincronização com o SISREG
      const syncRes = await fetch(`/api/whatsapp/sisreg/sync?userCpf=${usuario.usuario}`)
      const syncData = await syncRes.json()

      if (!syncRes.ok) {
        mostrarMsg(syncData.error || 'Erro ao sincronizar com o SISREG.', false)
        if (syncRes.status === 404) {
          // Interrompe se a tabela de espelhamento não existir no banco
          return
        }
      }

      mostrarMsg('Processando varredura de lembretes...', true)

      // 2. Varredura de Lembretes
      const res = await fetch(`/api/whatsapp/lembretes?userCpf=${usuario.usuario}`)
      const data = await res.json()
      if (res.ok && data.ok) {
        const resText = `Varredura concluída! Lembretes salvos na fila: Especialidades: ${data.resultados?.especialidades?.enviados || 0}, SISREG: ${data.resultados?.sisreg?.enviados || 0}, TFD: ${data.resultados?.tfd?.enviados || 0}.`
        mostrarMsg(resText, true)
        await carregarLembretes(usuario.usuario)
      } else {
        mostrarMsg(data.error || 'Erro ao executar varredura.', false)
      }
    } catch (err: any) {
      mostrarMsg('Erro de conexão ao executar varredura: ' + err.message, false)
    } finally {
      setVarrendo(false)
    }
  }

  function handleSelectRow(id: string) {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    )
  }

  function handleSelectAll(filteredItems: LembretePendente[]) {
    const filteredIds = filteredItems.map(item => item.id)
    const allSelected = filteredIds.every(id => selectedIds.includes(id))

    if (allSelected) {
      setSelectedIds(prev => prev.filter(id => !filteredIds.includes(id)))
    } else {
      setSelectedIds(prev => [...new Set([...prev, ...filteredIds])])
    }
  }

  async function handleBulkAction(action: 'enviar' | 'excluir') {
    if (!usuario?.usuario) return
    if (selectedIds.length === 0) {
      mostrarMsg('Nenhum lembrete selecionado.', false)
      return
    }

    const confirmMsg = action === 'enviar' 
      ? `Deseja disparar ${selectedIds.length} lembrete(s) pelo WhatsApp?`
      : `Deseja excluir ${selectedIds.length} lembrete(s) da fila?`

    if (!confirm(confirmMsg)) return

    setProcessando(true)
    try {
      const res = await fetch('/api/whatsapp/lembretes/pendentes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ids: selectedIds,
          action,
          userCpf: usuario.usuario
        })
      })

      const data = await res.json()
      if (data.ok) {
        mostrarMsg(data.mensagem || 'Operação realizada com sucesso!')
        setSelectedIds([])
        await carregarLembretes(usuario.usuario)
      } else {
        mostrarMsg(data.error || 'Erro ao executar operação.', false)
      }
    } catch (err: any) {
      mostrarMsg('Erro ao conectar com a API: ' + err.message, false)
    } finally {
      setProcessando(false)
    }
  }

  async function handleBulkEdit() {
    if (!usuario?.usuario) return
    if (selectedIds.length === 0) return
    if (!mensagemEditada.trim()) {
      alert('A mensagem não pode estar vazia.')
      return
    }

    setProcessando(true)
    try {
      const res = await fetch('/api/whatsapp/lembretes/pendentes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ids: selectedIds,
          action: 'editar',
          mensagem: mensagemEditada,
          userCpf: usuario.usuario
        })
      })

      const data = await res.json()
      if (data.ok) {
        mostrarMsg(data.mensagem || 'Mensagens editadas com sucesso!')
        setModalEditarOpen(false)
        setSelectedIds([])
        await carregarLembretes(usuario.usuario)
      } else {
        mostrarMsg(data.error || 'Erro ao editar mensagens.', false)
      }
    } catch (err: any) {
      mostrarMsg('Erro de conexão ao editar: ' + err.message, false)
    } finally {
      setProcessando(false)
    }
  }

  const getTipoLabel = (tipo: string) => {
    switch (tipo) {
      case 'esp_vesp': return 'Consulta Local (Amanhã)'
      case 'sis_vesp': return 'SISREG (Amanhã)'
      case 'tfd_vesp': return 'TFD Viagem (Amanhã)'
      case 'esp_auto': return 'Autorização Local'
      case 'sis_auto': return 'Autorização SISREG'
      case 'esp_5d': return '5 dias (Local)'
      case 'sis_5d': return '5 dias (SISREG)'
      default: return tipo
    }
  }

  const getTipoBadgeColor = (tipo: string) => {
    if (tipo.includes('auto')) return { bg: '#dcfce7', text: '#15803d', border: '#bbf7d0' } // Green
    if (tipo.includes('5d')) return { bg: '#fef9c3', text: '#a16207', border: '#fef08a' } // Yellow
    if (tipo.includes('tfd')) return { bg: '#fee2e2', text: '#b91c1c', border: '#fecaca' } // Red
    return { bg: '#e0f2fe', text: '#0369a1', border: '#bae6fd' } // Blue
  }

  // Filtragem dos lembretes
  const lembretesFiltrados = lembretes.filter(item => {
    const bateNome = item.paciente_nome.toLowerCase().includes(filtroNome.toLowerCase()) ||
                     item.telefone.includes(filtroNome)
    
    const bateTipo = filtroTipo === 'todos' || 
                     (filtroTipo === 'amanha' && item.tipo.includes('vesp')) ||
                     (filtroTipo === 'autorizacoes' && item.tipo.includes('auto')) ||
                     (filtroTipo === '5dias' && item.tipo.includes('5d'))

    return bateNome && bateTipo
  })

  return (
    <Layout usuario={usuario}>
      <div style={{ padding: '32px', maxWidth: '1200px', margin: '0 auto' }}>
        
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '28px' }}>
          <div>
            <h1 style={{ fontFamily: 'Sora, sans-serif', fontWeight: '700', fontSize: '24px', color: '#1e293b', margin: '0 0 4px' }}>
              Fila de Lembretes do WhatsApp
            </h1>
            <p style={{ color: '#64748b', fontSize: '13px', fontFamily: 'DM Sans, sans-serif', margin: 0 }}>
              Gerencie e confirme os disparos manuais de notificações e lembretes para os pacientes.
            </p>
          </div>
          <div style={{ display: 'flex', gap: '12px' }}>
            <button 
              onClick={executarVarredura}
              disabled={loading || processando || varrendo}
              style={{ 
                display: 'flex', alignItems: 'center', gap: '8px', 
                padding: '10px 16px', background: '#0ea5e9', border: 'none', 
                borderRadius: '10px', cursor: 'pointer', fontSize: '13px', 
                fontWeight: '600', color: '#fff', transition: 'all 0.2s'
              }}
            >
              <Search size={15} className={varrendo ? 'animate-spin' : ''} />
              {varrendo ? 'Varrendo...' : 'Varrer Novos Lembretes'}
            </button>

            <button 
              onClick={() => usuario?.usuario && carregarLembretes(usuario.usuario)}
              disabled={loading || processando || varrendo}
              className="btn-secundario"
              style={{ 
                display: 'flex', alignItems: 'center', gap: '8px', 
                padding: '10px 16px', background: '#fff', border: '1px solid #cbd5e1', 
                borderRadius: '10px', cursor: 'pointer', fontSize: '13px', 
                fontWeight: '600', color: '#475569', transition: 'all 0.2s'
              }}
            >
              <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
              Atualizar Fila
            </button>
          </div>
        </div>

        {/* Notificações */}
        <AnimatePresence>
          {status.txt && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              style={{
                background: status.ok ? '#ecfdf5' : '#fef2f2',
                border: '1px solid',
                borderColor: status.ok ? '#10b981' : '#ef4444',
                borderRadius: '12px',
                padding: '14px 18px',
                color: status.ok ? '#065f46' : '#991b1b',
                fontSize: '13px',
                fontWeight: '500',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                marginBottom: '20px'
              }}
            >
              {status.ok ? <Check size={16} /> : <AlertCircle size={16} />}
              <span>{status.txt}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Painel de Filtros e Ações */}
        <div style={{
          background: '#fff',
          borderRadius: '16px',
          padding: '20px',
          boxShadow: '0 1px 6px rgba(0,0,0,0.05)',
          border: '1px solid #e2e8f0',
          marginBottom: '24px',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px'
        }}>
          
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'center', justifyContent: 'space-between' }}>
            {/* Filtros */}
            <div style={{ display: 'flex', gap: '12px', flex: 1, minWidth: '300px' }}>
              <div style={{ position: 'relative', flex: 1 }}>
                <Search size={16} style={{ position: 'absolute', left: '12px', top: '10px', color: '#94a3b8' }} />
                <input 
                  type="text"
                  placeholder="Buscar por paciente ou telefone..."
                  value={filtroNome}
                  onChange={e => setFiltroNome(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px 8px 36px',
                    fontSize: '13px',
                    borderRadius: '10px',
                    border: '1px solid #cbd5e1',
                    outline: 'none',
                    fontFamily: 'DM Sans, sans-serif'
                  }}
                />
              </div>
              
              <select
                value={filtroTipo}
                onChange={e => setFiltroTipo(e.target.value)}
                style={{
                  padding: '8px 12px',
                  fontSize: '13px',
                  borderRadius: '10px',
                  border: '1px solid #cbd5e1',
                  outline: 'none',
                  background: '#fff',
                  fontFamily: 'DM Sans, sans-serif'
                }}
              >
                <option value="todos">Todos os Tipos</option>
                <option value="amanha">Consultas/TFD (Amanhã)</option>
                <option value="autorizacoes">Notificações de Autorização</option>
                <option value="5dias">Avisos de 5 dias</option>
              </select>
            </div>

            {/* Ações em lote */}
            {selectedIds.length > 0 && (
              <motion.div 
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                style={{ display: 'flex', gap: '8px' }}
              >
                <button
                  onClick={() => handleBulkAction('enviar')}
                  disabled={processando}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '6px',
                    background: '#10b981', color: 'white', border: 'none',
                    padding: '8px 16px', borderRadius: '10px', cursor: 'pointer',
                    fontSize: '13px', fontWeight: '600', transition: 'all 0.2s'
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = '#059669'}
                  onMouseLeave={e => e.currentTarget.style.background = '#10b981'}
                >
                  <Send size={14} /> Disparar Selecionados ({selectedIds.length})
                </button>
                
                <button
                  onClick={() => setModalEditarOpen(true)}
                  disabled={processando}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '6px',
                    background: '#3b82f6', color: 'white', border: 'none',
                    padding: '8px 16px', borderRadius: '10px', cursor: 'pointer',
                    fontSize: '13px', fontWeight: '600', transition: 'all 0.2s'
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = '#2563eb'}
                  onMouseLeave={e => e.currentTarget.style.background = '#3b82f6'}
                >
                  <Edit size={14} /> Editar Mensagem ({selectedIds.length})
                </button>
                
                <button
                  onClick={() => handleBulkAction('excluir')}
                  disabled={processando}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '6px',
                    background: '#ef4444', color: 'white', border: 'none',
                    padding: '8px 16px', borderRadius: '10px', cursor: 'pointer',
                    fontSize: '13px', fontWeight: '600', transition: 'all 0.2s'
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = '#dc2626'}
                  onMouseLeave={e => e.currentTarget.style.background = '#ef4444'}
                >
                  <Trash2 size={14} /> Excluir ({selectedIds.length})
                </button>
              </motion.div>
            )}
          </div>
        </div>

        {/* Tabela de Lembretes */}
        <div style={{
          background: '#fff',
          borderRadius: '16px',
          boxShadow: '0 1px 8px rgba(0,0,0,0.06)',
          border: '1px solid #e2e8f0',
          overflow: 'hidden'
        }}>
          {loading ? (
            <div style={{ padding: '60px 0', textAlign: 'center', color: '#94a3b8', fontFamily: 'DM Sans, sans-serif' }}>
              <RefreshCw size={24} className="animate-spin" style={{ margin: '0 auto 12px' }} />
              Carregando fila de lembretes...
            </div>
          ) : lembretesFiltrados.length === 0 ? (
            <div style={{ padding: '60px 0', textAlign: 'center', color: '#64748b', fontFamily: 'DM Sans, sans-serif' }}>
              <Bell size={36} style={{ color: '#cbd5e1', margin: '0 auto 12px' }} />
              <p style={{ fontWeight: '600', fontSize: '15px', margin: '0 0 4px' }}>Fila vazia</p>
              <p style={{ fontSize: '12px', color: '#94a3b8', margin: 0 }}>Nenhum lembrete pendente encontrado para os filtros selecionados.</p>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px', fontFamily: 'DM Sans, sans-serif' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569', fontWeight: '600' }}>
                    <th style={{ padding: '14px 16px', width: '40px' }}>
                      <button 
                        type="button"
                        onClick={() => handleSelectAll(lembretesFiltrados)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', padding: 0 }}
                      >
                        {lembretesFiltrados.every(item => selectedIds.includes(item.id)) 
                          ? <CheckSquare size={18} style={{ color: '#3b82f6' }} />
                          : <Square size={18} />
                        }
                      </button>
                    </th>
                    <th style={{ padding: '14px 16px' }}>Paciente</th>
                    <th style={{ padding: '14px 16px' }}>Telefone</th>
                    <th style={{ padding: '14px 16px' }}>Data Evento</th>
                    <th style={{ padding: '14px 16px' }}>Tipo</th>
                    <th style={{ padding: '14px 16px' }}>Mensagem Lembrete</th>
                    <th style={{ padding: '14px 16px', width: '80px', textAlign: 'center' }}>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {lembretesFiltrados.map((lemb, idx) => {
                    const selected = selectedIds.includes(lemb.id)
                    const badge = getTipoBadgeColor(lemb.tipo)
                    const dataFmt = lemb.data_evento.split('-').reverse().join('/')

                    return (
                      <tr 
                        key={lemb.id} 
                        style={{ 
                          borderBottom: idx === lembretesFiltrados.length - 1 ? 'none' : '1px solid #f1f5f9',
                          background: selected ? 'rgba(59,130,246,0.02)' : 'none',
                          transition: 'background 0.2s'
                        }}
                      >
                        <td style={{ padding: '14px 16px' }}>
                          <button 
                            type="button"
                            onClick={() => handleSelectRow(lemb.id)}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: selected ? '#3b82f6' : '#cbd5e1', padding: 0 }}
                          >
                            {selected ? <CheckSquare size={18} /> : <Square size={18} />}
                          </button>
                        </td>
                        <td style={{ padding: '14px 16px', fontWeight: '600', color: '#1e293b' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <User size={14} style={{ color: '#94a3b8' }} />
                            {lemb.paciente_nome}
                          </div>
                        </td>
                        <td style={{ padding: '14px 16px', color: '#475569' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <Phone size={13} style={{ color: '#94a3b8' }} />
                            {lemb.telefone.replace(/^55/, '')}
                          </div>
                        </td>
                        <td style={{ padding: '14px 16px', color: '#475569' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <Calendar size={13} style={{ color: '#94a3b8' }} />
                            {dataFmt}
                          </div>
                        </td>
                        <td style={{ padding: '14px 16px' }}>
                          <span style={{ 
                            background: badge.bg, color: badge.text, 
                            border: `1px solid ${badge.border}`, 
                            padding: '3px 8px', borderRadius: '6px', 
                            fontSize: '11px', fontWeight: '600', whiteSpace: 'nowrap'
                          }}>
                            {getTipoLabel(lemb.tipo)}
                          </span>
                        </td>
                        <td style={{ padding: '14px 16px', color: '#64748b', maxWidth: '350px' }}>
                          <div style={{ 
                            overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', 
                            WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', lineHeight: '1.4' 
                          }} title={lemb.mensagem}>
                            {lemb.mensagem}
                            {lemb.botoes && lemb.botoes.length > 0 && (
                              <div style={{ marginTop: '4px', display: 'flex', gap: '4px' }}>
                                {lemb.botoes.map(b => (
                                  <span key={b.id} style={{ background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: '4px', fontSize: '9px', padding: '1px 4px', color: '#475569', fontWeight: '500' }}>
                                    🔘 {b.label}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        </td>
                        <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                          <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                            <button
                              onClick={() => {
                                setSelectedIds([lemb.id])
                                setTimeout(() => handleBulkAction('enviar'), 50)
                              }}
                              disabled={processando}
                              title="Disparar este lembrete"
                              style={{
                                background: '#10b981', color: 'white', border: 'none',
                                width: '26px', height: '26px', borderRadius: '6px',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                cursor: 'pointer', transition: 'all 0.2s'
                              }}
                            >
                              <Send size={12} />
                            </button>
                            <button
                              onClick={() => {
                                if (confirm('Excluir este lembrete da fila?')) {
                                  setSelectedIds([lemb.id])
                                  setTimeout(() => handleBulkAction('excluir'), 50)
                                }
                              }}
                              disabled={processando}
                              title="Remover da fila"
                              style={{
                                background: '#ef4444', color: 'white', border: 'none',
                                width: '26px', height: '26px', borderRadius: '6px',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                cursor: 'pointer', transition: 'all 0.2s'
                              }}
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Modal para Edição em Lote */}
        <AnimatePresence>
          {modalEditarOpen && (
            <div style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(15, 23, 42, 0.4)',
              backdropFilter: 'blur(4px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 999,
              padding: '20px'
            }}>
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                style={{
                  background: '#fff',
                  borderRadius: '16px',
                  padding: '24px',
                  width: '100%',
                  maxWidth: '600px',
                  boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
                  border: '1px solid #e2e8f0',
                  position: 'relative'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <h3 style={{ fontFamily: 'Sora, sans-serif', fontSize: '16px', fontWeight: '700', color: '#1e293b', margin: 0 }}>
                    Editar Mensagem em Lote ({selectedIds.length})
                  </h3>
                  <button
                    onClick={() => setModalEditarOpen(false)}
                    style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', padding: 0 }}
                  >
                    <X size={18} />
                  </button>
                </div>

                <p style={{ color: '#64748b', fontSize: '13px', margin: '0 0 16px', lineHeight: '1.4' }}>
                  A mensagem editada abaixo será aplicada a todos os <strong>{selectedIds.length}</strong> lembretes selecionados.
                  Tenha cuidado ao remover variáveis se o lote tiver pacientes diferentes.
                </p>

                <div style={{ marginBottom: '20px' }}>
                  <label className="label-modern" style={{ display: 'block', marginBottom: '6px', fontWeight: '600' }}>Texto da Mensagem</label>
                  <textarea
                    className="input-modern"
                    style={{
                      width: '100%',
                      minHeight: '160px',
                      fontFamily: 'monospace',
                      fontSize: '12px',
                      lineHeight: '1.5',
                      padding: '12px',
                      borderRadius: '10px',
                      border: '1px solid #cbd5e1'
                    }}
                    value={mensagemEditada}
                    onChange={e => setMensagemEditada(e.target.value)}
                  />
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                  <button
                    type="button"
                    onClick={() => setModalEditarOpen(false)}
                    className="btn-secundario"
                    style={{ padding: '8px 16px', borderRadius: '10px', fontSize: '13px', fontWeight: '600' }}
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={handleBulkEdit}
                    disabled={processando || !mensagemEditada.trim()}
                    className="btn-primary"
                    style={{
                      padding: '8px 16px',
                      borderRadius: '10px',
                      fontSize: '13px',
                      fontWeight: '600',
                      background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                      boxShadow: '0 4px 12px rgba(59,130,246,0.2)'
                    }}
                  >
                    {processando ? 'Salvando...' : 'Confirmar e Salvar'}
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

      </div>
    </Layout>
  )
}
