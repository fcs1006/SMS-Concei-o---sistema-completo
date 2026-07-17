'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Search, FileText, User, Stethoscope, Building, 
  AlertCircle, Download, CheckCircle, RefreshCw, Trash2
} from 'lucide-react'
import { supabase, accentInsensitivePattern } from '@/lib/supabase'

function calcularIdadeCompleta(dataNasc) {
  if (!dataNasc) return ''
  // Adiciona time zone para evitar problemas de fuso horário na data em formato YYYY-MM-DD
  const parts = dataNasc.split('-')
  if (parts.length !== 3) return ''
  const nasc = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]))
  if (isNaN(nasc.getTime())) return ''
  
  const hoje = new Date()
  
  let anos = hoje.getFullYear() - nasc.getFullYear()
  let meses = hoje.getMonth() - nasc.getMonth()
  let dias = hoje.getDate() - nasc.getDate()
  
  if (dias < 0) {
    meses--
    const uMes = new Date(hoje.getFullYear(), hoje.getMonth(), 0)
    dias += uMes.getDate()
  }
  
  if (meses < 0) {
    anos--
    meses += 12
  }
  
  const partes = []
  if (anos > 0) partes.push(`${anos} ano${anos > 1 ? 's' : ''}`)
  if (meses > 0) partes.push(`${meses} me${meses > 1 ? 'ses' : 's'}`)
  if (dias > 0) partes.push(`${dias} dia${dias > 1 ? 's' : ''}`)
  
  return partes.join(' e ')
}

