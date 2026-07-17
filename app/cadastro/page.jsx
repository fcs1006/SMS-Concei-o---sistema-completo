'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase, accentInsensitivePattern } from '@/lib/supabase'
import Layout from '@/components/Layout'
import { Upload, X } from 'lucide-react'

const FORM_INICIAL = {
  nome: '',
  cpf_cns: '',
  dt_nasc: '',
  sexo: '',
  telefone: '',
  endereco: '',
  bairro: '',
  cep: ''
}

function mascaraTelefone(v) {
  let s = String(v || '').replace(/\D/g, '').slice(0, 11)
  if (s.length <= 10) s = s.replace(/^(\d{2})(\d{4})(\d{0,4})/, '($1) $2-$3')
  else s = s.replace(/^(\d{2})(\d{5})(\d{0,4})/, '($1) $2-$3')
  return s.trim().replace(/-$/, '')
}

function mascaraCEP(v) {
  const s = String(v || '').replace(/\D/g, '').slice(0, 8)
  return s.replace(/^(\d{2})(\d{3})(\d{0,3})/, '$1.$2-$3').replace(/-$/, '')
}

function mascaraCpfCns(v) {
  let s = String(v || '').replace(/\D/g, '')
  if (s.length <= 11) {
    s = s.replace(/^(\d{3})(\d)/, '$1.$2')
    s = s.replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
    s = s.replace(/^(\d{3})\.(\d{3})\.(\d{3})(\d{1,2})/, '$1.$2.$3-$4')
  } else {
    s = s.slice(0, 15)
    s = s.replace(/^(\d{3})(\d)/, '$1.$2')
    s = s.replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
    s = s.replace(/^(\d{3})\.(\d{3})\.(\d{3})(\d)/, '$1.$2.$3.$4')
    s = s.replace(/^(\d{3})\.(\d{3})\.(\d{3})\.(\d{3})(\d{1,3})/, '$1.$2.$3.$4.$5')
  }
  return s
}

function normalizarDocumento(v) {
  return String(v || '').replace(/\D/g, '')
}

function formatarCpfCns(v) {
  return mascaraCpfCns(normalizarDocumento(v))
}

function formatarDataBr(v) {
  if (!v) return '-'
  const [ano, mes, dia] = String(v).split('-')
  if (!ano || !mes || !dia) return v
  return `${dia}/${mes}/${ano}`
}

function montarFormularioPaciente(paciente) {
  return {
    nome: String(paciente.nome || ''),
    cpf_cns: formatarCpfCns(paciente.cpf_cns || ''),
    dt_nasc: String(paciente.dt_nasc || ''),
    sexo: String(paciente.sexo || ''),
    telefone: mascaraTelefone(paciente.telefone || ''),
    endereco: String(paciente.endereco || ''),
    bairro: String(paciente.bairro || ''),
    cep: mascaraCEP(paciente.cep || '')
  }
}

function camposPendentes(paciente) {
  const faltando = []
  if (!paciente.dt_nasc) faltando.push('data nasc.')
  if (!paciente.sexo) faltando.push('sexo')
  if (!paciente.telefone) faltando.push('telefone')
  if (!paciente.endereco) faltando.push('endereço')
  if (!paciente.bairro) faltando.push('bairro')
  if (!paciente.cep) faltando.push('cep')
  return faltando
}

