'use client'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Layout from '@/components/Layout'
import { cabecalhoImpressao } from '@/lib/printHeader'
import { Printer, UserPlus, User, Users, MapPin } from 'lucide-react'

/* ─── IMPRESSÃO ─────────────────────────────────────────────────── */
function gerarHtmlAgendamento(d) {
  const hoje = new Date()
  const dataLocal = `CONCEIÇÃO DO TOCANTINS-TO, ${String(hoje.getDate()).padStart(2, '0')}/${String(hoje.getMonth() + 1).padStart(2, '0')}/${hoje.getFullYear()}`

  function formatarData(v) {
    if (!v) return '-'
    const [a, m, dia] = v.split('-')
    return `${dia}/${m}/${a}`
  }

  function linha(label, valor, colspan = 1) {
    return `<td colspan="${colspan}" style="padding:5px 7px;border:1px solid #000;vertical-align:top;">
      <span style="font-size:9px;font-weight:700;text-transform:uppercase;color:#555;display:block;">${label}</span>
      <span style="font-size:11px;">${valor || '-'}</span>
    </td>`
  }

  const secao = (titulo) => `
    <tr><td colspan="4" style="background:#172554;color:#fff;font-weight:700;font-size:11px;
      text-transform:uppercase;padding:6px 8px;border:1px solid #000;letter-spacing:.5px;">
      ${titulo}
    </td></tr>`

  const acomp1 = (d.nomeA1 || d.acomp1_nome) ? `
    ${secao('Acompanhante 1')}
    <tr>
      ${linha('Nome', d.nomeA1 || d.acomp1_nome, 2)}
      ${linha('CPF/CNS', d.cpfA1 || d.acomp1_cpf)}
      ${linha('Telefone', d.telA1)}
    </tr>
    <tr>
      ${linha('Data Nasc.', formatarData(d.nascA1))}
      ${linha('Sexo', d.sexoA1)}
      ${linha('Endereço', d.endA1, 2)}
    </tr>
    <tr>${linha('Bairro', d.bairA1, 4)}</tr>` : ''

  const acomp2 = (d.nomeA2 || d.acomp2_nome) ? `
    ${secao('Acompanhante 2')}
    <tr>
      ${linha('Nome', d.nomeA2 || d.acomp2_nome, 2)}
      ${linha('CPF/CNS', d.cpfA2 || d.acomp2_cpf)}
      ${linha('Telefone', d.telA2)}
    </tr>
    <tr>
      ${linha('Data Nasc.', formatarData(d.nascA2))}
      ${linha('Sexo', d.sexoA2)}
      ${linha('Endereço', d.endA2, 2)}
    </tr>
    <tr>${linha('Bairro', d.bairA2, 4)}</tr>` : ''

  return `
    <style>
      body { font-family: Arial, sans-serif; font-size: 11px; padding: 14px; color: #000; }
      table { width: 100%; border-collapse: collapse; margin-bottom: 0; }
      @page { size: A4 portrait; margin: 10mm; }
    </style>
    ${cabecalhoImpressao()}
    <h2 style="text-align:center;font-size:14px;font-weight:700;text-transform:uppercase;
      margin:10px 0;letter-spacing:1px;border-bottom:2px solid #172554;padding-bottom:6px;">
      Controle de Viagem
    </h2>
    <table>
      <tr>
        ${linha('Data da Viagem', formatarData(d.data || d.data_viagem), 2)}
        ${linha('Hora', d.hora, 2)}
      </tr>
      ${secao('Dados do Paciente')}
      <tr>
        ${linha('Nome do Paciente', d.nome || d.paciente_nome, 2)}
        ${linha('CPF/CNS', d.cpf || d.paciente_cpf)}
        ${linha('Telefone', d.telefone)}
      </tr>
      <tr>
        ${linha('Data Nasc.', formatarData(d.dtNasc))}
        ${linha('Idade', d.idade)}
        ${linha('Sexo', d.sexo)}
        ${linha('CEP', d.cep)}
      </tr>
      <tr>
        ${linha('Endereço', d.endereco, 2)}
        ${linha('Bairro', d.bairro, 2)}
      </tr>
      <tr>
        ${linha('Tipo de Viagem', d.tipoViagem || d.tipo_viagem)}
        ${linha('Acompanhante?', d.temAcomp || d.tem_acomp, 3)}
      </tr>
      ${acomp1}
      ${acomp2}
      ${secao('Destino e Motivo')}
      <tr>
        ${linha('Destino', d.destino)}
        ${linha('Local', d.local || d.local_destino)}
        ${linha('Motivo', d.motivo)}
        ${linha('Agendado por', d.agendadoPor || d.agendado_por)}
      </tr>
    </table>
    <div style="margin-top:24px;text-align:center;font-size:11px;font-weight:600;">
      <p style="margin:0 0 40px;">${dataLocal}</p>
      <div style="border-top:1px solid #000;width:260px;margin:0 auto;padding-top:4px;">
        ASSINATURA
      </div>
    </div>
  `
}