export default function EncaminhamentoForm() {
  const router = useRouter()
  const [usuario, setUsuario] = useState(null)
  
  // Estados de busca
  const [codigoBusca, setCodigoBusca] = useState('')
  const [buscando, setBuscando] = useState(false)
  const [erroBusca, setErroBusca] = useState('')
  const [sucessoBusca, setSucessoBusca] = useState(false)

  // Estados para CNES do Município
  const [unidadesSolicitantes, setUnidadesSolicitantes] = useState([])
  const [carregandoUnidades, setCarregandoUnidades] = useState(false)
  const [ibgeConsulta, setIbgeConsulta] = useState('1705607')
  const [excluidosCnes, setExcluidosCnes] = useState([])

  // Estados para autocomplete / sugestões
  const [sugestoesPacientes, setSugestoesPacientes] = useState([])
  const [sugestoesProcedimentos, setSugestoesProcedimentos] = useState([])
  const [focoProcedimento, setFocoProcedimento] = useState('') // 'codigo' | 'descricao'
  const [sugestoesProfissionais, setSugestoesProfissionais] = useState([])
  const [buscandoProfissionais, setBuscandoProfissionais] = useState(false)
  const [sugestoesCid, setSugestoesCid] = useState([])
  const [buscandoCid, setBuscandoCid] = useState(false)

  // Fecha todas as caixas de sugestões ao clicar fora
  useEffect(() => {
    const handleClose = () => {
      setSugestoesPacientes([])
      setSugestoesProcedimentos([])
      setSugestoesProfissionais([])
      setSugestoesCid([])
    }
    window.addEventListener('click', handleClose)
    return () => window.removeEventListener('click', handleClose)
  }, [])

  // Função para buscar pacientes locais (por nome, CPF ou CNS)
  async function buscarPacientesLocal(val) {
    const termo = String(val || '').trim()
    if (termo.length < 3) {
      setSugestoesPacientes([])
      return
    }

    try {
      let query = supabase
        .from('pacientes')
        .select('id, nome, cpf_cns, dt_nasc, sexo, telefone, endereco, bairro, cep')
        .order('nome')
        .limit(10)

      if (/[0-9]/.test(termo)) {
        query = query.ilike('cpf_cns', `%${termo.replace(/\D/g, '')}%`)
      } else {
        query = query.filter('nome', 'imatch', accentInsensitivePattern(termo))
      }

      const { data, error } = await query
      if (!error && data) {
        setSugestoesPacientes(data)
      }
    } catch (e) {
      console.error('Erro ao buscar pacientes localmente:', e)
    }
  }

  // Preenche dados do paciente selecionado
  const selecionarPaciente = (pac) => {
    setFormData(prev => {
      const limpo = pac.cpf_cns ? pac.cpf_cns.replace(/\D/g, '') : ''
      const isCns = limpo.length >= 15
      const dataNasc = pac.dt_nasc || ''
      const idadeCalculada = calcularIdadeCompleta(dataNasc)
      
      return {
        ...prev,
        nomePaciente: pac.nome || '',
        cnsPaciente: isCns ? limpo : '',
        cpfPaciente: !isCns ? limpo : '',
        dataNascimento: dataNasc,
        idade: idadeCalculada,
        sexo: pac.sexo || 'M',
        telefone: pac.telefone || '',
        nomeMae: pac.mae || '',
        municipioNascimento: pac.nascido_em || 'CONCEIÇÃO DO TOCANTINS / TO'
      }
    })
    setSugestoesPacientes([])
  }

  // Busca especialidade/procedimento no SIGTAP (por código ou nome)
  async function buscarSigtapLocal(val) {
    const termo = String(val || '').trim()
    if (termo.length < 3) {
      setSugestoesProcedimentos([])
      return
    }

    try {
      const res = await fetch(`/api/sigtap/buscar?q=${encodeURIComponent(termo)}&limit=10`)
      if (res.ok) {
        const data = await res.json()
        if (data.ok && data.resultados) {
          setSugestoesProcedimentos(data.resultados)
        }
      }
    } catch (e) {
      console.error('Erro ao buscar especialidades/sigtap:', e)
    }
  }

  // Seleciona especialidade/procedimento
  const selecionarProcedimento = (proc) => {
    setFormData(prev => ({
      ...prev,
      especialidade: proc.no_procedimento || ''
    }))
    setSugestoesProcedimentos([])
  }

  // Busca CID-10
  async function buscarCidLocal(val) {
    const termo = String(val || '').trim()
    if (termo.length < 2) {
      setSugestoesCid([])
      return
    }

    setBuscandoCid(true)
    try {
      const { data, error } = await supabase
        .from('sigtap_cid')
        .select('co_cid, no_cid')
        .or(`co_cid.ilike.%${termo}%,no_cid.ilike.%${termo}%`)
        .limit(10)

      if (!error && data) {
        setSugestoesCid(data)
      }
    } catch (e) {
      console.error('Erro ao buscar CID10:', e)
    } finally {
      setBuscandoCid(false)
    }
  }

  // Seleciona CID-10
  const selecionarCid = (cid) => {
    setFormData(prev => ({
      ...prev,
      cid10: cid.co_cid || '',
      diagnosticoDescricao: cid.no_cid || ''
    }))
    setSugestoesCid([])
  }

  // Busca profissionais
  async function buscarProfissionaisLocal(val) {
    const termo = String(val || '').trim()
    
    if (termo.length < 3 && !formData.cnesSolicitante) {
      setSugestoesProfissionais([])
      return
    }

    setBuscandoProfissionais(true)
    try {
      let resultados = []
      
      if (formData.cnesSolicitante) {
        const res = await fetch(`/api/cnes/profissionais?cnes=${formData.cnesSolicitante}`)
        if (res.ok) {
          const data = await res.json()
          if (data.ok && data.resultados) {
            if (termo.length >= 3) {
              resultados = data.resultados.filter((p) => 
                p.nome.toUpperCase().includes(termo.toUpperCase()) || 
                (p.crm && p.crm.includes(termo))
              )
            } else {
              resultados = data.resultados
            }
          }
        }
      }

      if (resultados.length === 0) {
        let query = supabase
          .from('especialidades_profissionais')
          .select('nome, conselho_tipo, conselho_numero, cns')
          .eq('ativo', true)
          .order('nome')
          .limit(10)

        if (termo.length >= 3) {
          if (/[0-9]/.test(termo)) {
            query = query.ilike('conselho_numero', `%${termo}%`)
          } else {
            query = query.ilike('nome', `%${termo}%`)
          }
        }

        const { data, error } = await query
        if (!error && data) {
          resultados = data.map(p => ({
            nome: p.nome,
            crm: p.conselho_numero ? `${p.conselho_tipo || 'CRM'}-${formData.ufMedico || 'TO'} ${p.conselho_numero}` : '',
            cns: p.cns || '',
            cpf: ''
          }))
        }
      }

      setSugestoesProfissionais(resultados)
    } catch (e) {
      console.error('Erro ao buscar profissionais:', e)
    } finally {
      setBuscandoProfissionais(false)
    }
  }

  // Preenche dados do profissional selecionado
  const selecionarProfissional = (prof) => {
    setFormData(prev => {
      let crm = prof.crm || ''
      if (crm && !crm.includes('-') && !crm.toUpperCase().includes('CRM')) {
        crm = `CRM-${prev.ufMedico || 'TO'} ${crm}`
      }
      
      const numDoc = prof.cns || prof.cpf || ''

      return {
        ...prev,
        nomeMedico: prof.nome || '',
        crmMedico: crm,
        documentoSolicitanteNumero: numDoc || prev.documentoSolicitanteNumero
      }
    })
    setSugestoesProfissionais([])
  }

  // Carrega do localStorage de forma segura após o mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem('sms_excluded_cnes')
      if (saved) {
        setExcluidosCnes(JSON.parse(saved))
      }
    } catch (e) {
      console.error(e)
    }
  }, [])

  // Dados do formulário
  const [formData, setFormData] = useState({
    estabelecimentoSolicitante: 'SECRETARIA MUNICIPAL DE SAÚDE',
    cnesSolicitante: '1234567',
    nomePaciente: '',
    cnsPaciente: '',
    cpfPaciente: '',
    classificacaoRisco: 'PRIORITÁRIO',
    sexo: 'F',
    idade: '',
    dataNascimento: '',
    telefone: '',
    nomeMae: '',
    municipioNascimento: 'CONCEIÇÃO DO TOCANTINS / TO',
    
    // Principal
    especialidade: '',
    cid10: '',
    diagnosticoDescricao: '',
    justificativaClinica: '',
    observacao: '',

    // Solicitante
    nomeMedico: '',
    crmMedico: '',
    ufMedico: 'TO',
    cargoMedico: 'Médico da estratégia de saúde da família',
    cidadeData: '',
    documentoSolicitanteNumero: '',
    operadorNome: ''
  })

  // Calcula a data atual por extenso
  useEffect(() => {
    const hoje = new Date()
    const meses = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']
    const dia = hoje.getDate()
    const mes = meses[hoje.getMonth()]
    const ano = hoje.getFullYear()
    
    setFormData(prev => ({
      ...prev,
      cidadeData: `Conceição do Tocantins - TO, ${String(dia).padStart(2, '0')} de ${mes} de ${ano}`
    }))
  }, [])

  const [gerandoPdf, setGerandoPdf] = useState(false)

  // Verifica login e tenta carregar a identidade do município
  useEffect(() => {
    const u = localStorage.getItem('sms_user')
    if (!u) {
      router.push('/')
      return
    }
    const parsedUser = JSON.parse(u)
    setUsuario(parsedUser)
    
    setFormData(prev => ({
      ...prev,
      operadorNome: parsedUser.nome || ''
    }))

    // Carrega o nome do município da config local se existir
    const cached = localStorage.getItem('sms_client_config')
    if (cached) {
      try {
        const cc = JSON.parse(cached)
        if (cc.municipalityName) {
          const nomeMun = cc.municipalityName.toUpperCase()
          setFormData(prev => ({
            ...prev,
            estabelecimentoSolicitante: `SECRETARIA MUNICIPAL DE SAÚDE DE ${nomeMun}`,
            municipioNascimento: `${nomeMun} / TO`
          }))
        }
      } catch (e) {
        console.error('Erro ao ler config do município:', e)
      }
    }
  }, [router])

  // Função para buscar os CNES do município pelo IBGE
  async function carregarUnidadesCnes(ibgeCode) {
    if (!ibgeCode || !ibgeCode.trim()) return
    setCarregandoUnidades(true)
    try {
      const res = await fetch(`/api/cnes/municipio?ibge=${ibgeCode}`)
      if (res.ok) {
        const data = await res.json()
        if (data.resultados) {
          let excluidos = []
          try {
            const saved = localStorage.getItem('sms_excluded_cnes')
            if (saved) excluidos = JSON.parse(saved)
          } catch (e) {}
          setUnidadesSolicitantes(data.resultados.filter((u) => !excluidos.includes(u.cnes)))
        }
      }
    } catch (err) {
      console.error('Erro ao carregar unidades CNES:', err)
    } finally {
      setCarregandoUnidades(false)
    }
  }

  // Carrega estabelecimentos iniciais no mount
  useEffect(() => {
    carregarUnidadesCnes(ibgeConsulta)
  }, [])

  const handleSelectEstabelecimento = (e) => {
    const cnes = e.target.value
    if (!cnes) {
      setFormData(prev => ({
        ...prev,
        cnesSolicitante: '',
        estabelecimentoSolicitante: ''
      }))
      return
    }
    const unidade = unidadesSolicitantes.find(u => u.cnes === cnes)
    if (unidade) {
      setFormData(prev => ({
        ...prev,
        cnesSolicitante: cnes,
        estabelecimentoSolicitante: unidade.nome
      }))
    }
  }

  const excluirEstabelecimento = (cnes) => {
    if (!cnes) return
    const unidade = unidadesSolicitantes.find(u => u.cnes === cnes)
    const nomeUnidade = unidade ? unidade.nome : cnes
    if (confirm(`Deseja ocultar/excluir o estabelecimento "${nomeUnidade}" (CNES: ${cnes}) desta lista?`)) {
      const novaListaExcluidos = [...excluidosCnes, cnes]
      setExcluidosCnes(novaListaExcluidos)
      localStorage.setItem('sms_excluded_cnes', JSON.stringify(novaListaExcluidos))
      
      setUnidadesSolicitantes(prev => prev.filter(u => u.cnes !== cnes))
      
      if (formData.cnesSolicitante === cnes) {
        setFormData(prev => ({
          ...prev,
          cnesSolicitante: '',
          estabelecimentoSolicitante: ''
        }))
      }
    }
  }

  // Função para buscar a solicitação no backend
  async function buscarSolicitacao() {
    if (!codigoBusca.trim()) {
      setErroBusca('Por favor, digite o número da solicitação.')
      return
    }

    setBuscando(true)
    setErroBusca('')
    setSucessoBusca(false)

    try {
      const res = await fetch(`/api/sisreg/buscar?codigo=${codigoBusca}`)
      const resData = await res.json()

      if (!res.ok) {
        throw new Error(resData.error || 'Erro ao buscar solicitação.')
      }

      const s = resData.data
      const dataNasc = s.dt_nascimento_usuario ? s.dt_nascimento_usuario.split('T')[0] : ''
      const idadeCalculada = calcularIdadeCompleta(dataNasc)

      // Preenche os campos do formulário com os dados do SISREG
      setFormData(prev => ({
        ...prev,
        estabelecimentoSolicitante: s.nome_unidade_solicitante || prev.estabelecimentoSolicitante,
        cnesSolicitante: s.codigo_unidade_solicitante || prev.cnesSolicitante,
        nomePaciente: s.no_usuario || '',
        cnsPaciente: s.cns_usuario || '',
        cpfPaciente: s.cpf_usuario || '',
        dataNascimento: dataNasc,
        idade: idadeCalculada,
        sexo: s.sexo_usuario === 'F' || s.sexo_usuario === 'FEMININO' ? 'F' : 'M',
        nomeMae: s.no_mae_usuario || '',
        telefone: s.telefone || '',
        especialidade: s.descricao_interna_procedimento || '',
        nomeMedico: s.nome_medico_solicitante || '',
        crmMedico: s.numero_crm || '',
        documentoSolicitanteNumero: s.cpf_profissional_solicitante || '',
        cid10: s.codigo_cid || '', 
        diagnosticoDescricao: s.descricao_cid || s.descricao_interna_procedimento || '', 
        justificativaClinica: s.justificativa_clinica || ''
      }))

      if (s.codigo_unidade_solicitante && s.nome_unidade_solicitante) {
        setUnidadesSolicitantes(prevList => {
          const exists = prevList.some(u => u.cnes === s.codigo_unidade_solicitante)
          let excluidos = []
          try {
            const saved = localStorage.getItem('sms_excluded_cnes')
            if (saved) excluidos = JSON.parse(saved)
          } catch (e) {}
          const isExcluded = excluidos.includes(s.codigo_unidade_solicitante)
          if (!exists && !isExcluded) {
            return [...prevList, { cnes: s.codigo_unidade_solicitante, nome: s.nome_unidade_solicitante.toUpperCase() }]
          }
          return prevList
        })
      }

      setSucessoBusca(true)
      setTimeout(() => setSucessoBusca(false), 3000)
    } catch (err) {
      console.error(err)
      setErroBusca(err.message || 'Solicitação não encontrada no banco local.')
    } finally {
      setBuscando(false)
    }
  }

  // Lida com mudanças simples de campos
  const handleChange = (e) => {
    const { name, value } = e.target
    
    // Se mudar a data de nascimento, recalcula a idade
    if (name === 'dataNascimento') {
      const idadeCalculada = calcularIdadeCompleta(value)
      setFormData(prev => ({ 
        ...prev, 
        [name]: value,
        idade: idadeCalculada
      }))
    } else {
      setFormData(prev => ({ ...prev, [name]: value }))
    }
  }

  // Envia os dados e gera o PDF
  async function handleGerarPdf(e) {
    e.preventDefault()
    setGerandoPdf(true)

    try {
      const response = await fetch('/api/encaminhamento/pdf', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(errorText || 'Falha ao gerar a guia de encaminhamento.')
      }

      const blob = await response.blob()
      const fileURL = URL.createObjectURL(blob)
      window.open(fileURL, '_blank')
    } catch (err) {
      alert(err.message || 'Erro ao gerar o PDF.')
    } finally {
      setGerandoPdf(false)
    }
  }

  return (
    <div style={{ padding: '0 0 28px', maxWidth: '1200px', margin: '0 auto' }}>
      
      {/* Busca SISREG */}
      <div className="card" style={{ padding: '28px', marginBottom: '24px' }}>
        <h2 style={{ fontFamily: 'Sora, sans-serif', fontSize: '15px', fontWeight: '700', color: '#172554', margin: '0 0 16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Search size={18} style={{ color: '#3b82f6' }} />
          Buscar Solicitação no SISREG
        </h2>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', flexGrow: 1, minWidth: '280px' }}>
            <input
              type="text"
              value={codigoBusca}
              onChange={e => setCodigoBusca(e.target.value)}
              placeholder="Insira o número da solicitação do SISREG (ex: 374928372)"
              onKeyDown={e => e.key === 'Enter' && buscarSolicitacao()}
              className="input-modern"
              style={{ paddingLeft: '40px' }}
            />
            <Search size={16} style={{ position: 'absolute', left: '14px', top: '13px', color: '#94a3b8' }} />
          </div>
          <button
            onClick={buscarSolicitacao}
            disabled={buscando}
            className="btn-primary"
            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '10px 24px', background: 'linear-gradient(135deg, #3b82f6, #2563eb)', boxShadow: '0 4px 12px rgba(59,130,246,0.2)' }}
          >
            {buscando ? (
              <>
                <RefreshCw className="animate-spin" size={15} />
                Pesquisando...
              </>
            ) : (
              <>
                <RefreshCw size={15} />
                Buscar Dados
              </>
            )}
          </button>
        </div>

        <AnimatePresence mode="wait">
          {erroBusca && (
            <motion.div 
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              style={{ padding: '12px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: '10px', color: '#991b1b', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px', marginTop: '16px' }}
            >
              <AlertCircle size={18} className="shrink-0" style={{ color: '#ef4444' }} />
              <span>{erroBusca}</span>
            </motion.div>
          )}

          {sucessoBusca && (
            <motion.div 
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              style={{ padding: '12px', background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.25)', borderRadius: '10px', color: '#1e3a8a', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px', marginTop: '16px' }}
            >
              <CheckCircle size={18} className="shrink-0" style={{ color: '#3b82f6' }} />
              <span>Dados importados com sucesso! Revise as seções abaixo antes de gerar o PDF.</span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Formulário Principal */}
      <form onSubmit={handleGerarPdf} style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>


        {/* IDENTIFICAÇÃO DO ESTABELECIMENTO SOLICITANTE */}
        <div className="card" style={{ padding: '28px' }}>
          <h3 style={{ fontFamily: 'Sora, sans-serif', fontSize: '15px', fontWeight: '700', color: '#172554', margin: '0 0 20px', borderBottom: '1px solid #e2e8f0', paddingBottom: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Building size={18} style={{ color: '#3b82f6' }} />
            IDENTIFICAÇÃO DO ESTABELECIMENTO DE SAÚDE (SOLICITANTE)
          </h3>
          
          <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '20px', marginBottom: '20px' }}>
            <h4 style={{ fontFamily: 'Sora, sans-serif', fontSize: '13px', fontWeight: '700', color: '#334155', margin: '0 0 12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Search size={14} style={{ color: '#3b82f6' }} />
              Carregar Estabelecimentos por Município (IBGE)
            </h4>
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
              <div style={{ flexGrow: 1, minWidth: '200px' }}>
                <input
                  type="text"
                  value={ibgeConsulta}
                  onChange={e => setIbgeConsulta(e.target.value)}
                  placeholder="Insira o código IBGE do Município (ex: 1705607)"
                  className="input-modern"
                />
              </div>
              <button
                type="button"
                onClick={() => carregarUnidadesCnes(ibgeConsulta)}
                disabled={carregandoUnidades}
                className="btn-secondary"
                style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '9px 18px' }}
              >
                {carregandoUnidades ? (
                  <>
                    <RefreshCw className="animate-spin" size={14} />
                    Carregando...
                  </>
                ) : (
                  <>
                    <RefreshCw size={14} />
                    Buscar Unidades
                  </>
                )}
              </button>
            </div>
            
            {unidadesSolicitantes.length > 0 && (
              <div style={{ marginTop: '16px' }}>
                <label className="label-modern">Selecione uma Unidade de Saúde</label>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <select
                    onChange={handleSelectEstabelecimento}
                    value={formData.cnesSolicitante}
                    className="input-modern"
                    style={{ cursor: 'pointer', flexGrow: 1 }}
                  >
                    <option value="">-- Clique aqui para escolher --</option>
                    {unidadesSolicitantes.map(u => (
                      <option key={u.cnes} value={u.cnes}>
                        {u.nome} (CNES: {u.cnes})
                      </option>
                    ))}
                  </select>
                  {formData.cnesSolicitante && (
                    <button
                      type="button"
                      onClick={() => excluirEstabelecimento(formData.cnesSolicitante)}
                      style={{
                        background: '#fee2e2',
                        color: '#dc2626',
                        border: 'none',
                        borderRadius: '10px',
                        padding: '10px 14px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        transition: 'background 0.2s'
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = '#fca5a5'}
                      onMouseLeave={e => e.currentTarget.style.background = '#fee2e2'}
                      title="Excluir/Ocultar este estabelecimento desta lista"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              </div>
            )}

            {excluidosCnes.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  if (confirm('Deseja restaurar todos os estabelecimentos excluídos para a lista?')) {
                    setExcluidosCnes([])
                    localStorage.removeItem('sms_excluded_cnes')
                    carregarUnidadesCnes(ibgeConsulta)
                  }
                }}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#64748b',
                  cursor: 'pointer',
                  fontSize: '11px',
                  textDecoration: 'underline',
                  marginTop: '8px',
                  display: 'block',
                  padding: 0
                }}
              >
                Restaurar estabelecimentos ocultados/excluídos ({excluidosCnes.length})
              </button>
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '3fr 1fr', gap: '16px' }}>
            <div>
              <label className="label-modern">Nome do Estabelecimento Solicitante</label>
              <input
                type="text"
                name="estabelecimentoSolicitante"
                value={formData.estabelecimentoSolicitante}
                onChange={handleChange}
                required
                className="input-modern"
              />
            </div>
            <div>
              <label className="label-modern">CNES</label>
              <input
                type="text"
                name="cnesSolicitante"
                value={formData.cnesSolicitante}
                onChange={handleChange}
                required
                className="input-modern"
                style={{ textAlign: 'center', fontWeight: 'bold' }}
              />
            </div>
          </div>
        </div>

        {/* IDENTIFICAÇÃO DO PACIENTE */}
        <div className="card" style={{ padding: '28px' }}>
          <h3 style={{ fontFamily: 'Sora, sans-serif', fontSize: '15px', fontWeight: '700', color: '#172554', margin: '0 0 20px', borderBottom: '1px solid #e2e8f0', paddingBottom: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <User size={18} style={{ color: '#3b82f6' }} />
            IDENTIFICAÇÃO DO PACIENTE
          </h3>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '3fr 1fr', gap: '16px' }}>
              <div>
                <label className="label-modern">Nome do Cidadão (ou digite CPF/CNS para buscar)</label>
                <div style={{ position: 'relative' }} onClick={e => e.stopPropagation()}>
                  <input
                    type="text"
                    name="nomePaciente"
                    value={formData.nomePaciente}
                    onChange={(e) => {
                      handleChange(e)
                      buscarPacientesLocal(e.target.value)
                    }}
                    required
                    placeholder="Comece a digitar para buscar paciente..."
                    className="input-modern"
                    autoComplete="off"
                  />
                  {sugestoesPacientes.length > 0 && (
                    <div style={{
                      position: 'absolute',
                      top: '100%',
                      left: 0,
                      right: 0,
                      backgroundColor: 'white',
                      border: '1px solid #e2e8f0',
                      borderRadius: '8px',
                      boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -2px rgba(0,0,0,0.05)',
                      zIndex: 50,
                      maxHeight: '220px',
                      overflowY: 'auto',
                      marginTop: '4px'
                    }}>
                      {sugestoesPacientes.map(pac => (
                        <div
                          key={pac.id}
                          onClick={() => selecionarPaciente(pac)}
                          style={{
                            padding: '10px 14px',
                            cursor: 'pointer',
                            borderBottom: '1px solid #f1f5f9',
                            fontSize: '13px',
                            color: '#1e293b',
                            transition: 'background-color 0.15s'
                          }}
                          onMouseEnter={e => e.currentTarget.style.backgroundColor = '#f1f5f9'}
                          onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                        >
                          <div style={{ fontWeight: '600' }}>{pac.nome}</div>
                          <div style={{ fontSize: '11px', color: '#64748b' }}>
                            Documento: {pac.cpf_cns} | Nascimento: {pac.dt_nasc ? pac.dt_nasc.split('-').reverse().join('/') : '-'}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <div>
                <label className="label-modern">Classificação de Risco</label>
                <select
                  name="classificacaoRisco"
                  value={formData.classificacaoRisco}
                  onChange={handleChange}
                  className="input-modern"
                  style={{ cursor: 'pointer' }}
                >
                  <option value="PRIORITÁRIO">PRIORITÁRIO</option>
                  <option value="URGENTE">URGENTE</option>
                  <option value="ELETIVO">ELETIVO</option>
                </select>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1.2fr 1.2fr 1.4fr', gap: '16px' }}>
              <div>
                <label className="label-modern">CPF/CNS do Paciente</label>
                <input
                  type="text"
                  name="cnsPaciente"
                  value={formData.cnsPaciente || formData.cpfPaciente || ''}
                  onChange={handleChange}
                  placeholder="Documento"
                  className="input-modern"
                />
              </div>
              <div>
                <label className="label-modern">Sexo</label>
                <select
                  name="sexo"
                  value={formData.sexo}
                  onChange={handleChange}
                  className="input-modern"
                  style={{ cursor: 'pointer' }}
                >
                  <option value="M">Masculino</option>
                  <option value="F">Feminino</option>
                </select>
              </div>
              <div>
                <label className="label-modern">Data de Nascimento</label>
                <input
                  type="date"
                  name="dataNascimento"
                  value={formData.dataNascimento}
                  onChange={handleChange}
                  required
                  className="input-modern"
                />
              </div>
              <div>
                <label className="label-modern">Idade (Calculada)</label>
                <input
                  type="text"
                  name="idade"
                  value={formData.idade}
                  onChange={handleChange}
                  placeholder="Ex: 57 anos, 7 meses"
                  className="input-modern"
                />
              </div>
              <div>
                <label className="label-modern">Telefone de Contato</label>
                <input
                  type="text"
                  name="telefone"
                  value={formData.telefone}
                  onChange={handleChange}
                  placeholder="(63) 99999-9999"
                  className="input-modern"
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div>
                <label className="label-modern">Nome da Mãe</label>
                <input
                  type="text"
                  name="nomeMae"
                  value={formData.nomeMae}
                  onChange={handleChange}
                  className="input-modern"
                  placeholder="Nome completo da mãe"
                />
              </div>
              <div>
                <label className="label-modern">Município de Nascimento</label>
                <input
                  type="text"
                  name="municipioNascimento"
                  value={formData.municipioNascimento}
                  onChange={handleChange}
                  placeholder="Cidade / UF"
                  className="input-modern"
                />
              </div>
            </div>
          </div>
        </div>

        {/* ESPECIALIDADE E DIAGNÓSTICO */}
        <div className="card" style={{ padding: '28px' }}>
          <h3 style={{ fontFamily: 'Sora, sans-serif', fontSize: '15px', fontWeight: '700', color: '#172554', margin: '0 0 20px', borderBottom: '1px solid #e2e8f0', paddingBottom: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FileText size={18} style={{ color: '#3b82f6' }} />
            REFERÊNCIA E DIAGNÓSTICO
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div>
                <label className="label-modern">Especialidade Encaminhada</label>
                <div style={{ position: 'relative' }} onClick={e => e.stopPropagation()}>
                  <input
                    type="text"
                    name="especialidade"
                    value={formData.especialidade}
                    onChange={(e) => {
                      handleChange(e)
                      buscarSigtapLocal(e.target.value)
                    }}
                    required
                    placeholder="Ex: CONSULTA EM ORTOPEDIA"
                    className="input-modern"
                    autoComplete="off"
                  />
                  {sugestoesProcedimentos.length > 0 && (
                    <div style={{
                      position: 'absolute',
                      top: '100%',
                      left: 0,
                      right: 0,
                      backgroundColor: 'white',
                      border: '1px solid #e2e8f0',
                      borderRadius: '8px',
                      boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -2px rgba(0,0,0,0.05)',
                      zIndex: 50,
                      maxHeight: '160px',
                      overflowY: 'auto',
                      marginTop: '4px'
                    }}>
                      {sugestoesProcedimentos.map(proc => (
                        <div
                          key={proc.co_procedimento}
                          onClick={() => selecionarProcedimento(proc)}
                          style={{
                            padding: '8px 12px',
                            cursor: 'pointer',
                            borderBottom: '1px solid #f1f5f9',
                            fontSize: '12px',
                            color: '#1e293b',
                            transition: 'background-color 0.15s'
                          }}
                          onMouseEnter={e => e.currentTarget.style.backgroundColor = '#f1f5f9'}
                          onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                        >
                          <div style={{ fontWeight: '600' }}>{proc.no_procedimento}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              
              <div>
                <label className="label-modern">Hipótese / Diagnóstico (CID10)</label>
                <div style={{ position: 'relative' }} onClick={e => e.stopPropagation()}>
                  <input
                    type="text"
                    name="cid10"
                    value={formData.cid10 ? `${formData.cid10} - ${formData.diagnosticoDescricao}` : ''}
                    onChange={(e) => {
                      // Se o usuário limpar o campo
                      if (!e.target.value) {
                        setFormData(prev => ({ ...prev, cid10: '', diagnosticoDescricao: '' }))
                      }
                      buscarCidLocal(e.target.value)
                    }}
                    placeholder="Digite código ou descrição do CID10..."
                    className="input-modern"
                    autoComplete="off"
                  />
                  {sugestoesCid.length > 0 && (
                    <div style={{
                      position: 'absolute',
                      top: '100%',
                      left: 0,
                      right: 0,
                      backgroundColor: 'white',
                      border: '1px solid #e2e8f0',
                      borderRadius: '8px',
                      boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -2px rgba(0,0,0,0.05)',
                      zIndex: 50,
                      maxHeight: '160px',
                      overflowY: 'auto',
                      marginTop: '4px'
                    }}>
                      {sugestoesCid.map(c => (
                        <div
                          key={c.co_cid}
                          onClick={() => selecionarCid(c)}
                          style={{
                            padding: '8px 12px',
                            cursor: 'pointer',
                            borderBottom: '1px solid #f1f5f9',
                            fontSize: '12px',
                            color: '#1e293b',
                            transition: 'background-color 0.15s'
                          }}
                          onMouseEnter={e => e.currentTarget.style.backgroundColor = '#f1f5f9'}
                          onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                        >
                          <span style={{ fontWeight: '700', color: '#2563eb' }}>{c.co_cid}</span> - {c.no_cid}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
            
            <div>
              <label className="label-modern">Motivo do Encaminhamento</label>
              <textarea
                name="justificativaClinica"
                value={formData.justificativaClinica}
                onChange={handleChange}
                rows={5}
                required
                className="input-modern"
                style={{ lineHeight: '1.6', fontFamily: 'inherit' }}
                placeholder="Descreva o motivo clínico detalhado para o encaminhamento do paciente ao especialista..."
              />
            </div>

            <div>
              <label className="label-modern">Observação (Adicional)</label>
              <textarea
                name="observacao"
                value={formData.observacao}
                onChange={handleChange}
                rows={2}
                className="input-modern"
                style={{ lineHeight: '1.6', fontFamily: 'inherit' }}
                placeholder="Observações complementares..."
              />
            </div>
          </div>
        </div>

        {/* DADOS DO PROFISSIONAL SOLICITANTE */}
        <div className="card" style={{ padding: '28px' }}>
          <h3 style={{ fontFamily: 'Sora, sans-serif', fontSize: '15px', fontWeight: '700', color: '#172554', margin: '0 0 20px', borderBottom: '1px solid #e2e8f0', paddingBottom: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Stethoscope size={18} style={{ color: '#3b82f6' }} />
            PROFISSIONAL SOLICITANTE E ASSINATURA
          </h3>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '16px' }}>
              <div>
                <label className="label-modern">Nome do Profissional Solicitante</label>
                <div style={{ position: 'relative' }} onClick={e => e.stopPropagation()}>
                  <input
                    type="text"
                    name="nomeMedico"
                    value={formData.nomeMedico}
                    onChange={(e) => {
                      handleChange(e)
                      buscarProfissionaisLocal(e.target.value)
                    }}
                    onFocus={(e) => {
                      buscarProfissionaisLocal(e.target.value)
                    }}
                    onClick={(e) => {
                      buscarProfissionaisLocal(e.target.value)
                    }}
                    required
                    placeholder="Busque o profissional..."
                    className="input-modern"
                    autoComplete="off"
                  />
                  {sugestoesProfissionais.length > 0 && (
                    <div style={{
                      position: 'absolute',
                      top: '100%',
                      left: 0,
                      right: 0,
                      backgroundColor: 'white',
                      border: '1px solid #e2e8f0',
                      borderRadius: '8px',
                      boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -2px rgba(0,0,0,0.05)',
                      zIndex: 50,
                      maxHeight: '220px',
                      overflowY: 'auto',
                      marginTop: '4px'
                    }}>
                      {sugestoesProfissionais.map((prof, i) => (
                        <div
                          key={i}
                          onClick={() => selecionarProfissional(prof)}
                          style={{
                            padding: '10px 14px',
                            cursor: 'pointer',
                            borderBottom: '1px solid #f1f5f9',
                            fontSize: '13px',
                            color: '#1e293b',
                            transition: 'background-color 0.15s'
                          }}
                          onMouseEnter={e => e.currentTarget.style.backgroundColor = '#f1f5f9'}
                          onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                        >
                          <div style={{ fontWeight: '600' }}>{prof.nome}</div>
                          <div style={{ fontSize: '11px', color: '#64748b' }}>
                            {prof.crm ? `Conselho: ${prof.crm}` : 'Sem Registro'} {prof.cns ? `| CNS: ${prof.cns}` : ''}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              
              <div>
                <label className="label-modern">Conselho / CRM / Registro</label>
                <input
                  type="text"
                  name="crmMedico"
                  value={formData.crmMedico}
                  onChange={handleChange}
                  placeholder="CRM-TO 0000"
                  className="input-modern"
                />
              </div>

              <div>
                <label className="label-modern">CNS Profissional (Documento)</label>
                <input
                  type="text"
                  name="documentoSolicitanteNumero"
                  value={formData.documentoSolicitanteNumero}
                  onChange={handleChange}
                  placeholder="Nº CNS"
                  className="input-modern"
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div>
                <label className="label-modern">Cargo / Função do Profissional</label>
                <input
                  type="text"
                  name="cargoMedico"
                  value={formData.cargoMedico}
                  onChange={handleChange}
                  className="input-modern"
                />
              </div>
              <div>
                <label className="label-modern">Cidade, Data de Assinatura</label>
                <input
                  type="text"
                  name="cidadeData"
                  value={formData.cidadeData}
                  onChange={handleChange}
                  className="input-modern"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Botões do Rodapé */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '24px', borderTop: '1px solid #e2e8f0', paddingTop: '20px' }}>
          <button
            type="button"
            onClick={() => {
              if (confirm('Deseja limpar todos os dados digitados?')) {
                setCodigoBusca('')
                setErroBusca('')
                setSucessoBusca(false)
                
                let estSolicitante = 'SECRETARIA MUNICIPAL DE SAÚDE'
                if (typeof window !== 'undefined') {
                  const cached = localStorage.getItem('sms_client_config')
                  if (cached) {
                    try {
                      const cc = JSON.parse(cached)
                      if (cc.municipalityName) estSolicitante = `SECRETARIA MUNICIPAL DE SAÚDE DE ${cc.municipalityName.toUpperCase()}`
                    } catch (e) {}
                  }
                }

                setFormData(prev => ({
                  ...prev,
                  nomePaciente: '',
                  cnsPaciente: '',
                  cpfPaciente: '',
                  classificacaoRisco: 'PRIORITÁRIO',
                  sexo: 'F',
                  idade: '',
                  dataNascimento: '',
                  telefone: '',
                  nomeMae: '',
                  especialidade: '',
                  cid10: '',
                  diagnosticoDescricao: '',
                  justificativaClinica: '',
                  observacao: '',
                  nomeMedico: '',
                  crmMedico: '',
                  documentoSolicitanteNumero: '',
                  estabelecimentoSolicitante: estSolicitante
                }))
              }
            }}
            className="btn-secondary"
            style={{ padding: '10px 20px' }}
          >
            Limpar Formulário
          </button>
          
          <button
            type="submit"
            disabled={gerandoPdf}
            className="btn-primary"
            style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 24px', background: 'linear-gradient(135deg, #3b82f6, #2563eb)', boxShadow: '0 4px 12px rgba(59,130,246,0.2)' }}
          >
            {gerandoPdf ? (
              <>
                <RefreshCw className="animate-spin" size={16} />
                Gerando Guia...
              </>
            ) : (
              <>
                <Download size={16} />
                Gerar Guia de Encaminhamento (PDF)
              </>
            )}
          </button>
        </div>

      </form>

    </div>
  )
}
