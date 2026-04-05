'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Layout from '@/components/Layout'

export default function Cadastro() {
  const router = useRouter()
  const [usuario, setUsuario] = useState(null)
  const [form, setForm] = useState({
    nome: '', cpf_cns: '', dt_nasc: '', sexo: '',
    telefone: '', endereco: '', bairro: '', cep: ''
  })
  const [erros, setErros] = useState({})
  const [status, setStatus] = useState({ msg: '', tipo: '' })
  const [salvando, setSalvando] = useState(false)

  useEffect(() => {
    const u = localStorage.getItem('sms_user')
    if (!u) { router.push('/'); return }
    setUsuario(JSON.parse(u))
  }, [])

  function mascaraTelefone(v) {
    let s = v.replace(/\D/g, '').slice(0, 11)
    if (s.length <= 10) s = s.replace(/^(\d{2})(\d{4})(\d{0,4})/, '($1) $2-$3')
    else s = s.replace(/^(\d{2})(\d{5})(\d{0,4})/, '($1) $2-$3')
    return s
  }

  function mascaraCEP(v) {
    let s = v.replace(/\D/g, '').slice(0, 8)
    return s.replace(/^(\d{2})(\d{3})(\d{0,3})/, '$1.$2-$3')
  }

  function mascaraCpfCns(v) {
    let s = v.replace(/\D/g, '')
    if (s.length <= 11) {
      s = s.replace(/^(\d{3})(\d)/, '$1.$2')
      s = s.replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
      s = s.replace(/^(\d{3})\.(\d{3})\.(\d{3})(\d{1,2})/, '$1.$2.$3-$4')
    } else {
      s = s.replace(/\D/g, '').slice(0, 15)
      s = s.replace(/^(\d{3})(\d)/, '$1.$2')
      s = s.replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
      s = s.replace(/^(\d{3})\.(\d{3})\.(\d{3})(\d)/, '$1.$2.$3.$4')
      s = s.replace(/^(\d{3})\.(\d{3})\.(\d{3})\.(\d{3})(\d{1,3})/, '$1.$2.$3.$4.$5')
    }
    return s
  }

  function setField(id, val) {
    setForm(f => ({ ...f, [id]: val }))
    setErros(e => ({ ...e, [id]: '' }))
  }

  function validar() {
    const e = {}
    if (!form.nome.trim()) e.nome = 'Nome obrigatório'
    const doc = form.cpf_cns.replace(/\D/g, '')
    if (doc.length !== 11 && doc.length !== 15) e.cpf_cns = 'Informe CPF (11 dígitos) ou CNS (15 dígitos)'
    if (!form.dt_nasc) e.dt_nasc = 'Data de nascimento obrigatória'
    if (!form.sexo) e.sexo = 'Sexo obrigatório'
    const tel = form.telefone.replace(/\D/g, '')
    if (tel.length < 10 || tel.length > 11) e.telefone = 'Telefone inválido'
    if (!form.endereco.trim()) e.endereco = 'Endereço obrigatório'
    if (!form.bairro.trim()) e.bairro = 'Bairro obrigatório'
    const cep = form.cep.replace(/\D/g, '')
    if (cep.length !== 8) e.cep = 'CEP inválido'
    setErros(e)
    return Object.keys(e).length === 0
  }

  async function salvar(e) {
    e.preventDefault()
    if (!validar()) return
    setSalvando(true)
    setStatus({ msg: '', tipo: '' })

    const cpfLimpo = form.cpf_cns.replace(/\D/g, '')
    const { data: existe } = await supabase
      .from('pacientes').select('id, nome')
      .eq('cpf_cns', cpfLimpo).maybeSingle()

    if (existe) {
      setStatus({ msg: `⚠️ CPF/CNS já cadastrado para: ${existe.nome}`, tipo: 'erro' })
      setSalvando(false)
      return
    }

    const { error } = await supabase.from('pacientes').insert([{
      nome:     form.nome.toUpperCase().trim(),
      cpf_cns:  cpfLimpo,
      dt_nasc:  form.dt_nasc,
      sexo:     form.sexo,
      telefone: form.telefone.replace(/\D/g, ''),
      endereco: form.endereco.toUpperCase().trim(),
      bairro:   form.bairro.toUpperCase().trim(),
      cep:      form.cep.replace(/\D/g, '')
    }])

    if (error) {
      setStatus({ msg: '❌ Erro ao salvar: ' + error.message, tipo: 'erro' })
    } else {
      setStatus({ msg: '✅ Paciente cadastrado com sucesso!', tipo: 'ok' })
      setForm({ nome: '', cpf_cns: '', dt_nasc: '', sexo: '', telefone: '', endereco: '', bairro: '', cep: '' })
      setErros({})
    }
    setSalvando(false)
  }

  const inp = (id) => `input-modern${erros[id] ? ' border-red-400' : ''}`
  const lbl = 'label-modern'

  return (
    <Layout usuario={usuario}>
      <div style={{ padding: '28px', maxWidth: '960px', margin: '0 auto' }}>

        {/* Page Header */}
        <div style={{ marginBottom: '24px' }}>
          <h1 style={{
            fontFamily: 'Sora, sans-serif', fontSize: '22px',
            fontWeight: '700', color: '#0f172a', margin: '0 0 4px'
          }}>Cadastro de Paciente</h1>
          <p style={{ color: '#000000', fontSize: '13px', margin: 0 }}>
            Adicione novos pacientes ao sistema
          </p>
        </div>

        <div className="card" style={{ padding: '28px' }}>
          <form onSubmit={salvar} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

            {/* Nome */}
            <div>
              <label className={lbl}>Nome Completo *</label>
              <input className="input-modern" value={form.nome}
                onChange={e => setField('nome', e.target.value.toUpperCase())}
                placeholder="Nome completo do paciente"
                style={erros.nome ? { borderColor: '#ef4444' } : {}} />
              {erros.nome && <p style={{ color: '#ef4444', fontSize: '11px', margin: '4px 0 0', fontFamily: 'DM Sans' }}>{erros.nome}</p>}
            </div>

            {/* CPF e Data Nasc */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div>
                <label className={lbl}>CPF/CNS *</label>
                <input className="input-modern" value={form.cpf_cns}
                  onChange={e => setField('cpf_cns', mascaraCpfCns(e.target.value))}
                  placeholder="000.000.000-00 ou CNS"
                  style={erros.cpf_cns ? { borderColor: '#ef4444' } : {}} />
                {erros.cpf_cns && <p style={{ color: '#ef4444', fontSize: '11px', margin: '4px 0 0' }}>{erros.cpf_cns}</p>}
              </div>
              <div>
                <label className={lbl}>Data de Nascimento *</label>
                <input type="date" className="input-modern" value={form.dt_nasc}
                  onChange={e => setField('dt_nasc', e.target.value)}
                  style={erros.dt_nasc ? { borderColor: '#ef4444' } : {}} />
                {erros.dt_nasc && <p style={{ color: '#ef4444', fontSize: '11px', margin: '4px 0 0' }}>{erros.dt_nasc}</p>}
              </div>
            </div>

            {/* Sexo e Telefone */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div>
                <label className={lbl}>Sexo *</label>
                <select className="input-modern" value={form.sexo}
                  onChange={e => setField('sexo', e.target.value)}
                  style={erros.sexo ? { borderColor: '#ef4444' } : {}}>
                  <option value="">-- Selecione --</option>
                  <option value="M">Masculino</option>
                  <option value="F">Feminino</option>
                </select>
                {erros.sexo && <p style={{ color: '#ef4444', fontSize: '11px', margin: '4px 0 0' }}>{erros.sexo}</p>}
              </div>
              <div>
                <label className={lbl}>Telefone *</label>
                <input className="input-modern" value={form.telefone}
                  onChange={e => setField('telefone', mascaraTelefone(e.target.value))}
                  placeholder="(63) 99999-9999"
                  style={erros.telefone ? { borderColor: '#ef4444' } : {}} />
                {erros.telefone && <p style={{ color: '#ef4444', fontSize: '11px', margin: '4px 0 0' }}>{erros.telefone}</p>}
              </div>
            </div>

            {/* Endereço e Bairro */}
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '16px' }}>
              <div>
                <label className={lbl}>Endereço *</label>
                <input className="input-modern" value={form.endereco}
                  onChange={e => setField('endereco', e.target.value.toUpperCase())}
                  placeholder="Rua, Avenida..."
                  style={erros.endereco ? { borderColor: '#ef4444' } : {}} />
                {erros.endereco && <p style={{ color: '#ef4444', fontSize: '11px', margin: '4px 0 0' }}>{erros.endereco}</p>}
              </div>
              <div>
                <label className={lbl}>Bairro *</label>
                <input className="input-modern" value={form.bairro}
                  onChange={e => setField('bairro', e.target.value.toUpperCase())}
                  style={erros.bairro ? { borderColor: '#ef4444' } : {}} />
                {erros.bairro && <p style={{ color: '#ef4444', fontSize: '11px', margin: '4px 0 0' }}>{erros.bairro}</p>}
              </div>
            </div>

            {/* CEP */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '16px' }}>
              <div>
                <label className={lbl}>CEP *</label>
                <input className="input-modern" value={form.cep}
                  onChange={e => setField('cep', mascaraCEP(e.target.value))}
                  placeholder="77.305-000"
                  style={erros.cep ? { borderColor: '#ef4444' } : {}} />
                {erros.cep && <p style={{ color: '#ef4444', fontSize: '11px', margin: '4px 0 0' }}>{erros.cep}</p>}
              </div>
            </div>

            {/* Status */}
            {status.msg && (
              <div className={status.tipo === 'ok' ? 'status-ok' : 'status-err'}
                style={{ textAlign: 'center' }}>{status.msg}</div>
            )}

            <div style={{ display: 'flex', justifyContent: 'center' }}>
                <button type="submit" className="btn-primary"
                style={{ background: 'linear-gradient(135deg, #1d4ed8, #3b82f6)', padding: '12px 40px', fontSize: '14px' }}>
                {salvando ? 'Salvando...' : '✓ SALVAR PACIENTE'}
              </button>
            </div>

          </form>
        </div>
      </div>
    </Layout>
  )
}