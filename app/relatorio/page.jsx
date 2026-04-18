'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Layout from '@/components/Layout'
import { abrirJanelaImpressao } from '@/lib/printHeader'
import { Printer, Pencil, Trash2 } from 'lucide-react'

export default function Relatorio() {
  const router = useRouter()
  const [usuario, setUsuario] = useState(null)
  const [viagens, setViagens] = useState([])
  const [filtradas, setFiltradas] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [filtros, setFiltros] = useState({ busca: '', dataInicio: '', dataFim: '', destino: '' })
  const [linhaSelecionada, setLinhaSelecionada] = useState(null)
  const [modalEditar, setModalEditar] = useState(false)
  const [viagemEditando, setViagemEditando] = useState(null)
  const [salvandoEdicao, setSalvandoEdicao] = useState(false)
  const [modalExcluir, setModalExcluir] = useState(false)
  const [viagemExcluindo, setViagemExcluindo] = useState(null)
  const [excluindo, setExcluindo] = useState(false)
  const [statusMsg, setStatusMsg] = useState({ msg: '', tipo: '' })
  const [modalImprimir, setModalImprimir] = useState(false)
  const [imprimirData, setImprimirData] = useState('')
  const [imprimirCidade, setImprimirCidade] = useState('')
  const [buscaAcomp1, setBuscaAcomp1] = useState('')
  const [buscaAcomp2, setBuscaAcomp2] = useState('')
  const [sugestoesAcomp1, setSugestoesAcomp1] = useState([])
  const [sugestoesAcomp2, setSugestoesAcomp2] = useState([])

  async function buscarAcomp(texto, numero) {
  if (texto.length < 3) {
    numero === 1 ? setSugestoesAcomp1([]) : setSugestoesAcomp2([])
    return
  }
  const { data } = await supabase
    .from('pacientes')
    .select('nome')
    .ilike('nome', `%${texto}%`)
    .limit(8)
  numero === 1 ? setSugestoesAcomp1(data || []) : setSugestoesAcomp2(data || [])
}

  useEffect(() => {
    const u = localStorage.getItem('sms_user')
    if (!u) { router.push('/'); return }
    setUsuario(JSON.parse(u))
    carregarViagens()
  }, [])

  useEffect(() => { aplicarFiltros() }, [filtros, viagens])

  async function carregarViagens() {
    setCarregando(true)
    const { data } = await supabase
      .from('viagens').select('*')
      .order('data_viagem', { ascending: false })
      .limit(5000)

    const registros = data || []

    // Busca telefones dos pacientes
    const cpfs = [...new Set(registros.map(v => v.paciente_cpf).filter(Boolean))]
    let mapaFone = {}
    if (cpfs.length > 0) {
      const { data: pacs } = await supabase
        .from('pacientes').select('cpf_cns, telefone').in('cpf_cns', cpfs)
      if (pacs) pacs.forEach(p => { mapaFone[p.cpf_cns] = p.telefone })
    }

    const comFone = registros.map(v => ({
      ...v,
      telefone: mapaFone[v.paciente_cpf] || ''
    }))

    setViagens(comFone)
    setCarregando(false)
  }

  function aplicarFiltros() {
    let r = [...viagens]
    if (filtros.busca) {
      const t = filtros.busca.toUpperCase()
      r = r.filter(v =>
        (v.paciente_nome || '').includes(t) ||
        (v.destino || '').includes(t) ||
        (v.motivo || '').includes(t) ||
        (v.local_destino || '').includes(t)
      )
    }
    if (filtros.dataInicio) r = r.filter(v => v.data_viagem >= filtros.dataInicio)
    if (filtros.dataFim) r = r.filter(v => v.data_viagem <= filtros.dataFim)
    if (filtros.destino) r = r.filter(v => v.destino === filtros.destino)
    setFiltradas(r)
  }

  function filtrarHoje() {
    const hoje = new Date().toISOString().split('T')[0]
    setFiltros(f => ({ ...f, dataInicio: hoje, dataFim: hoje }))
  }

  function limparFiltros() {
    setFiltros({ busca: '', dataInicio: '', dataFim: '', destino: '' })
    setLinhaSelecionada(null)
  }

  function formatarData(d) {
    if (!d) return '-'
    const [ano, mes, dia] = d.split('-')
    return `${dia}/${mes}/${ano}`
  }

  function formatarTelefone(v) {
    if (!v) return '-'
    const s = String(v).replace(/\D/g, '')
    if (s.length === 11) return s.replace(/^(\d{2})(\d{5})(\d{4})/, '($1) $2-$3')
    if (s.length === 10) return s.replace(/^(\d{2})(\d{4})(\d{4})/, '($1) $2-$3')
    return v || '-'
  }

  const destinos = [...new Set(viagens.map(v => v.destino).filter(Boolean))].sort()
  const totalPacientes = filtradas.length
  const totalAcompanhantes = filtradas.reduce((acc, v) => {
    let q = 0
    if (v.acomp1_nome) q++
    if (v.acomp2_nome) q++
    return acc + q
  }, 0)

async function abrirEditar(v) {
  const { data: fresco } = await supabase
    .from('viagens')
    .select('*')
    .eq('id', v.id)
    .single()

  const primeiroNome = (usuario?.nome || '').split(' ')[0].toUpperCase()

  if (fresco) {
    setViagemEditando({ ...fresco, telefone: v.telefone || '', agendado_por: primeiroNome || fresco.agendado_por || '' })
  } else {
    setViagemEditando({ ...v, agendado_por: primeiroNome || v.agendado_por || '' })
  }

  setModalEditar(true)
  setStatusMsg({ msg: '', tipo: '' })
}

  async function salvarEdicao() {
    setSalvandoEdicao(true)
    const { error } = await supabase.from('viagens').update({
      data_viagem:   viagemEditando.data_viagem,
      hora:          viagemEditando.hora,
      destino:       viagemEditando.destino,
      local_destino: viagemEditando.local_destino,
      motivo:        viagemEditando.motivo,
      tipo_viagem:   viagemEditando.tipo_viagem,
      agendado_por:  viagemEditando.agendado_por,
      acomp1_nome:   viagemEditando.acomp1_nome,
      acomp2_nome:   viagemEditando.acomp2_nome,
      competencia:   viagemEditando.data_viagem
        ? viagemEditando.data_viagem.substring(5,7) + '/' + viagemEditando.data_viagem.substring(0,4) : ''
    }).eq('id', viagemEditando.id)

    if (error) {
      setStatusMsg({ msg: 'Erro: ' + error.message, tipo: 'erro' })
    } else {
      setStatusMsg({ msg: 'Atualizado!', tipo: 'ok' })
      setModalEditar(false)
      setLinhaSelecionada(null)
      carregarViagens()
    }
    setSalvandoEdicao(false)
  }

  async function confirmarExclusao() {
    setExcluindo(true)
    const { error } = await supabase.from('viagens').delete().eq('id', viagemExcluindo.id)
    if (error) { alert('Erro: ' + error.message) }
    else { setModalExcluir(false); setLinhaSelecionada(null); carregarViagens() }
    setExcluindo(false)
  }

  function imprimirRelatorio() {
    const dataFmt = imprimirData
      ? (() => { const [a,m,d] = imprimirData.split('-'); return `${d}/${m}/${a}` })()
      : ''

    const MAPA_CIDADE = {
      'CONCEIÇÃO/PALMAS - CARRO': 'PALMAS',
      'PALMAS/CONCEIÇÃO - CARRO': 'PALMAS',
      'CONCEIÇÃO/PORTO NACIONAL - CARRO': 'PORTO NACIONAL',
      'PORTO NACIONAL/CONCEIÇÃO - CARRO': 'PORTO NACIONAL',
      'CONCEIÇÃO/ARRAIAS': 'ARRAIAS', 'ARRAIAS/CONCEIÇÃO': 'ARRAIAS',
      'CONCEIÇÃO/DIANÓPOLIS': 'DIANÓPOLIS', 'DIANÓPOLIS/CONCEIÇÃO': 'DIANÓPOLIS',
      'CONCEIÇÃO/CAMPOS BELOS': 'CAMPOS BELOS',
      'CONCEIÇÃO/GURUPI': 'GURUPI'
    }

    const lista = filtradas.filter(v => {
      const dataOk = !imprimirData || v.data_viagem === imprimirData
      const cidadeOk = !imprimirCidade || MAPA_CIDADE[v.destino] === imprimirCidade
      return dataOk && cidadeOk
    })

    const linhas = lista.map((v, i) => `
      <tr>
        <td style="text-align:center;">${i + 1}</td>
        <td style="font-weight:bold;">${v.paciente_nome || '-'}</td>
        <td>${[v.acomp1_nome, v.acomp2_nome].filter(Boolean).join(' / ') || '-'}</td>
        <td>${formatarTelefone(v.telefone)}</td>
        <td>${v.motivo || '-'}</td>
        <td style="text-align:center;">${v.hora || '-'}</td>
        <td>${v.local_destino || '-'}</td>
        <td>${v.tipo_viagem || '-'}</td>
        <td></td>
      </tr>
    `).join('')

    const conteudo = `
      <h2 style="text-align:center;font-size:16px;text-transform:uppercase;margin:0 0 8px;">
        RELAÇÃO DOS PACIENTES COM TRATAMENTO FORA DE DOMICÍLIO
      </h2>
      <p style="font-size:14px;margin:2px 0;"><strong>DATA:</strong> ${dataFmt}</p>
      <p style="font-size:14px;margin:2px 0 8px;"><strong>CIDADE DESTINO:</strong> ${imprimirCidade || 'TODAS'}</p>
      <table style="table-layout:fixed;width:100%;">
        <colgroup>
          <col style="width:3%"><col style="width:20%"><col style="width:18%">
          <col style="width:12%"><col style="width:12%"><col style="width:6%">
          <col style="width:13%"><col style="width:8%"><col style="width:8%">
        </colgroup>
        <thead>
          <tr>
            <th>Nº</th><th>PACIENTE</th><th>ACOMPANHANTE</th><th>TELEFONE</th>
            <th>MOTIVO</th><th>HORA</th><th>LOCAL</th><th>OBS</th><th>CONTROLE</th>
          </tr>
        </thead>
        <tbody>${linhas}</tbody>
      </table>
      <p style="font-size:12px;margin:8px 0;"><strong>TOTAL DE PACIENTES: ${lista.length}</strong></p>
    `

    abrirJanelaImpressao('Relatório de Viagens', conteudo)
    setModalImprimir(false)
  }

  const inp = "input-modern"
  const selectOpts = (ops) => ops.map(o => <option key={o} value={o}>{o}</option>)

  return (
    <Layout usuario={usuario}>
      <div style={{ padding: '28px' }}>

        {/* Header */}
        <div style={{ marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h1 style={{ fontFamily: 'Sora, sans-serif', fontSize: '22px', fontWeight: '700', color: '#000000', margin: '0 0 4px' }}>
              Relatório de Viagens
            </h1>
            <p style={{ color: '#000000', fontSize: '13px', margin: 0 }}>
              Gerencie e acompanhe todas as viagens
            </p>
          </div>
          <button type="button" onClick={() => {
            const hoje = new Date().toISOString().split('T')[0]
            setImprimirData(filtros.dataInicio || hoje)
            setImprimirCidade('')
            setModalImprimir(true)
          }} style={{
            padding: '9px 18px', background: 'linear-gradient(135deg, #1a1035, #2e1065)',
            border: 'none', borderRadius: '10px',
            fontSize: '13px', color: 'white', cursor: 'pointer',
            fontFamily: 'Sora, sans-serif', fontWeight: '600',
            boxShadow: '0 4px 12px rgba(30,107,46,0.3)',
            display: 'flex', alignItems: 'center', gap: '6px'
          }}>
            <Printer size={14} /> Imprimir
          </button>
        </div>

        {/* Filtros */}
        <div className="card" style={{ padding: '16px', marginBottom: '16px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(180px,1fr) 148px 148px 180px', gap: '10px', alignItems: 'end', marginBottom: '10px' }}>
            <div>
              <label className="label-modern">Buscar</label>
              <input className="input-modern" value={filtros.busca}
                onChange={e => setFiltros(f => ({ ...f, busca: e.target.value }))}
                placeholder="Nome, destino, motivo..." />
            </div>
            <div>
              <label className="label-modern">Data Início</label>
              <input type="date" className="input-modern" value={filtros.dataInicio}
                onChange={e => setFiltros(f => ({ ...f, dataInicio: e.target.value }))} />
            </div>
            <div>
              <label className="label-modern">Data Fim</label>
              <input type="date" className="input-modern" value={filtros.dataFim}
                onChange={e => setFiltros(f => ({ ...f, dataFim: e.target.value }))} />
            </div>
            <div>
              <label className="label-modern">Destino</label>
              <select className="input-modern" value={filtros.destino}
                onChange={e => setFiltros(f => ({ ...f, destino: e.target.value }))}>
                <option value="">Todos</option>
                {destinos.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button type="button" onClick={filtrarHoje} style={{
              padding: '9px 14px', borderRadius: '8px', border: 'none',
              background: '#ea6c00', color: 'white', fontWeight: '600',
              fontSize: '12px', cursor: 'pointer', whiteSpace: 'nowrap',
              fontFamily: 'Sora, sans-serif'
            }}>Hoje</button>
            <button type="button" onClick={limparFiltros} style={{
              padding: '9px 14px', borderRadius: '8px', border: 'none',
              background: '#1d4ed8', color: 'white', fontWeight: '600',
              fontSize: '12px', cursor: 'pointer', whiteSpace: 'nowrap',
              fontFamily: 'Sora, sans-serif'
            }}>Limpar</button>
            <button type="button"
              onClick={() => linhaSelecionada ? abrirEditar(linhaSelecionada) : alert('Selecione uma linha!')}
              style={{
                padding: '9px 14px', borderRadius: '8px', border: 'none',
                background: linhaSelecionada ? '#16a34a' : '#9ca3af',
                color: 'white', fontWeight: '600', fontSize: '12px',
                cursor: linhaSelecionada ? 'pointer' : 'not-allowed',
                whiteSpace: 'nowrap', fontFamily: 'Sora, sans-serif',
              display: 'flex', alignItems: 'center', gap: '5px'
              }}><Pencil size={12} /> Editar</button>
            <button type="button"
              onClick={() => {
                if (!linhaSelecionada) { alert('Selecione uma linha!'); return }
                setViagemExcluindo(linhaSelecionada)
                setModalExcluir(true)
              }}
              style={{
                padding: '9px 14px', borderRadius: '8px', border: 'none',
                background: linhaSelecionada ? '#ef4444' : '#9ca3af',
                color: 'white', fontWeight: '600', fontSize: '12px',
                cursor: linhaSelecionada ? 'pointer' : 'not-allowed',
                whiteSpace: 'nowrap', fontFamily: 'Sora, sans-serif',
              display: 'flex', alignItems: 'center', gap: '5px'
              }}><Trash2 size={12} /> Excluir</button>
          </div>
        </div>

        {/* Selecionado */}
        {linhaSelecionada && (
          <div className="selected-banner" style={{ marginBottom: '12px' }}>
            <span>Selecionado: <strong>{linhaSelecionada.paciente_nome}</strong> — {formatarData(linhaSelecionada.data_viagem)}</span>
            <button type="button" onClick={() => setLinhaSelecionada(null)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280', fontSize: '13px' }}>
              ✕ Limpar
            </button>
          </div>
        )}

        {/* Badges */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', flexWrap: 'wrap' }}>
          {[
            { label: `${filtradas.length} viagens`, bg: '#dbeafe', color: '#1d4ed8' },
            { label: `${totalPacientes} pacientes`, bg: '#dcfce7', color: '#155220' },
            { label: `${totalAcompanhantes} acompanhantes`, bg: '#fef9c3', color: '#854d0e' },
            { label: `${totalPacientes + totalAcompanhantes} total`, bg: '#ede9fe', color: '#5b21b6' },
          ].map(b => (
            <span key={b.label} style={{
              padding: '4px 14px', borderRadius: '20px', fontSize: '12px',
              fontWeight: '600', background: b.bg, color: b.color,
              fontFamily: 'Sora, sans-serif'
            }}>{b.label}</span>
          ))}
        </div>

        {/* Tabela */}
        <div className="card" style={{ overflow: 'hidden' }}>
          {carregando ? (
            <div style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>Carregando...</div>
          ) : filtradas.length === 0 ? (
            <div style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>Nenhum registro encontrado.</div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="table-modern">
                <thead>
                  <tr style={{ background: 'linear-gradient(135deg, #1a1035, #2e1065)' }}>
                    {['Data','Hora','Paciente','Telefone','Destino','Local','Motivo','Tipo','Acomp. 1','Acomp. 2','Agendado'].map(h => (
                      <th key={h} style={{ color: '#fff' }}>{h}</th>))}
                  </tr>
                </thead>
                <tbody>
                  {filtradas.map(v => (
                    <tr key={v.id}
                      onClick={() => setLinhaSelecionada(linhaSelecionada?.id === v.id ? null : v)}
                      className={linhaSelecionada?.id === v.id ? 'selected' : ''}>
                      <td style={{ whiteSpace: 'nowrap', fontWeight: '500', fontSize: '11px' }}>{formatarData(v.data_viagem)}</td>
                      <td style={{ whiteSpace: 'nowrap', color: '#64748b', fontSize: '11px' }}>{v.hora || '-'}</td>
                      <td style={{ fontWeight: '600', color: '#0f172a', minWidth: '130px', fontSize: '11px' }}>{v.paciente_nome || '-'}</td>
                      <td style={{ color: '#64748b', whiteSpace: 'nowrap', fontSize: '11px' }}>{formatarTelefone(v.telefone)}</td>
                      <td style={{ fontSize: '11px', whiteSpace: 'pre-line', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '160px' }} title={v.destino || '-'}>{v.destino || '-'}</td>
                      <td style={{ color: '#64748b', fontSize: '11px' }}>{v.local_destino || '-'}</td>
                      <td style={{ fontSize: '11px' }}>{v.motivo || '-'}</td>
                      <td style={{ whiteSpace: 'nowrap', fontSize: '11px' }}>{v.tipo_viagem || '-'}</td>
                      <td style={{ color: '#64748b', minWidth: '100px', fontSize: '11px' }}>{v.acomp1_nome || '-'}</td>
                      <td style={{ color: '#64748b', minWidth: '100px', fontSize: '11px' }}>{v.acomp2_nome || '-'}</td>
                      <td style={{ color: '#64748b', whiteSpace: 'nowrap', fontSize: '11px' }}>{v.agendado_por || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* MODAL IMPRIMIR */}
      {modalImprimir && (
        <div className="modal-overlay">
          <div className="modal-card" style={{ maxWidth: '420px' }}>
            <h2 style={{ fontFamily: 'Sora, sans-serif', fontSize: '18px', fontWeight: '700', color: '#0f172a', margin: '0 0 6px' }}>
              <Printer size={16} style={{ display: 'inline', marginRight: '6px' }} /> Imprimir Relatório
            </h2>
            <p style={{ color: '#64748b', fontSize: '13px', margin: '0 0 20px' }}>
              Selecione a data e a cidade destino.
              <br /><em style={{ fontSize: '11px' }}>(Palmas e Porto Nacional → use o botão TFD)</em>
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label className="label-modern">Data da Viagem</label>
                <input type="date" className="input-modern" value={imprimirData}
                  onChange={e => setImprimirData(e.target.value)} />
              </div>
              <div>
                <label className="label-modern">Cidade Destino</label>
                <select className="input-modern" value={imprimirCidade}
                  onChange={e => setImprimirCidade(e.target.value)}>
                  <option value="">Todas as cidades</option>
                  {['ARRAIAS','DIANÓPOLIS','CAMPOS BELOS','GURUPI','PALMAS','PORTO NACIONAL']
                    .map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '10px', marginTop: '20px', justifyContent: 'flex-end' }}>
              <button type="button" onClick={() => setModalImprimir(false)} className="btn-secondary">Fechar</button>
              <button type="button" onClick={imprimirRelatorio} className="btn-primary" style={{ background: 'linear-gradient(135deg, #1a1035, #2e1065)', padding: '10px 24px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Printer size={14} /> IMPRIMIR
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL EDITAR */}
      {modalEditar && viagemEditando && (
        <div className="modal-overlay">
          <div className="modal-card">
            <h2 style={{ fontFamily: 'Sora, sans-serif', fontSize: '18px', fontWeight: '700', color: '#0f172a', margin: '0 0 4px' }}>
              <Pencil size={16} style={{ display: 'inline', marginRight: '6px' }} /> Editar Viagem
            </h2>
            <p style={{ color: '#64748b', fontSize: '13px', margin: '0 0 20px' }}>{viagemEditando.paciente_nome}</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label className="label-modern">Data</label>
                  <input type="date" className={inp} value={viagemEditando.data_viagem || ''}
                    onChange={e => setViagemEditando(v => ({ ...v, data_viagem: e.target.value }))} />
                </div>
                <div>
                  <label className="label-modern">Hora</label>
                  <select className={inp} value={viagemEditando.hora || ''}
                    onChange={e => setViagemEditando(v => ({ ...v, hora: e.target.value }))}>
                    <option value="">--</option>
                    {selectOpts(['06:00','07:00','08:00','09:00','10:00','11:00','12:00','13:00','14:00','15:00','16:00','17:00','18:00'])}
                  </select>
                </div>
              </div>
              <div>
                <label className="label-modern">Destino</label>
                <select className={inp} value={viagemEditando.destino || ''}
                  onChange={e => setViagemEditando(v => ({ ...v, destino: e.target.value }))}>
                  <option value="">--</option>
                  {selectOpts(['CONCEIÇÃO/PALMAS','CONCEIÇÃO/PALMAS - CARRO','PALMAS/CONCEIÇÃO','PALMAS/CONCEIÇÃO - CARRO',
                    'CONCEIÇÃO/PORTO NACIONAL','CONCEIÇÃO/PORTO NACIONAL - CARRO','PORTO NACIONAL/CONCEIÇÃO',
                    'PORTO NACIONAL/CONCEIÇÃO - CARRO','CONCEIÇÃO/ARRAIAS','ARRAIAS/CONCEIÇÃO',
                    'CONCEIÇÃO/DIANÓPOLIS','DIANÓPOLIS/CONCEIÇÃO','CONCEIÇÃO/CAMPOS BELOS','CONCEIÇÃO/GURUPI'])}
                </select>
              </div>
              <div>
                <label className="label-modern">Local</label>
                <input className={inp} value={viagemEditando.local_destino || ''}
                  onChange={e => setViagemEditando(v => ({ ...v, local_destino: e.target.value.toUpperCase() }))} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label className="label-modern">Motivo</label>
                  <select className={inp} value={viagemEditando.motivo || ''}
                    onChange={e => setViagemEditando(v => ({ ...v, motivo: e.target.value }))}>
                    <option value="">--</option>
                    {selectOpts(['CONSULTA','EXAME','CIRURGIA - INTERNAÇÃO','RETORNO CIR. - PÓS OP','PERÍCIA MÉDICA','ALTA HOSPITALAR','CAPACITAÇÃO','ESTUDANTE','SÓ RETORNO'])}
                  </select>
                </div>
                <div>
                  <label className="label-modern">Tipo de Viagem</label>
                  <select className={inp} value={viagemEditando.tipo_viagem || ''}
                    onChange={e => setViagemEditando(v => ({ ...v, tipo_viagem: e.target.value }))}>
                    <option value="">--</option>
                    {selectOpts(['IDA E VOLTA','SÓ IDA','SÓ VOLTA'])}
                  </select>
                </div>
              </div>
              {/* Acompanhante 1 */}
<div style={{ position: 'relative' }}>
  <label className="label-modern">Acompanhante 1</label>
  <input className={inp}
    value={viagemEditando.acomp1_nome || ''}
    onChange={e => {
      const v = e.target.value.toUpperCase()
      setViagemEditando(prev => ({ ...prev, acomp1_nome: v }))
      setBuscaAcomp1(v)
      buscarAcomp(v, 1)
    }}
    placeholder="Digite para buscar..." />
  {sugestoesAcomp1.length > 0 && (
    <div className="search-dropdown">
      {sugestoesAcomp1.map((p, i) => (
        <div key={i} className="search-item"
          onMouseDown={() => {
            setViagemEditando(prev => ({ ...prev, acomp1_nome: p.nome }))
            setSugestoesAcomp1([])
          }}>
          {p.nome}
        </div>
      ))}
    </div>
  )}
</div>

{/* Acompanhante 2 */}
<div style={{ position: 'relative' }}>
  <label className="label-modern">Acompanhante 2</label>
  <input className={inp}
    value={viagemEditando.acomp2_nome || ''}
    onChange={e => {
      const v = e.target.value.toUpperCase()
      setViagemEditando(prev => ({ ...prev, acomp2_nome: v }))
      setBuscaAcomp2(v)
      buscarAcomp(v, 2)
    }}
    placeholder="Digite para buscar..." />
  {sugestoesAcomp2.length > 0 && (
    <div className="search-dropdown">
      {sugestoesAcomp2.map((p, i) => (
        <div key={i} className="search-item"
          onMouseDown={() => {
            setViagemEditando(prev => ({ ...prev, acomp2_nome: p.nome }))
            setSugestoesAcomp2([])
          }}>
          {p.nome}
        </div>
      ))}
    </div>
  )}
</div>
              <div>
                <label className="label-modern">Agendado por</label>
                <select className={inp} value={viagemEditando.agendado_por || ''}
                  onChange={e => setViagemEditando(v => ({ ...v, agendado_por: e.target.value }))}>
                  <option value="">--</option>
                  {selectOpts(['GLEICYANE','FERNANDO','ALSIONY'])}
                </select>
              </div>
            </div>
            {statusMsg.msg && (
              <div className={statusMsg.tipo === 'ok' ? 'status-ok' : 'status-err'}
                style={{ marginTop: '14px', textAlign: 'center' }}>{statusMsg.msg}</div>
            )}
            <div style={{ display: 'flex', gap: '10px', marginTop: '20px', justifyContent: 'flex-end' }}>
              <button type="button" onClick={() => setModalEditar(false)} className="btn-secondary">Cancelar</button>
              <button type="button" onClick={salvarEdicao} disabled={salvandoEdicao} className="btn-primary">
                {salvandoEdicao ? 'Salvando...' : 'SALVAR'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL EXCLUIR */}
      {modalExcluir && viagemExcluindo && (
        <div className="modal-overlay">
          <div className="modal-card" style={{ maxWidth: '400px' }}>
            <h2 style={{ fontFamily: 'Sora, sans-serif', fontSize: '18px', fontWeight: '700', color: '#dc2626', margin: '0 0 12px' }}>
              <Trash2 size={16} style={{ display: 'inline', marginRight: '6px' }} /> Excluir Viagem
            </h2>
            <p style={{ color: '#475569', fontSize: '13px', margin: '0 0 6px' }}>Tem certeza que deseja excluir?</p>
            <p style={{ fontWeight: '700', color: '#0f172a', fontSize: '14px', margin: '0 0 4px' }}>{viagemExcluindo.paciente_nome}</p>
            <p style={{ color: '#64748b', fontSize: '13px', margin: '0 0 20px' }}>{formatarData(viagemExcluindo.data_viagem)} — {viagemExcluindo.destino}</p>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button type="button" onClick={() => setModalExcluir(false)} className="btn-secondary">Cancelar</button>
              <button type="button" onClick={confirmarExclusao} disabled={excluindo} className="btn-danger">
                {excluindo ? 'Excluindo...' : 'EXCLUIR'}
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  )
}