function imprimirAgendamento(dados) {
  const janela = window.open('', '_blank')
  janela.document.open()
  janela.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Controle de Viagem</title></head><body>${gerarHtmlAgendamento(dados)}</body></html>`)
  janela.document.close()
  setTimeout(() => janela.print(), 300)
}

/* ─── COMPONENTE PRINCIPAL ──────────────────────────────────────── */
export default function Agendamento() {
  const router = useRouter()
  const [usuario, setUsuario] = useState(null)
  const [pacientes, setPacientes] = useState([])
  const [busca, setBusca] = useState('')
  const [form, setForm] = useState({
    data: '', hora: '', nome: '', cpf: '', dtNasc: '', idade: '', sexo: '',
    telefone: '', endereco: '', bairro: '', cep: '',
    temAcomp: '', nomeA1: '', cpfA1: '', nascA1: '', sexoA1: '', telA1: '', endA1: '', bairA1: '',
    nomeA2: '', cpfA2: '', nascA2: '', sexoA2: '', telA2: '', endA2: '', bairA2: '',
    destino: '', local: '', motivo: '', tipoViagem: '', agendadoPor: ''
  })
  const [status, setStatus] = useState({ msg: '', tipo: '' })
  const [salvando, setSalvando] = useState(false)
  const [ultimoAgendamento, setUltimoAgendamento] = useState(null)
  const [pacienteSelecionado, setPacienteSelecionado] = useState(false)
  const skipBuscaRef  = useRef(false)
  const skipBuscaA1Ref = useRef(false)
  const skipBuscaA2Ref = useRef(false)

  // Busca acompanhantes
  const [buscaA1, setBuscaA1] = useState('')
  const [sugestoesA1, setSugestoesA1] = useState([])
  const [buscaA2, setBuscaA2] = useState('')
  const [sugestoesA2, setSugestoesA2] = useState([])

  // Reimprimir
  const [modalReimprimir, setModalReimprimir] = useState(false)
  const [buscaRe, setBuscaRe] = useState('')
  const [dataRe, setDataRe] = useState('')
  const [resultadosRe, setResultadosRe] = useState([])
  const [buscandoRe, setBuscandoRe] = useState(false)

  useEffect(() => {
    const u = localStorage.getItem('sms_user')
    if (!u) { router.push('/'); return }
    const parsed = JSON.parse(u)
    setUsuario(parsed)
    const primeiroNome = (parsed.nome || '').split(' ')[0].toUpperCase()
    if (primeiroNome) setForm(f => ({ ...f, agendadoPor: primeiroNome }))
  }, [])

  useEffect(() => {
    if (skipBuscaRef.current) { skipBuscaRef.current = false; return }
    if (busca.length < 3) { setPacientes([]); return }
    const timer = setTimeout(async () => {
      const termoBusca = busca.replace(/\D/g, '')
      let query = supabase.from('pacientes').select('*').limit(10)
      if (termoBusca.length >= 3 && termoBusca === busca.replace(/\s/g, '')) {
        query = query.ilike('cpf_cns', `%${termoBusca}%`)
      } else {
        query = query.ilike('nome', `%${busca.toUpperCase()}%`)
      }
      const { data } = await query
      setPacientes(data || [])
    }, 300)
    return () => clearTimeout(timer)
  }, [busca])

  useEffect(() => {
    if (skipBuscaA1Ref.current) { skipBuscaA1Ref.current = false; return }
    if (buscaA1.length < 3) { setSugestoesA1([]); return }
    const timer = setTimeout(async () => {
      const soDigitos = buscaA1.replace(/\D/g, '')
      let query = supabase.from('pacientes').select('*').limit(8)
      if (soDigitos.length >= 3 && soDigitos === buscaA1.replace(/\s/g, '')) {
        query = query.ilike('cpf_cns', `%${soDigitos}%`)
      } else {
        query = query.ilike('nome', `%${buscaA1.toUpperCase()}%`)
      }
      const { data } = await query
      setSugestoesA1(data || [])
    }, 300)
    return () => clearTimeout(timer)
  }, [buscaA1])

  useEffect(() => {
    if (skipBuscaA2Ref.current) { skipBuscaA2Ref.current = false; return }
    if (buscaA2.length < 3) { setSugestoesA2([]); return }
    const timer = setTimeout(async () => {
      const soDigitos = buscaA2.replace(/\D/g, '')
      let query = supabase.from('pacientes').select('*').limit(8)
      if (soDigitos.length >= 3 && soDigitos === buscaA2.replace(/\s/g, '')) {
        query = query.ilike('cpf_cns', `%${soDigitos}%`)
      } else {
        query = query.ilike('nome', `%${buscaA2.toUpperCase()}%`)
      }
      const { data } = await query
      setSugestoesA2(data || [])
    }, 300)
    return () => clearTimeout(timer)
  }, [buscaA2])

  useEffect(() => {
    if (!modalReimprimir) return
    if (buscaRe.length < 3 && !dataRe) { setResultadosRe([]); return }
    const timer = setTimeout(() => buscarParaReimprimir(), 400)
    return () => clearTimeout(timer)
  }, [buscaRe, dataRe, modalReimprimir])

  function calcularIdade(dtNasc) {
    if (!dtNasc) return ''
    const nasc = new Date(dtNasc)
    const hoje = new Date()
    let idade = hoje.getFullYear() - nasc.getFullYear()
    const m = hoje.getMonth() - nasc.getMonth()
    if (m < 0 || (m === 0 && hoje.getDate() < nasc.getDate())) idade--
    return idade >= 0 ? String(idade) : ''
  }

  function selecionarPaciente(p) {
    skipBuscaRef.current = true
    setForm(f => ({
      ...f,
      nome: p.nome, cpf: p.cpf_cns,
      dtNasc: p.dt_nasc || '', idade: calcularIdade(p.dt_nasc),
      sexo: p.sexo || '', telefone: p.telefone || '',
      endereco: p.endereco || '', bairro: p.bairro || '', cep: p.cep || ''
    }))
    setBusca(p.nome)
    setPacientes([])
    setPacienteSelecionado(true)
  }

  function selecionarAcomp1(p) {
    skipBuscaA1Ref.current = true
    setForm(f => ({
      ...f,
      nomeA1: p.nome, cpfA1: p.cpf_cns,
      nascA1: p.dt_nasc || '', sexoA1: p.sexo || '',
      telA1: p.telefone || '', endA1: p.endereco || '', bairA1: p.bairro || ''
    }))
    setBuscaA1(p.nome)
    setSugestoesA1([])
  }

  function selecionarAcomp2(p) {
    skipBuscaA2Ref.current = true
    setForm(f => ({
      ...f,
      nomeA2: p.nome, cpfA2: p.cpf_cns,
      nascA2: p.dt_nasc || '', sexoA2: p.sexo || '',
      telA2: p.telefone || '', endA2: p.endereco || '', bairA2: p.bairro || ''
    }))
    setBuscaA2(p.nome)
    setSugestoesA2([])
  }

  function setField(id, val) {
    setForm(f => {
      const novo = { ...f, [id]: val }
      if (id === 'dtNasc') novo.idade = calcularIdade(val)
      return novo
    })
  }

  const FORM_VAZIO = {
    data: '', hora: '', nome: '', cpf: '', dtNasc: '', idade: '', sexo: '',
    telefone: '', endereco: '', bairro: '', cep: '', temAcomp: '',
    nomeA1: '', cpfA1: '', nascA1: '', sexoA1: '', telA1: '', endA1: '', bairA1: '',
    nomeA2: '', cpfA2: '', nascA2: '', sexoA2: '', telA2: '', endA2: '', bairA2: '',
    destino: '', local: '', motivo: '', tipoViagem: '', agendadoPor: ''
  }

  async function salvar(e) {
    e.preventDefault()
    if (!pacienteSelecionado || !form.nome) {
      setStatus({ msg: 'Selecione um paciente cadastrado na lista antes de agendar.', tipo: 'erro' })
      return
    }
    const faltando = []
    // Dados do paciente
    if (!form.cpf)      faltando.push('CPF/CNS do paciente')
    if (!form.dtNasc)   faltando.push('Data de nascimento')
    if (!form.sexo)     faltando.push('Sexo')
    if (!form.telefone) faltando.push('Telefone')
    if (!form.endereco) faltando.push('Endereço')
    if (!form.bairro)   faltando.push('Bairro')
    // Viagem
    if (!form.tipoViagem) faltando.push('Tipo de Viagem')
    if (!form.temAcomp)   faltando.push('Acompanhante?')
    if (!form.destino)    faltando.push('Destino')
    if (!form.local)      faltando.push('Local')
    if (!form.motivo)     faltando.push('Motivo')
    // Acompanhante 1 (se houver)
    if (form.temAcomp === 'SIM' && form.nomeA1) {
      if (!form.cpfA1)   faltando.push('CPF/CNS do Acompanhante 1')
      if (!form.nascA1)  faltando.push('Data nasc. do Acompanhante 1')
      if (!form.sexoA1)  faltando.push('Sexo do Acompanhante 1')
      if (!form.telA1)   faltando.push('Telefone do Acompanhante 1')
      if (!form.endA1)   faltando.push('Endereço do Acompanhante 1')
    }
    // Acompanhante 2 (se houver)
    if (form.temAcomp === 'SIM' && form.nomeA2) {
      if (!form.cpfA2)   faltando.push('CPF/CNS do Acompanhante 2')
      if (!form.nascA2)  faltando.push('Data nasc. do Acompanhante 2')
      if (!form.sexoA2)  faltando.push('Sexo do Acompanhante 2')
      if (!form.telA2)   faltando.push('Telefone do Acompanhante 2')
      if (!form.endA2)   faltando.push('Endereço do Acompanhante 2')
    }
    if (faltando.length > 0) {
      setStatus({ msg: `Campos obrigatórios incompletos: ${faltando.join(', ')}`, tipo: 'erro' })
      return
    }

    if (form.temAcomp === 'SIM' && form.nomeA1) {
      const i1 = Number(calcularIdade(form.nascA1))
      if (i1 < 18 || i1 >= 60) {
        setStatus({ msg: `O Acompanhante 1 (${form.nomeA1}) tem ${i1} anos. O sistema exige entre 18 e 59 anos.`, tipo: 'erro' })
        return
      }
    }

    if (form.temAcomp === 'SIM' && form.nomeA2) {
      const i2 = Number(calcularIdade(form.nascA2))
      if (i2 < 18 || i2 >= 60) {
        setStatus({ msg: `O Acompanhante 2 (${form.nomeA2}) tem ${i2} anos. O sistema exige entre 18 e 59 anos.`, tipo: 'erro' })
        return
      }
    }
    setSalvando(true)
    setStatus({ msg: '', tipo: '' })
    setUltimoAgendamento(null)
    const { error } = await supabase.from('viagens').insert([{
      data_viagem: form.data, hora: form.hora,
      paciente_nome: form.nome, paciente_cpf: form.cpf,
      tem_acomp: form.temAcomp,
      acomp1_nome: form.nomeA1, acomp1_cpf: form.cpfA1,
      acomp2_nome: form.nomeA2, acomp2_cpf: form.cpfA2,
      destino: form.destino, local_destino: form.local,
      motivo: form.motivo, tipo_viagem: form.tipoViagem,
      agendado_por: form.agendadoPor,
      competencia: form.data ? form.data.substring(5, 7) + '/' + form.data.substring(0, 4) : ''
    }])
    if (error) {
      setStatus({ msg: 'Erro: ' + error.message, tipo: 'erro' })
    } else {
      setUltimoAgendamento({ ...form })
      setStatus({ msg: 'Viagem agendada com sucesso!', tipo: 'ok' })
      setForm(FORM_VAZIO)
      setBusca('')
      setPacienteSelecionado(false)
    }
    setSalvando(false)
  }

  async function buscarParaReimprimir() {
    if (!buscaRe && !dataRe) return
    setBuscandoRe(true)
    let query = supabase.from('viagens').select('*').order('data_viagem', { ascending: false }).limit(20)
    if (buscaRe) query = query.ilike('paciente_nome', `%${buscaRe.toUpperCase()}%`)
    if (dataRe) query = query.eq('data_viagem', dataRe)
    const { data } = await query
    setResultadosRe(data || [])
    setBuscandoRe(false)
  }

  async function reimprimirViagem(viagem) {
    // CPFs a buscar
    const cpfs = [viagem.paciente_cpf, viagem.acomp1_cpf, viagem.acomp2_cpf].filter(Boolean)
    let mapa = {}
    if (cpfs.length > 0) {
      const { data: pacs } = await supabase.from('pacientes').select('*').in('cpf_cns', cpfs)
      if (pacs) pacs.forEach(p => { mapa[p.cpf_cns] = p })
    }

    const pac = mapa[viagem.paciente_cpf] || {}
    const a1 = mapa[viagem.acomp1_cpf] || {}
    const a2 = mapa[viagem.acomp2_cpf] || {}

    imprimirAgendamento({
      ...viagem,
      // paciente
      dtNasc: pac.dt_nasc, idade: calcularIdade(pac.dt_nasc),
      sexo: pac.sexo, telefone: pac.telefone,
      endereco: pac.endereco, bairro: pac.bairro, cep: pac.cep,
      // acompanhante 1
      nascA1: a1.dt_nasc, sexoA1: a1.sexo, telA1: a1.telefone, endA1: a1.endereco, bairA1: a1.bairro,
      // acompanhante 2
      nascA2: a2.dt_nasc, sexoA2: a2.sexo, telA2: a2.telefone, endA2: a2.endereco, bairA2: a2.bairro,
    })
    setModalReimprimir(false)
  }

  function formatarDataBr(v) {
    if (!v) return '-'
    const [a, m, d] = v.split('-')
    return `${d}/${m}/${a}`
  }

  const inp = "input-modern"
  const lbl = "label-modern"
  const hoje = new Date()
  const dataHoje = `CONCEIÇÃO DO TOCANTINS-TO, ${String(hoje.getDate()).padStart(2, '0')}/${String(hoje.getMonth() + 1).padStart(2, '0')}/${hoje.getFullYear()}`

  const SectionHeader = ({ title, Icon }) => (
    <div style={{
      background: 'linear-gradient(135deg, #172554, #1e3a8a)',
      color: 'white', padding: '10px 16px', borderRadius: '10px',
      fontFamily: 'Sora, sans-serif', fontWeight: '600', fontSize: '13px',
      display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px'
    }}>
      {Icon && <Icon size={14} />} {title}
    </div>
  )

  return (
    <Layout usuario={usuario}>
      <div style={{ padding: '28px', maxWidth: '960px', margin: '0 auto' }}>

        {/* Page Header */}
        <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px' }}>
          <div>
            <h1 style={{ fontFamily: 'Sora, sans-serif', fontSize: '22px', fontWeight: '700', color: '#000000', margin: '0 0 4px' }}>
              Controle de Viagem
            </h1>
            <p style={{ color: '#000000', fontSize: '13px', margin: 0 }}>Agende e gerencie as viagens dos pacientes</p>
          </div>
          <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
            <button onClick={() => { setModalReimprimir(true); setBuscaRe(''); setDataRe(''); setResultadosRe([]) }}
              style={{
                padding: '9px 16px', background: 'linear-gradient(135deg, #172554, #1e3a8a)',
                border: 'none', borderRadius: '10px', fontSize: '13px', color: 'white',
                cursor: 'pointer', fontFamily: 'Sora, sans-serif', fontWeight: '600',
                boxShadow: '0 4px 12px rgba(0,0,0,0.2)', whiteSpace: 'nowrap',
                display: 'flex', alignItems: 'center', gap: '6px'
              }}>
              <Printer size={14} /> Reimprimir
            </button>
            <button onClick={() => router.push('/cadastro')}
              style={{
                padding: '9px 16px', background: 'linear-gradient(135deg, #172554, #1e3a8a)',
                border: 'none', borderRadius: '10px', fontSize: '13px', color: 'white',
                cursor: 'pointer', fontFamily: 'Sora, sans-serif', fontWeight: '600',
                boxShadow: '0 4px 12px rgba(23,37,84,0.3)', whiteSpace: 'nowrap',
                display: 'flex', alignItems: 'center', gap: '6px'
              }}>
              <UserPlus size={14} /> Novo Paciente
            </button>
          </div>
        </div>

        <div className="card" style={{ padding: '28px' }}>
          <form onSubmit={salvar} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

            {/* Data e Hora */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div>
                <label className={lbl}>Data da Viagem *</label>
                <input type="date" className={inp} value={form.data}
                  onChange={e => setField('data', e.target.value)} required />
              </div>
              <div>
                <label className={lbl}>Hora *</label>
                <select className={inp} value={form.hora} onChange={e => setField('hora', e.target.value)}>
                  <option value="">--:--</option>
                  {['06:00', '06:30', '07:00', '07:30', '08:00', '08:30', '09:00', '09:30',
                    '10:00', '10:30', '11:00', '11:30', '12:00', '12:30', '13:00', '13:30',
                    '14:00', '14:30', '15:00', '15:30', '16:00', '16:30', '17:00', '17:30', '18:00']
                    .map(h => <option key={h} value={h}>{h}</option>)}
                </select>
              </div>
            </div>

            <SectionHeader title="Dados do Paciente" Icon={User} />

            {/* Busca */}
            <div style={{ position: 'relative' }}>
              <label className={lbl}>Nome do Paciente *</label>
              <input className={inp} value={busca}
                onChange={e => {
                  setBusca(e.target.value)
                  if (pacienteSelecionado) {
                    setPacienteSelecionado(false)
                    setForm(f => ({ ...f, nome: '', cpf: '', dtNasc: '', idade: '', sexo: '', telefone: '', endereco: '', bairro: '', cep: '' }))
                  }
                }}
                placeholder="Digite nome ou CPF/CNS para buscar..." required />
              {pacientes.length > 0 && (
                <div className="search-dropdown">
                  {pacientes.map(p => (
                    <button key={p.id} type="button" className="search-item"
                      onClick={() => selecionarPaciente(p)}>
                      <strong>{p.nome}</strong> — {p.cpf_cns}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* CPF | Telefone | Sexo */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
              <div><label className={lbl}>CPF/CNS</label>
                <input className={inp} value={form.cpf} readOnly style={{ background: '#f8fafc', cursor: 'not-allowed' }} /></div>
              <div><label className={lbl}>Telefone</label>
                <input className={inp} value={form.telefone} readOnly style={{ background: '#f8fafc', cursor: 'not-allowed' }} /></div>
              <div><label className={lbl}>Sexo</label>
                <input className={inp} value={form.sexo === 'M' ? 'Masculino' : form.sexo === 'F' ? 'Feminino' : ''} readOnly style={{ background: '#f8fafc', cursor: 'not-allowed' }} />
              </div>
            </div>

            {/* Nasc | Idade | Endereço | Bairro */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 2fr 1fr', gap: '12px' }}>
              <div><label className={lbl}>Data Nasc.</label>
                <input className={inp} value={form.dtNasc ? new Date(form.dtNasc + 'T12:00:00').toLocaleDateString('pt-BR') : ''} readOnly style={{ background: '#f8fafc', cursor: 'not-allowed' }} /></div>
              <div><label className={lbl}>Idade</label>
                <input className={inp} value={form.idade} readOnly style={{ background: '#f8fafc', cursor: 'not-allowed' }} /></div>
              <div><label className={lbl}>Endereço</label>
                <input className={inp} value={form.endereco} readOnly style={{ background: '#f8fafc', cursor: 'not-allowed' }} /></div>
              <div><label className={lbl}>Bairro</label>
                <input className={inp} value={form.bairro} readOnly style={{ background: '#f8fafc', cursor: 'not-allowed' }} /></div>
            </div>

            {/* Tipo Viagem | Acompanhante */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div><label className={lbl}>Tipo de Viagem *</label>
                <select className={inp} value={form.tipoViagem} onChange={e => setField('tipoViagem', e.target.value)}>
                  <option value="">-- Selecione --</option>
                  {['IDA E VOLTA', 'SÓ IDA', 'SÓ VOLTA'].map(o => <option key={o} value={o}>{o}</option>)}
                </select></div>
              <div><label className={lbl}>Acompanhante?</label>
                <select className={inp} value={form.temAcomp} onChange={e => setField('temAcomp', e.target.value)}>
                  <option value="">-- Selecione --</option>
                  <option value="SIM">SIM</option>
                  <option value="NÃO">NÃO</option>
                </select></div>
            </div>

            {/* Acompanhantes */}
            {form.temAcomp === 'SIM' && (
              <>
                <SectionHeader title="Acompanhante 1" Icon={Users} />
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '12px' }}>
                  <div style={{ position: 'relative' }}>
                    <label className={lbl}>Nome</label>
                    <input className={inp} value={buscaA1}
                      onChange={e => {
                        setBuscaA1(e.target.value)
                        setForm(f => ({ ...f, nomeA1: '', cpfA1: '', nascA1: '', sexoA1: '', telA1: '', endA1: '', bairA1: '' }))
                      }}
                      placeholder="Digite nome ou CPF/CNS para buscar..." />
                    {sugestoesA1.length > 0 && (
                      <div className="search-dropdown">
                        {sugestoesA1.map(p => (
                          <button key={p.id} type="button" className="search-item"
                            onClick={() => selecionarAcomp1(p)}>
                            <strong>{p.nome}</strong> — {p.cpf_cns}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <div><label className={lbl}>CPF/CNS</label>
                    <input className={inp} value={form.cpfA1} readOnly style={{ background: '#f8fafc', cursor: 'not-allowed' }} /></div>
                  <div><label className={lbl}>Telefone</label>
                    <input className={inp} value={form.telA1} readOnly style={{ background: '#f8fafc', cursor: 'not-allowed' }} /></div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 2fr', gap: '12px' }}>
                  <div><label className={lbl}>Data Nasc.</label>
                    <input className={inp} value={form.nascA1 ? new Date(form.nascA1 + 'T12:00:00').toLocaleDateString('pt-BR') : ''} readOnly style={{ background: '#f8fafc', cursor: 'not-allowed' }} /></div>
                  <div><label className={lbl}>Sexo</label>
                    <input className={inp} value={form.sexoA1 === 'M' ? 'Masculino' : form.sexoA1 === 'F' ? 'Feminino' : ''} readOnly style={{ background: '#f8fafc', cursor: 'not-allowed' }} /></div>
                  <div><label className={lbl}>Endereço</label>
                    <input className={inp} value={form.endA1} readOnly style={{ background: '#f8fafc', cursor: 'not-allowed' }} /></div>
                </div>

                <SectionHeader title="Acompanhante 2" Icon={Users} />
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '12px' }}>
                  <div style={{ position: 'relative' }}>
                    <label className={lbl}>Nome</label>
                    <input className={inp} value={buscaA2}
                      onChange={e => {
                        setBuscaA2(e.target.value)
                        setForm(f => ({ ...f, nomeA2: '', cpfA2: '', nascA2: '', sexoA2: '', telA2: '', endA2: '', bairA2: '' }))
                      }}
                      placeholder="Digite nome ou CPF/CNS para buscar..." />
                    {sugestoesA2.length > 0 && (
                      <div className="search-dropdown">
                        {sugestoesA2.map(p => (
                          <button key={p.id} type="button" className="search-item"
                            onClick={() => selecionarAcomp2(p)}>
                            <strong>{p.nome}</strong> — {p.cpf_cns}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <div><label className={lbl}>CPF/CNS</label>
                    <input className={inp} value={form.cpfA2} readOnly style={{ background: '#f8fafc', cursor: 'not-allowed' }} /></div>
                  <div><label className={lbl}>Telefone</label>
                    <input className={inp} value={form.telA2} readOnly style={{ background: '#f8fafc', cursor: 'not-allowed' }} /></div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 2fr', gap: '12px' }}>
                  <div><label className={lbl}>Data Nasc.</label>
                    <input className={inp} value={form.nascA2 ? new Date(form.nascA2 + 'T12:00:00').toLocaleDateString('pt-BR') : ''} readOnly style={{ background: '#f8fafc', cursor: 'not-allowed' }} /></div>
                  <div><label className={lbl}>Sexo</label>
                    <input className={inp} value={form.sexoA2 === 'M' ? 'Masculino' : form.sexoA2 === 'F' ? 'Feminino' : ''} readOnly style={{ background: '#f8fafc', cursor: 'not-allowed' }} /></div>
                  <div><label className={lbl}>Endereço</label>
                    <input className={inp} value={form.endA2} readOnly style={{ background: '#f8fafc', cursor: 'not-allowed' }} /></div>
                </div>
              </>
            )}

            <SectionHeader title="Destino e Motivo" Icon={MapPin} />

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '12px' }}>
              <div><label className={lbl}>Destino *</label>
                <select className={inp} value={form.destino} onChange={e => setField('destino', e.target.value)}>
                  <option value="">-- Selecione --</option>
                  {['CONCEIÇÃO/PALMAS', 'CONCEIÇÃO/PALMAS - CARRO', 'PALMAS/CONCEIÇÃO', 'PALMAS/CONCEIÇÃO - CARRO',
                    'CONCEIÇÃO/PORTO NACIONAL', 'CONCEIÇÃO/PORTO NACIONAL - CARRO', 'PORTO NACIONAL/CONCEIÇÃO',
                    'PORTO NACIONAL/CONCEIÇÃO - CARRO', 'CONCEIÇÃO/ARRAIAS', 'ARRAIAS/CONCEIÇÃO',
                    'CONCEIÇÃO/DIANÓPOLIS', 'DIANÓPOLIS/CONCEIÇÃO', 'CONCEIÇÃO/CAMPOS BELOS', 'CONCEIÇÃO/GURUPI']
                    .map(o => <option key={o} value={o}>{o}</option>)}
                </select></div>
              <div><label className={lbl}>Local *</label>
                <input className={inp} value={form.local}
                  onChange={e => setField('local', e.target.value.toUpperCase())} required /></div>
              <div><label className={lbl}>Motivo *</label>
                <select className={inp} value={form.motivo} onChange={e => setField('motivo', e.target.value)}>
                  <option value="">-- Selecione --</option>
                  {['CONSULTA', 'EXAME', 'CIRURGIA - INTERNAÇÃO', 'RETORNO CIR. - PÓS OP',
                    'PERÍCIA MÉDICA', 'ALTA HOSPITALAR', 'CAPACITAÇÃO', 'ESTUDANTE', 'SÓ RETORNO']
                    .map(o => <option key={o} value={o}>{o}</option>)}
                </select></div>
              <div><label className={lbl}>Agendado por</label>
                <input className={inp} value={form.agendadoPor} readOnly style={{ background: '#f8fafc', cursor: 'not-allowed' }} /></div>
            </div>

            <p style={{ textAlign: 'center', fontSize: '12px', fontWeight: '600', color: '#000000' }}>{dataHoje}</p>

            {status.msg && (
              <div className={status.tipo === 'ok' ? 'status-ok' : 'status-err'}
                style={{ textAlign: 'center' }}>{status.msg}</div>
            )}

            <div style={{ display: 'flex', justifyContent: 'center', gap: '12px' }}>
              <button type="submit" disabled={salvando} className="btn-primary"
                style={{ background: 'linear-gradient(135deg, #172554, #1e3a8a)', padding: '12px 40px', fontSize: '14px' }}>
                {salvando ? 'Salvando...' : '✓ GRAVAR NO SISTEMA'}
              </button>
              {ultimoAgendamento && (
                <button type="button" onClick={() => imprimirAgendamento(ultimoAgendamento)}
                  style={{
                    padding: '12px 28px', background: 'linear-gradient(135deg, #b45309, #f59e0b)',
                    border: 'none', borderRadius: '10px', color: 'white', fontSize: '14px',
                    fontWeight: '700', cursor: 'pointer', fontFamily: 'Sora, sans-serif',
                    boxShadow: '0 4px 12px rgba(180,83,9,0.3)',
                    display: 'flex', alignItems: 'center', gap: '6px'
                  }}>
                  <Printer size={14} /> IMPRIMIR
                </button>
              )}
            </div>

          </form>
        </div>
      </div>

      {/* MODAL REIMPRIMIR */}
      {modalReimprimir && (
        <div className="modal-overlay">
          <div className="modal-card" style={{ maxWidth: '560px' }}>
            <h2 style={{ fontFamily: 'Sora, sans-serif', fontSize: '16px', fontWeight: '700', color: '#0f172a', margin: '0 0 4px' }}>
              <Printer size={16} style={{ display: 'inline', marginRight: '6px' }} /> Reimprimir Agendamento
            </h2>
            <p style={{ color: '#64748b', fontSize: '13px', margin: '0 0 16px' }}>Busque pelo nome do paciente ou data da viagem — os resultados aparecem automaticamente.</p>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '16px' }}>
              <div>
                <label className={lbl}>Nome do paciente</label>
                <input className={inp} value={buscaRe}
                  onChange={e => setBuscaRe(e.target.value)}
                  placeholder="Mínimo 3 letras..." />
              </div>
              <div>
                <label className={lbl}>Data da viagem</label>
                <input type="date" className={inp} value={dataRe}
                  onChange={e => setDataRe(e.target.value)} />
              </div>
            </div>

            {resultadosRe.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '320px', overflowY: 'auto' }}>
                {resultadosRe.map(v => (
                  <div key={v.id} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '10px 14px', background: '#f8fafc', borderRadius: '10px',
                    border: '1px solid #e2e8f0', gap: '12px'
                  }}>
                    <div style={{ minWidth: 0 }}>
                      <p style={{ fontSize: '13px', fontWeight: '600', color: '#1e293b', margin: 0, fontFamily: 'DM Sans, sans-serif' }}>
                        {v.paciente_nome}
                      </p>
                      <p style={{ fontSize: '11px', color: '#64748b', margin: 0, fontFamily: 'DM Sans, sans-serif' }}>
                        {formatarDataBr(v.data_viagem)} · {v.hora || '-'} · {v.destino}
                      </p>
                    </div>
                    <button onClick={() => reimprimirViagem(v)}
                      style={{
                        padding: '6px 14px', background: 'linear-gradient(135deg, #172554, #1e3a8a)',
                        border: 'none', borderRadius: '8px', color: 'white', fontSize: '12px',
                        fontWeight: '600', cursor: 'pointer', whiteSpace: 'nowrap',
                        display: 'flex', alignItems: 'center', gap: '5px'
                      }}>
                      <Printer size={12} /> Imprimir
                    </button>
                  </div>
                ))}
              </div>
            )}

            {resultadosRe.length === 0 && (buscaRe || dataRe) && !buscandoRe && (
              <p style={{ color: '#94a3b8', fontSize: '13px', fontFamily: 'DM Sans, sans-serif', textAlign: 'center', margin: '8px 0' }}>
                Nenhum resultado encontrado.
              </p>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px' }}>
              <button onClick={() => setModalReimprimir(false)} className="btn-secondary">Fechar</button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  )
}