export default function Cadastro() {
  const router = useRouter()
  const [usuario, setUsuario] = useState(null)
  const [form, setForm] = useState(FORM_INICIAL)
  const [erros, setErros] = useState({})
  const [status, setStatus] = useState({ msg: '', tipo: '' })
  const [salvando, setSalvando] = useState(false)
  const [pacientes, setPacientes] = useState([])
  const [busca, setBusca] = useState('')
  const [carregandoLista, setCarregandoLista] = useState(false)
  const [editandoId, setEditandoId] = useState(null)
  const [excluindo, setExcluindo] = useState(null)
  
  // Importação e-SUS
  const [modalImportar, setModalImportar] = useState(false)
  const [arqImportacao, setArqImportacao] = useState(null)
  const [importando, setImportando] = useState(false)
  const [sobrescreverTelefones, setSobrescreverTelefones] = useState(false)
  const [progressImportacao, setProgressImportacao] = useState({ atual: 0, total: 0 })

  function setField(id, val) {
    setForm(f => ({ ...f, [id]: val }))
    setErros(e => ({ ...e, [id]: '' }))
  }

  function limparFormulario() {
    setForm(FORM_INICIAL)
    setErros({})
    setEditandoId(null)
  }

  function validar() {
    const e = {}
    if (!form.nome.trim()) e.nome = 'Nome obrigatório'

    const doc = normalizarDocumento(form.cpf_cns)
    if (doc.length !== 11 && doc.length !== 15) e.cpf_cns = 'Informe CPF (11 dígitos) ou CNS (15 dígitos)'

    if (!form.dt_nasc) e.dt_nasc = 'Data de nascimento obrigatória'
    if (!form.sexo) e.sexo = 'Sexo obrigatório'

    const tel = normalizarDocumento(form.telefone)
    if (tel.length < 10 || tel.length > 11) e.telefone = 'Telefone inválido'

    if (!form.endereco.trim()) e.endereco = 'Endereço obrigatório'
    if (!form.bairro.trim()) e.bairro = 'Bairro obrigatório'

    const cep = normalizarDocumento(form.cep)
    if (cep.length !== 8) e.cep = 'CEP inválido'

    setErros(e)
    return Object.keys(e).length === 0
  }

  async function carregarPacientes(termo) {
    setCarregandoLista(true)

    const termoBusca = String(termo || '').trim()
    const soDigitos = normalizarDocumento(termoBusca)

    let query = supabase
      .from('pacientes')
      .select('id, nome, cpf_cns, dt_nasc, sexo, telefone, endereco, bairro, cep')
      .order('nome')
      .limit(30)

    if (termoBusca) {
      if (soDigitos.length >= 3 && !/[a-zA-ZÀ-ÿ]/.test(termoBusca)) {
        query = query.ilike('cpf_cns', `%${soDigitos}%`)
      } else {
        query = query.filter('nome', 'imatch', accentInsensitivePattern(termoBusca))
      }
    }

    const { data, error } = await query

    if (error) {
      setStatus({ msg: '❌ Erro ao carregar pacientes: ' + error.message, tipo: 'erro' })
      setPacientes([])
    } else {
      setPacientes(data || [])
    }

    setCarregandoLista(false)
  }

  function editarPaciente(paciente) {
    setForm(montarFormularioPaciente(paciente))
    setErros({})
    setStatus({ msg: '', tipo: '' })
    setEditandoId(paciente.id)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function excluirPaciente(paciente) {
    const confirmado = window.confirm(`Excluir o paciente "${paciente.nome}"?\n\nEsta ação não pode ser desfeita.`)
    if (!confirmado) return

    setExcluindo(paciente.id)
    const { error } = await supabase.from('pacientes').delete().eq('id', paciente.id)
    setExcluindo(null)

    if (error) {
      setStatus({ msg: '❌ Erro ao excluir: ' + error.message, tipo: 'erro' })
    } else {
      setStatus({ msg: `✅ Paciente "${paciente.nome}" excluído com sucesso.`, tipo: 'ok' })
      if (editandoId === paciente.id) limparFormulario()
      carregarPacientes(busca)
    }
  }

  async function salvar(e) {
    e.preventDefault()
    if (!validar()) return

    setSalvando(true)
    setStatus({ msg: '', tipo: '' })

    const cpfLimpo = normalizarDocumento(form.cpf_cns)
    let queryDuplicado = supabase
      .from('pacientes')
      .select('id, nome')
      .eq('cpf_cns', cpfLimpo)

    if (editandoId) queryDuplicado = queryDuplicado.neq('id', editandoId)

    const { data: existe } = await queryDuplicado.maybeSingle()

    if (existe) {
      setStatus({ msg: `⚠️ CPF/CNS já cadastrado para: ${existe.nome}`, tipo: 'erro' })
      setSalvando(false)
      return
    }

    const payload = {
      nome: form.nome.toUpperCase().trim(),
      cpf_cns: cpfLimpo,
      dt_nasc: form.dt_nasc,
      sexo: form.sexo,
      telefone: normalizarDocumento(form.telefone),
      endereco: form.endereco.toUpperCase().trim(),
      bairro: form.bairro.toUpperCase().trim(),
      cep: normalizarDocumento(form.cep)
    }

    const operacao = editandoId
      ? supabase.from('pacientes').update(payload).eq('id', editandoId)
      : supabase.from('pacientes').insert([payload])

    const { error } = await operacao

    if (error) {
      setStatus({ msg: '❌ Erro ao salvar: ' + error.message, tipo: 'erro' })
    } else {
      if (editandoId) {
        // Sincroniza o telefone atualizado com todos os agendamentos do paciente
        try {
          await supabase
            .from('especialidades_agendamentos')
            .update({ telefone: payload.telefone })
            .eq('paciente_cns', payload.cpf_cns)
        } catch (syncErr) {
          console.error('Erro ao sincronizar telefone:', syncErr)
        }
      }
      setStatus({
        msg: editandoId ? '✅ Cadastro do paciente atualizado com sucesso!' : '✅ Paciente cadastrado com sucesso!',
        tipo: 'ok'
      })
      limparFormulario()
      carregarPacientes(busca)
    }

    setSalvando(false)
  }

  useEffect(() => {
    const u = localStorage.getItem('sms_user')
    if (!u) { router.push('/'); return }
    setUsuario(JSON.parse(u))
  }, [router])

  useEffect(() => {
    if (!usuario) return
    if (busca.trim().length < 3) return
    const timer = setTimeout(() => carregarPacientes(busca), 300)
    return () => clearTimeout(timer)
  }, [busca, usuario])

  function lerCsv(e) {
    const file = e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = async (ev) => {
      try {
        const texto = ev.target.result
        const separador = texto.includes(';') ? ';' : (texto.includes('\t') ? '\t' : ',')
        const linhasRaw = texto.split('\n')
        
        let idxCabecalho = 0
        for (let i = 0; i < linhasRaw.length; i++) {
          if (linhasRaw[i].toLowerCase().includes('cpf/cns') && linhasRaw[i].toLowerCase().includes('nome')) {
            idxCabecalho = i
            break
          }
        }

        const cabecalho = linhasRaw[idxCabecalho].toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').split(separador).map(c => c.trim().replace(/^"|"$/g, ''))
        
        const idxNome = cabecalho.findIndex(c => c === 'nome')
        const idxCpfCns = cabecalho.findIndex(c => c === 'cpf/cns')
        const idxNasc = cabecalho.findIndex(c => c.includes('nascimento'))
        const idxSexo = cabecalho.findIndex(c => c === 'sexo')
        const idxTelefoneCel = cabecalho.findIndex(c => c.includes('telefone celular'))
        const idxTelefoneRes = cabecalho.findIndex(c => c.includes('telefone residencial'))
        const idxTelefoneCont = cabecalho.findIndex(c => c.includes('telefone de contato'))
        const idxLogradouro = cabecalho.findIndex(c => c.includes('endereco') || c.includes('logradouro'))

        // DEBUG: log de índices para diagnóstico
        console.log('=== DEBUG IMPORTACAO ===')
        console.log('Separador detectado:', JSON.stringify(separador))
        console.log('Linha cabeçalho idx:', idxCabecalho)
        console.log('Cabeçalho completo:', cabecalho)
        console.log('idxNome:', idxNome, '| idxCpfCns:', idxCpfCns, '| idxLogradouro:', idxLogradouro, '| idxSexo:', idxSexo)
        if (linhasRaw[idxCabecalho + 1]) {
          const primLinha = linhasRaw[idxCabecalho + 1].split(separador)
          console.log('Primeira linha de dados (colunas):', primLinha)
          console.log('Valor coluna endereço (idx', idxLogradouro, '):', idxLogradouro >= 0 ? primLinha[idxLogradouro] : 'NÃO ENCONTRADO')
        }

        const dados = []
        for (let i = idxCabecalho + 1; i < linhasRaw.length; i++) {
          if (!linhasRaw[i].trim()) continue
          // No CSV do e-SUS, o nome e endereço podem ou não estar entre aspas, o split simples por separador pode falhar se houver ; dentro de aspas, 
          // mas o padrão do e-SUS costuma ser limpo ou usar aspas simples nas microáreas. Usaremos split simples pra manter compatibilidade
          const l = linhasRaw[i].split(separador).map(c => c.trim().replace(/^"|"$/g, ''))
          
          if (l.length > 1 && l[idxNome] && l[idxNome] !== '-' && idxNome >= 0) {
            let enderecoCompleto = idxLogradouro >= 0 ? l[idxLogradouro] : ''
            let cep = ''
            let endereco = enderecoCompleto
            let bairro = ''

            if (enderecoCompleto && enderecoCompleto !== '-' && enderecoCompleto.includes('|')) {
              const partes = enderecoCompleto.split('|')
              endereco = partes[0].trim()
              cep = partes[1].trim()
            }
            
            if (endereco && endereco !== '-') {
              const partesVirgula = endereco.split(',')
              if (partesVirgula.length >= 2) {
                // A primeira parte é o logradouro
                let logradouro = partesVirgula[0].trim()
                // A penúltima parte costuma conter o "Número. Bairro" ou "Número - Bairro"
                // (a última parte normalmente é a "Cidade - UF")
                let parteBairro = partesVirgula[partesVirgula.length - 2].trim()
                
                let numero = ''
                if (parteBairro.includes(' - ')) {
                  const sub = parteBairro.split(' - ')
                  bairro = sub.pop().trim()
                  numero = sub.join(' - ').trim()
                } else if (parteBairro.includes('.')) {
                  const sub = parteBairro.split('.')
                  bairro = sub.pop().trim()
                  numero = sub.join('.').trim()
                } else {
                  bairro = parteBairro
                }
                
                endereco = numero ? `${logradouro}, ${numero}` : logradouro
              }
            }

            let telefone = ''
            if (idxTelefoneCel >= 0 && l[idxTelefoneCel] && l[idxTelefoneCel] !== '-') telefone = l[idxTelefoneCel]
            else if (idxTelefoneCont >= 0 && l[idxTelefoneCont] && l[idxTelefoneCont] !== '-') telefone = l[idxTelefoneCont]
            else if (idxTelefoneRes >= 0 && l[idxTelefoneRes] && l[idxTelefoneRes] !== '-') telefone = l[idxTelefoneRes]

            dados.push({
              nome: l[idxNome],
              cns: idxCpfCns >= 0 ? l[idxCpfCns] : '',
              cpf: idxCpfCns >= 0 ? l[idxCpfCns] : '',
              dtNasc: idxNasc >= 0 && l[idxNasc] !== '-' ? l[idxNasc] : '',
              sexo: idxSexo >= 0 && l[idxSexo] !== '-' ? l[idxSexo] : '',
              telefone: telefone,
              endereco: endereco !== '-' ? endereco : '',
              bairro: bairro !== '-' ? bairro : '',
              cep: cep !== '-' ? cep : ''
            })
          }
        }
        setArqImportacao({ nome: file.name, total: dados.length, dados })
      } catch (err) {
        setStatus({ msg: 'Erro ao ler arquivo CSV. Verifique o formato.', tipo: 'erro' })
      }
    }
    reader.readAsText(file, 'iso-8859-1')
    e.target.value = ''
  }

  async function enviarImportacao() {
    if (!arqImportacao || !arqImportacao.dados) return
    setImportando(true)
    setStatus({ msg: '', tipo: '' })

    const LOTE = 250
    const todos = arqImportacao.dados
    let totalInseridos = 0
    let totalAtualizados = 0
    let totalIgnorados = 0
    let processados = 0

    setProgressImportacao({ atual: 0, total: todos.length })

    try {
      for (let i = 0; i < todos.length; i += LOTE) {
        const lote = todos.slice(i, i + LOTE)
        const resp = await fetch('/api/pacientes/importar', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ linhas: lote, sobrescreverTelefones })
        })
        const json = await resp.json()
        if (!json.ok) throw new Error(json.error || 'Erro na importação')
        totalInseridos += json.resultados.inseridos
        totalAtualizados += json.resultados.atualizados
        totalIgnorados += json.resultados.ignorados
        processados += json.resultados.totalProcessado
        setProgressImportacao({ atual: processados, total: todos.length })
      }

      setStatus({
        msg: `✅ Importação concluída! Novos: ${totalInseridos} | Atualizados: ${totalAtualizados} | Sem alteração: ${totalIgnorados}`,
        tipo: 'ok'
      })
      setModalImportar(false)
      setArqImportacao(null)
      carregarPacientes(busca)
    } catch (err) {
      setStatus({ msg: `❌ Erro na importação: ${err.message}`, tipo: 'erro' })
    }
    setProgressImportacao({ atual: 0, total: 0 })
    setImportando(false)
  }

  const lbl = 'label-modern'

  return (
    <Layout usuario={usuario}>
      <div style={{ padding: '28px', maxWidth: '1200px', margin: '0 auto' }}>
        <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h1 style={{
              fontFamily: 'Sora, sans-serif',
              fontSize: '22px',
              fontWeight: '700',
              color: '#0f172a',
              margin: '0 0 4px'
            }}>
              Pacientes
            </h1>
            <p style={{ color: '#000000', fontSize: '13px', margin: 0 }}>
              Cadastre, busque e atualize pacientes usados no BPA e nos agendamentos
            </p>
          </div>
          <button
            onClick={() => setModalImportar(true)}
            style={{ padding: '9px 18px', background: 'linear-gradient(135deg, #059669, #10b981)', border: 'none', borderRadius: '10px', color: 'white', fontSize: '13px', cursor: 'pointer', fontFamily: 'Sora, sans-serif', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Upload size={14} /> Importar e-SUS
          </button>
        </div>

        {status.msg && (
          <div className={status.tipo === 'ok' ? 'status-ok' : 'status-err'} style={{ marginBottom: '16px' }}>
            {status.msg}
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1.05fr 0.95fr', gap: '20px', alignItems: 'start' }}>
          <div className="card" style={{ padding: '28px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', marginBottom: '18px' }}>
              <div>
                <h2 style={{ fontFamily: 'Sora, sans-serif', fontSize: '15px', fontWeight: '700', color: '#172554', margin: '0 0 4px' }}>
                  {editandoId ? 'Atualizar cadastro' : 'Novo paciente'}
                </h2>
                <p style={{ color: '#475569', fontSize: '12px', margin: 0 }}>
                  {editandoId ? 'Edite os dados e salve para corrigir o cadastro.' : 'Preencha os dados obrigatórios do paciente.'}
                </p>
              </div>
              {editandoId && (
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={limparFormulario}
                >
                  Cancelar edição
                </button>
              )}
            </div>

            <form onSubmit={salvar} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div>
                <label className={lbl}>Nome Completo *</label>
                <input
                  className="input-modern"
                  value={form.nome}
                  onChange={e => setField('nome', e.target.value.toUpperCase())}
                  placeholder="Nome completo do paciente"
                  style={erros.nome ? { borderColor: '#ef4444' } : {}}
                />
                {erros.nome && <p style={{ color: '#ef4444', fontSize: '11px', margin: '4px 0 0' }}>{erros.nome}</p>}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <label className={lbl}>CPF/CNS *</label>
                  <input
                    className="input-modern"
                    value={form.cpf_cns}
                    onChange={e => setField('cpf_cns', mascaraCpfCns(e.target.value))}
                    placeholder="000.000.000-00 ou CNS"
                    style={erros.cpf_cns ? { borderColor: '#ef4444' } : {}}
                  />
                  {erros.cpf_cns && <p style={{ color: '#ef4444', fontSize: '11px', margin: '4px 0 0' }}>{erros.cpf_cns}</p>}
                </div>
                <div>
                  <label className={lbl}>Data de Nascimento *</label>
                  <input
                    type="date"
                    className="input-modern"
                    value={form.dt_nasc}
                    onChange={e => setField('dt_nasc', e.target.value)}
                    style={erros.dt_nasc ? { borderColor: '#ef4444' } : {}}
                  />
                  {erros.dt_nasc && <p style={{ color: '#ef4444', fontSize: '11px', margin: '4px 0 0' }}>{erros.dt_nasc}</p>}
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <label className={lbl}>Sexo *</label>
                  <select
                    className="input-modern"
                    value={form.sexo}
                    onChange={e => setField('sexo', e.target.value)}
                    style={erros.sexo ? { borderColor: '#ef4444' } : {}}
                  >
                    <option value="">-- Selecione --</option>
                    <option value="M">Masculino</option>
                    <option value="F">Feminino</option>
                  </select>
                  {erros.sexo && <p style={{ color: '#ef4444', fontSize: '11px', margin: '4px 0 0' }}>{erros.sexo}</p>}
                </div>
                <div>
                  <label className={lbl}>Telefone *</label>
                  <input
                    className="input-modern"
                    value={form.telefone}
                    onChange={e => setField('telefone', mascaraTelefone(e.target.value))}
                    placeholder="(63) 99999-9999"
                    style={erros.telefone ? { borderColor: '#ef4444' } : {}}
                  />
                  {erros.telefone && <p style={{ color: '#ef4444', fontSize: '11px', margin: '4px 0 0' }}>{erros.telefone}</p>}
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '16px' }}>
                <div>
                  <label className={lbl}>Endereço *</label>
                  <input
                    className="input-modern"
                    value={form.endereco}
                    onChange={e => setField('endereco', e.target.value.toUpperCase())}
                    placeholder="Rua, Avenida..."
                    style={erros.endereco ? { borderColor: '#ef4444' } : {}}
                  />
                  {erros.endereco && <p style={{ color: '#ef4444', fontSize: '11px', margin: '4px 0 0' }}>{erros.endereco}</p>}
                </div>
                <div>
                  <label className={lbl}>Bairro *</label>
                  <input
                    className="input-modern"
                    value={form.bairro}
                    onChange={e => setField('bairro', e.target.value.toUpperCase())}
                    style={erros.bairro ? { borderColor: '#ef4444' } : {}}
                  />
                  {erros.bairro && <p style={{ color: '#ef4444', fontSize: '11px', margin: '4px 0 0' }}>{erros.bairro}</p>}
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '16px' }}>
                <div>
                  <label className={lbl}>CEP *</label>
                  <input
                    className="input-modern"
                    value={form.cep}
                    onChange={e => setField('cep', mascaraCEP(e.target.value))}
                    placeholder="77.305-000"
                    style={erros.cep ? { borderColor: '#ef4444' } : {}}
                  />
                  {erros.cep && <p style={{ color: '#ef4444', fontSize: '11px', margin: '4px 0 0' }}>{erros.cep}</p>}
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'center', gap: '10px', flexWrap: 'wrap' }}>
                <button
                  type="submit"
                  className="btn-primary"
                  style={{ background: 'linear-gradient(135deg, #172554, #1e3a8a)', padding: '12px 40px', fontSize: '14px' }}
                >
                  {salvando ? 'Salvando...' : editandoId ? '✓ ATUALIZAR PACIENTE' : '✓ SALVAR PACIENTE'}
                </button>
                {editandoId && (
                  <button type="button" className="btn-secondary" onClick={limparFormulario}>
                    Limpar
                  </button>
                )}
              </div>
            </form>
          </div>

          <div className="card" style={{ padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', marginBottom: '14px', flexWrap: 'wrap' }}>
              <div>
                <h2 style={{ fontFamily: 'Sora, sans-serif', fontSize: '15px', fontWeight: '700', color: '#172554', margin: '0 0 4px' }}>
                  Buscar pacientes
                </h2>
                <p style={{ color: '#475569', fontSize: '12px', margin: 0 }}>
                  Digite ao menos 3 caracteres para pesquisar por nome, CPF ou CNS.
                </p>
              </div>
              <button type="button" className="btn-secondary" onClick={() => carregarPacientes(busca)}>
                Atualizar lista
              </button>
            </div>

            <div style={{ marginBottom: '14px' }}>
              <input
                className="input-modern"
                value={busca}
                onChange={e => setBusca(e.target.value)}
                placeholder="Digite nome, CPF ou CNS"
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {carregandoLista ? (
                <p style={{ color: '#64748b', fontSize: '13px', margin: 0 }}>Carregando pacientes...</p>
              ) : busca.trim().length > 0 && busca.trim().length < 3 ? (
                <p style={{ color: '#64748b', fontSize: '13px', margin: 0 }}>Digite pelo menos 3 caracteres para buscar.</p>
              ) : busca.trim().length === 0 ? (
                <p style={{ color: '#64748b', fontSize: '13px', margin: 0 }}>Digite nome, CPF ou CNS para buscar.</p>
              ) : pacientes.length === 0 ? (
                <p style={{ color: '#64748b', fontSize: '13px', margin: 0 }}>Nenhum paciente encontrado.</p>
              ) : (
                pacientes.map(paciente => {
                  const pendencias = camposPendentes(paciente)
                  return (
                    <div
                      key={paciente.id}
                      style={{
                        border: '1px solid #e2e8f0',
                        borderRadius: '12px',
                        padding: '14px',
                        background: pendencias.length ? '#fff7ed' : '#f8fafc'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'flex-start' }}>
                        <div>
                          <p style={{ margin: '0 0 4px', fontWeight: '700', color: '#0f172a', fontFamily: 'Sora, sans-serif', fontSize: '13px' }}>
                            {paciente.nome}
                          </p>
                          <p style={{ margin: '0 0 4px', color: '#475569', fontSize: '12px' }}>
                            {formatarCpfCns(paciente.cpf_cns)}
                          </p>
                          <p style={{ margin: 0, color: '#64748b', fontSize: '12px' }}>
                            Nascimento: {formatarDataBr(paciente.dt_nasc)} • Sexo: {paciente.sexo || '-'}
                          </p>
                        </div>
                        <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                          <button
                            type="button"
                            onClick={() => editarPaciente(paciente)}
                            style={{
                              border: 'none',
                              borderRadius: '8px',
                              background: '#dbeafe',
                              color: '#1d4ed8',
                              fontWeight: '700',
                              fontSize: '12px',
                              padding: '8px 12px',
                              cursor: 'pointer'
                            }}
                          >
                            Editar
                          </button>
                          <button
                            type="button"
                            onClick={() => excluirPaciente(paciente)}
                            disabled={excluindo === paciente.id}
                            style={{
                              border: 'none',
                              borderRadius: '8px',
                              background: '#fee2e2',
                              color: '#dc2626',
                              fontWeight: '700',
                              fontSize: '12px',
                              padding: '8px 12px',
                              cursor: excluindo === paciente.id ? 'not-allowed' : 'pointer',
                              opacity: excluindo === paciente.id ? 0.6 : 1
                            }}
                          >
                            {excluindo === paciente.id ? '...' : 'Excluir'}
                          </button>
                        </div>
                      </div>

                      <div style={{ marginTop: '10px', display: 'grid', gridTemplateColumns: '1fr', gap: '4px' }}>
                        <span style={{ fontSize: '12px', color: '#475569' }}>
                          Telefone: {paciente.telefone ? mascaraTelefone(paciente.telefone) : '-'}
                        </span>
                        <span style={{ fontSize: '12px', color: '#475569' }}>
                          Endereço: {paciente.endereco || '-'}{paciente.bairro ? ` • ${paciente.bairro}` : ''}
                        </span>
                        {pendencias.length > 0 && (
                          <span style={{ fontSize: '11px', color: '#c2410c', fontWeight: '600' }}>
                            Cadastro incompleto: {pendencias.join(', ')}
                          </span>
                        )}
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Modal Importar */}
      {modalImportar && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
          <div style={{ background: 'white', borderRadius: '16px', width: '100%', maxWidth: '500px', padding: '24px', boxShadow: '0 25px 50px rgba(0,0,0,0.25)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ fontFamily: 'Sora, sans-serif', fontSize: '16px', fontWeight: '700', color: '#0f172a', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Upload size={18} color="#059669" /> Importar CSV do e-SUS
              </h2>
              <button onClick={() => { setModalImportar(false); setArqImportacao(null) }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}>
                <X size={20} />
              </button>
            </div>
            
            <p style={{ fontSize: '13px', color: '#475569', marginBottom: '20px', lineHeight: '1.5' }}>
              Exporte a planilha de <strong>Cidadãos Vinculados</strong> do seu e-SUS (Botão Exportar CSV) e envie aqui. O sistema irá cadastrar os novos e atualizar dados faltantes dos existentes (preservando telefones atuais).
            </p>

            <div style={{ border: '1.5px dashed #10b981', background: '#ecfdf5', borderRadius: '12px', padding: '24px', textAlign: 'center', marginBottom: '20px' }}>
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', cursor: 'pointer', background: 'white', border: '1px solid #10b981', borderRadius: '8px', padding: '10px 20px', fontSize: '13px', fontWeight: '600', color: '#047857' }}>
                <Upload size={16} /> {arqImportacao ? 'Trocar Arquivo' : 'Escolher Arquivo CSV'}
                <input type="file" accept=".csv,.tsv,.txt" style={{ display: 'none' }} onChange={lerCsv} disabled={importando} />
              </label>
              {arqImportacao && (
                <div style={{ marginTop: '12px', fontSize: '13px', color: '#065f46', fontWeight: '600' }}>
                  📄 {arqImportacao.nome} <br/>
                  <span style={{ fontSize: '12px', fontWeight: '400' }}>{arqImportacao.total} pacientes identificados</span>
                  
                  {/* DEBUG VISUAL */}
                  <div style={{ marginTop: '10px', textAlign: 'left', background: '#fff', border: '1px solid #10b981', padding: '10px', borderRadius: '8px', maxHeight: '150px', overflowY: 'auto' }}>
                    <p style={{ fontSize: '11px', color: '#64748b', marginBottom: '8px', fontWeight: 'bold' }}>COMO O SISTEMA ESTÁ LENDO (3 primeiros):</p>
                    {arqImportacao.dados.slice(0, 3).map((d, i) => (
                      <div key={i} style={{ borderBottom: '1px solid #e2e8f0', paddingBottom: '8px', marginBottom: '8px', fontSize: '12px', fontWeight: 'normal', color: '#334155' }}>
                        <strong>Nome:</strong> {d.nome} | <strong>CPF:</strong> {d.cpf}<br/>
                        <strong style={{color: '#d97706'}}>Endereço Extraído:</strong> {d.endereco || '(VAZIO)'}<br/>
                        <strong style={{color: '#059669'}}>Bairro Extraído:</strong> {d.bairro || '(VAZIO)'}
                      </div>
                    ))}
                  </div>

                </div>
              )}
            </div>

            <div style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input 
                type="checkbox" 
                id="sobrescreverTelefones" 
                checked={sobrescreverTelefones}
                onChange={e => setSobrescreverTelefones(e.target.checked)}
                disabled={importando}
                style={{ width: '16px', height: '16px', cursor: 'pointer', accentColor: '#10b981' }}
              />
              <label htmlFor="sobrescreverTelefones" style={{ fontSize: '13px', color: '#475569', cursor: 'pointer' }}>
                Sobrescrever telefones atuais com os da planilha (se houver)
              </label>
            </div>

            {importando && progressImportacao.total > 0 && (
              <div style={{ marginBottom: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#475569', marginBottom: '4px' }}>
                  <span>Processando pacientes...</span>
                  <span>{progressImportacao.atual} / {progressImportacao.total}</span>
                </div>
                <div style={{ background: '#e2e8f0', borderRadius: '99px', height: '8px', overflow: 'hidden' }}>
                  <div style={{ 
                    background: 'linear-gradient(90deg, #059669, #10b981)', 
                    height: '100%', 
                    borderRadius: '99px',
                    width: `${Math.round((progressImportacao.atual / progressImportacao.total) * 100)}%`,
                    transition: 'width 0.3s ease'
                  }} />
                </div>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button className="btn-secondary" onClick={() => { setModalImportar(false); setArqImportacao(null); setSobrescreverTelefones(false) }} disabled={importando}>
                Cancelar
              </button>
              <button className="btn-primary" style={{ background: 'linear-gradient(135deg, #059669, #10b981)' }} onClick={enviarImportacao} disabled={!arqImportacao || importando}>
                {importando ? `Sincronizando... (${progressImportacao.atual}/${progressImportacao.total})` : 'Iniciar Sincronização'}
              </button>
            </div>
          </div>
        </div>
      )}

    </Layout>
  )
}
