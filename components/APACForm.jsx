'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Search, FileText, User, Stethoscope, Building, 
  AlertCircle, Download, CheckCircle, RefreshCw, Trash2
} from 'lucide-react'
import { supabase } from '@/lib/supabase'

export default function APACForm() {
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
  const [sugestoesSecundarios, setSugestoesSecundarios] = useState({})
  const [focoSecundario, setFocoSecundario] = useState({ index: null, campo: '' }) // index, campo: 'codigo' | 'nome'
  const [buscandoSigtap, setBuscandoSigtap] = useState(false)
  const [sugestoesProfissionais, setSugestoesProfissionais] = useState([])
  const [buscandoProfissionais, setBuscandoProfissionais] = useState(false)

  // Fecha todas as caixas de sugestões ao clicar fora
  useEffect(() => {
    const handleClose = () => {
      setSugestoesPacientes([])
      setSugestoesProcedimentos([])
      setSugestoesSecundarios({})
      setSugestoesProfissionais([])
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
        query = query.ilike('nome', `%${termo}%`)
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
      
      return {
        ...prev,
        nomePaciente: pac.nome || '',
        cnsPaciente: isCns ? limpo : '',
        dataNascimento: pac.dt_nasc || '',
        sexo: pac.sexo || 'M',
        telefone: pac.telefone || '',
        enderecoPaciente: pac.endereco ? `${pac.endereco}${pac.bairro ? ', ' + pac.bairro : ''}` : '',
        cep: pac.cep || ''
      }
    })
    setSugestoesPacientes([])
  }

  // Busca procedimentos no SIGTAP (por código ou nome)
  async function buscarSigtapLocal(val) {
    const termo = String(val || '').trim()
    if (termo.length < 3) {
      setSugestoesProcedimentos([])
      return
    }

    setBuscandoSigtap(true)
    try {
      const res = await fetch(`/api/sigtap/buscar?q=${encodeURIComponent(termo)}&limit=10`)
      if (res.ok) {
        const data = await res.json()
        if (data.ok && data.resultados) {
          setSugestoesProcedimentos(data.resultados)
        }
      }
    } catch (e) {
      console.error('Erro ao buscar SIGTAP:', e)
    } finally {
      setBuscandoSigtap(false)
    }
  }

  // Seleciona procedimento principal do SIGTAP
  const selecionarProcedimento = (proc) => {
    setFormData(prev => ({
      ...prev,
      codigoSigtap: proc.co_procedimento || '',
      descricaoProcedimento: proc.no_procedimento || ''
    }))
    setSugestoesProcedimentos([])
  }

  // Busca procedimentos secundários no SIGTAP
  async function buscarSigtapSecundario(index, val) {
    const termo = String(val || '').trim()
    if (termo.length < 3) {
      setSugestoesSecundarios(prev => ({ ...prev, [index]: [] }))
      return
    }

    try {
      const res = await fetch(`/api/sigtap/buscar?q=${encodeURIComponent(termo)}&limit=10`)
      if (res.ok) {
        const data = await res.json()
        if (data.ok && data.resultados) {
          setSugestoesSecundarios(prev => ({ ...prev, [index]: data.resultados }))
        }
      }
    } catch (e) {
      console.error('Erro ao buscar SIGTAP secundário:', e)
    }
  }

  // Seleciona procedimento secundário do SIGTAP
  const selecionarProcedimentoSecundario = (index, proc) => {
    const updated = [...procedimentosSecundarios]
    updated[index] = {
      ...updated[index],
      codigo: proc.co_procedimento || '',
      nome: proc.no_procedimento || ''
    }
    setProcedimentosSecundarios(updated)
    setSugestoesSecundarios(prev => ({ ...prev, [index]: [] }))
  }

  // Busca profissionais do CNES selecionado no SISREG (banco local) ou de forma geral na tabela de profissionais
  async function buscarProfissionaisLocal(val) {
    const termo = String(val || '').trim()
    
    // Se o termo for curto mas temos cnesSolicitante preenchido, podemos carregar todos os profissionais daquele CNES.
    // Caso contrário (sem CNES e termo curto), limpamos as sugestões e retornamos.
    if (termo.length < 3 && !formData.cnesSolicitante) {
      setSugestoesProfissionais([])
      return
    }

    setBuscandoProfissionais(true)
    try {
      let resultados = []
      
      // 1. Tenta buscar pela API de CNES se houver cnesSolicitante preenchido
      if (formData.cnesSolicitante) {
        const res = await fetch(`/api/cnes/profissionais?cnes=${formData.cnesSolicitante}`)
        if (res.ok) {
          const data = await res.json()
          if (data.ok && data.resultados) {
            if (termo.length >= 3) {
              // Filtra os resultados locais do CNES pelo termo digitado
              resultados = data.resultados.filter((p) => 
                p.nome.toUpperCase().includes(termo.toUpperCase()) || 
                (p.crm && p.crm.includes(termo))
              )
            } else {
              // Se o termo for curto (ex: campo em branco ou apenas focado), mostra todos
              resultados = data.resultados
            }
          }
        }
      }

      // 2. Se não encontramos nada ou não temos CNES (ou se o termo é curto e a busca por CNES retornou vazio),
      // buscamos no cadastro geral de especialidades_profissionais como fallback
      if (resultados.length === 0) {
        let query = supabase
          .from('especialidades_profissionais')
          .select('nome, conselho_tipo, conselho_numero')
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
      
      const tipoDoc = prof.cpf ? 'CPF' : (prof.cns ? 'CNS' : prev.documentoSolicitanteTipo)
      const numDoc = prof.cpf || prof.cns || ''

      return {
        ...prev,
        nomeMedico: prof.nome || '',
        crmMedico: crm,
        documentoSolicitanteTipo: numDoc ? tipoDoc : prev.documentoSolicitanteTipo,
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
    numeroProntuario: '',
    cnsPaciente: '',
    dataNascimento: '',
    sexo: 'M',
    nomeMae: '',
    telefone: '',
    enderecoPaciente: '',
    municipioPaciente: '',
    codigoIbge: '1705607', // Conceição do Tocantins
    ufPaciente: 'TO',
    cep: '',
    
    // Principal
    codigoSigtap: '',
    descricaoProcedimento: '',
    quantidade: 1,

    // Justificativa
    diagnosticoDescricao: '',
    cid10: '',
    cidSecundario: '',
    cidCausasAssociadas: '',
    justificativaClinica: '',

    // Solicitante
    nomeMedico: '',
    crmMedico: '',
    ufMedico: 'TO',
    dataSolicitacao: new Date().toISOString().split('T')[0],
    documentoSolicitanteTipo: 'CNS',
    documentoSolicitanteNumero: '',
  })

  // Procedimentos secundários (exatamente 5 linhas como no formulário)
  const [procedimentosSecundarios, setProcedimentosSecundarios] = useState([
    { codigo: '', nome: '', quantidade: '' },
    { codigo: '', nome: '', quantidade: '' },
    { codigo: '', nome: '', quantidade: '' },
    { codigo: '', nome: '', quantidade: '' },
    { codigo: '', nome: '', quantidade: '' }
  ])

  const [gerandoPdf, setGerandoPdf] = useState(false)

  // Verifica login e tenta carregar a identidade do município
  useEffect(() => {
    const u = localStorage.getItem('sms_user')
    if (!u) {
      router.push('/')
      return
    }
    setUsuario(JSON.parse(u))

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
            municipioPaciente: nomeMun
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
          setUnidadesSolicitantes(data.resultados.filter(u => !excluidos.includes(u.cnes)))
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

      // Preenche os campos do formulário com os dados do SISREG
      setFormData(prev => ({
        ...prev,
        estabelecimentoSolicitante: s.nome_unidade_solicitante || prev.estabelecimentoSolicitante,
        cnesSolicitante: s.codigo_unidade_solicitante || prev.cnesSolicitante,
        nomePaciente: s.no_usuario || '',
        cnsPaciente: s.cns_usuario || '',
        cpfPaciente: s.cpf_usuario || '',
        dataNascimento: s.dt_nascimento_usuario ? s.dt_nascimento_usuario.split('T')[0] : '',
        sexo: s.sexo_usuario === 'F' || s.sexo_usuario === 'FEMININO' ? 'F' : 'M',
        nomeMae: s.no_mae_usuario || '',
        telefone: s.telefone || '',
        enderecoPaciente: s.endereco_paciente || '',
        cep: s.cep_paciente || '',
        codigoIbge: s.codigo_ibge_paciente || prev.codigoIbge,
        municipioPaciente: s.municipio_paciente_residencia || prev.municipioPaciente,
        ufPaciente: s.uf_paciente || prev.ufPaciente,
        codigoSigtap: s.codigo_sigtap_procedimento || s.codigo_interno_procedimento || '', // Código Unificado do procedimento (SIGTAP)
        descricaoProcedimento: s.descricao_interna_procedimento || '',
        nomeMedico: s.nome_medico_solicitante || '',
        crmMedico: s.numero_crm || '',
        documentoSolicitanteTipo: s.cpf_profissional_solicitante ? 'CPF' : 'CNS',
        documentoSolicitanteNumero: s.cpf_profissional_solicitante || '',
        dataSolicitacao: s.data_solicitacao ? s.data_solicitacao.split('T')[0] : prev.dataSolicitacao,
        cid10: s.codigo_cid || '', // CID-10 Principal da solicitação
        diagnosticoDescricao: s.descricao_cid || s.descricao_interna_procedimento || '', // Descrição do CID
        justificativaClinica: s.justificativa_clinica || `Solicitação regulada no SISREG sob o nº ${s.codigo_solicitacao}. Procedimento aprovado para ser executado no estabelecimento ${s.nome_unidade_executante || 'não informado'}.`
      }))

      // Se a solicitação possui estabelecimento solicitante e CNES, adiciona na lista de dropdown se não existir e não estiver excluída
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
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  // Lida com mudanças nos procedimentos secundários
  const handleSecundarioChange = (index, field, value) => {
    const updated = [...procedimentosSecundarios]
    updated[index] = { ...updated[index], [field]: value }
    setProcedimentosSecundarios(updated)
  }

  // Limpa todos os secundários
  const limparSecundarios = () => {
    setProcedimentosSecundarios([
      { codigo: '', nome: '', quantidade: '' },
      { codigo: '', nome: '', quantidade: '' },
      { codigo: '', nome: '', quantidade: '' },
      { codigo: '', nome: '', quantidade: '' },
      { codigo: '', nome: '', quantidade: '' }
    ])
  }

  // Envia os dados e gera o PDF
  async function handleGerarPdf(e) {
    e.preventDefault()
    setGerandoPdf(true)

    // Agrupa dados principais com os procedimentos secundários
    const payload = {
      ...formData,
      procedimentosSecundarios: procedimentosSecundarios.filter(p => p.codigo || p.nome)
    }

    try {
      const response = await fetch('/api/apac/pdf', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(errorText || 'Falha ao gerar o laudo da APAC.')
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
          <Search size={18} style={{ color: '#10b981' }} />
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
            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '10px 24px', background: 'linear-gradient(135deg, #10b981, #059669)', boxShadow: '0 4px 12px rgba(16,185,129,0.2)' }}
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
              style={{ padding: '12px', background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.25)', borderRadius: '10px', color: '#065f46', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px', marginTop: '16px' }}
            >
              <CheckCircle size={18} className="shrink-0" style={{ color: '#10b981' }} />
              <span>Dados importados com sucesso! Revise as seções abaixo antes de gerar o PDF.</span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Formulário Principal */}
      <form onSubmit={handleGerarPdf} style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

        {/* 1. IDENTIFICAÇÃO DO ESTABELECIMENTO SOLICITANTE */}
        <div className="card" style={{ padding: '28px' }}>
          <h3 style={{ fontFamily: 'Sora, sans-serif', fontSize: '15px', fontWeight: '700', color: '#172554', margin: '0 0 20px', borderBottom: '1px solid #e2e8f0', paddingBottom: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Building size={18} style={{ color: '#10b981' }} />
            IDENTIFICAÇÃO DO ESTABELECIMENTO DE SAÚDE (SOLICITANTE)
          </h3>
          
          {/* Campo e botão de consulta IBGE */}
          <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '20px', marginBottom: '20px' }}>
            <h4 style={{ fontFamily: 'Sora, sans-serif', fontSize: '13px', fontWeight: '700', color: '#334155', margin: '0 0 12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Search size={14} style={{ color: '#10b981' }} />
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
            
            {/* Dropdown de Unidades */}
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
              <label className="label-modern">1 - Nome do Estabelecimento Solicitante</label>
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
              <label className="label-modern">2 - CNES</label>
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

        {/* 2. IDENTIFICAÇÃO DO PACIENTE */}
        <div className="card" style={{ padding: '28px' }}>
          <h3 style={{ fontFamily: 'Sora, sans-serif', fontSize: '15px', fontWeight: '700', color: '#172554', margin: '0 0 20px', borderBottom: '1px solid #e2e8f0', paddingBottom: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <User size={18} style={{ color: '#10b981' }} />
            IDENTIFICAÇÃO DO PACIENTE
          </h3>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '3fr 1fr', gap: '16px' }}>
              <div>
                <label className="label-modern">3 - Nome do Paciente (ou digite CPF/CNS para buscar)</label>
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
                    placeholder="Comece a digitar para buscar paciente no banco..."
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
                <label className="label-modern">4 - Nº do Prontuário</label>
                <input
                  type="text"
                  name="numeroProntuario"
                  value={formData.numeroProntuario}
                  onChange={handleChange}
                  className="input-modern"
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1.2fr 1.2fr', gap: '16px' }}>
              <div>
                <label className="label-modern">5 - Cartão Nacional de Saúde (CNS)</label>
                <input
                  type="text"
                  name="cnsPaciente"
                  value={formData.cnsPaciente}
                  onChange={handleChange}
                  placeholder="CNS do paciente"
                  className="input-modern"
                />
              </div>
              <div>
                <label className="label-modern">6 - Data de Nascimento</label>
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
                <label className="label-modern">7 - Sexo</label>
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
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '3fr 1fr', gap: '16px' }}>
              <div>
                <label className="label-modern">8 - Nome da Mãe ou Responsável</label>
                <input
                  type="text"
                  name="nomeMae"
                  value={formData.nomeMae}
                  onChange={handleChange}
                  className="input-modern"
                  placeholder="Nome completo da mãe ou do responsável legal"
                />
              </div>
              <div>
                <label className="label-modern">9 - Telefone de Contato</label>
                <input
                  type="text"
                  name="telefone"
                  value={formData.telefone}
                  onChange={handleChange}
                  placeholder="(00) 00000-0000"
                  className="input-modern"
                />
              </div>
            </div>

            <div>
              <label className="label-modern">10 - Endereço (Rua, Nº, Bairro)</label>
              <input
                type="text"
                name="enderecoPaciente"
                value={formData.enderecoPaciente}
                onChange={handleChange}
                className="input-modern"
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 0.5fr 1.5fr', gap: '16px' }}>
              <div>
                <label className="label-modern">11 - Município de Residência</label>
                <input
                  type="text"
                  name="municipioPaciente"
                  value={formData.municipioPaciente}
                  onChange={handleChange}
                  className="input-modern"
                />
              </div>
              <div>
                <label className="label-modern">12 - Cód. IBGE Município</label>
                <input
                  type="text"
                  name="codigoIbge"
                  value={formData.codigoIbge}
                  onChange={handleChange}
                  className="input-modern"
                  style={{ textAlign: 'center' }}
                />
              </div>
              <div>
                <label className="label-modern">13 - UF</label>
                <input
                  type="text"
                  name="ufPaciente"
                  value={formData.ufPaciente}
                  onChange={handleChange}
                  className="input-modern"
                  style={{ textAlign: 'center' }}
                />
              </div>
              <div>
                <label className="label-modern">14 - CEP</label>
                <input
                  type="text"
                  name="cep"
                  value={formData.cep}
                  onChange={handleChange}
                  placeholder="00000-000"
                  className="input-modern"
                  style={{ textAlign: 'center' }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* 3. PROCEDIMENTO PRINCIPAL */}
        <div className="card" style={{ padding: '28px' }}>
          <h3 style={{ fontFamily: 'Sora, sans-serif', fontSize: '15px', fontWeight: '700', color: '#172554', margin: '0 0 20px', borderBottom: '1px solid #e2e8f0', paddingBottom: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FileText size={18} style={{ color: '#10b981' }} />
            PROCEDIMENTO SOLICITADO
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1.8fr 3.2fr 0.6fr', gap: '16px' }}>
            <div>
              <label className="label-modern">15 - Código do Procedimento Principal</label>
              <div style={{ position: 'relative' }} onClick={e => e.stopPropagation()}>
                <input
                  type="text"
                  name="codigoSigtap"
                  value={formData.codigoSigtap}
                  onChange={(e) => {
                    handleChange(e)
                    buscarSigtapLocal(e.target.value)
                  }}
                  onFocus={() => setFocoProcedimento('codigo')}
                  required
                  placeholder="02XXXXXXXX"
                  className="input-modern"
                  style={{ color: '#047857', fontWeight: 'bold', background: 'rgba(16,185,129,0.05)', borderColor: '#a7f3d0' }}
                  autoComplete="off"
                />
                {sugestoesProcedimentos.length > 0 && focoProcedimento === 'codigo' && (
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
                    maxHeight: '200px',
                    overflowY: 'auto',
                    marginTop: '4px'
                  }}>
                    {sugestoesProcedimentos.map(proc => (
                      <div
                        key={proc.co_procedimento}
                        onClick={() => selecionarProcedimento(proc)}
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
                        <div style={{ fontWeight: '600' }}>{proc.co_procedimento}</div>
                        <div style={{ fontSize: '11px', color: '#64748b' }}>{proc.no_procedimento}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div>
              <label className="label-modern">16 - Nome do Procedimento Principal</label>
              <div style={{ position: 'relative' }} onClick={e => e.stopPropagation()}>
                <input
                  type="text"
                  name="descricaoProcedimento"
                  value={formData.descricaoProcedimento}
                  onChange={(e) => {
                    handleChange(e)
                    buscarSigtapLocal(e.target.value)
                  }}
                  onFocus={() => setFocoProcedimento('descricao')}
                  required
                  placeholder="Pesquise por nome do procedimento..."
                  className="input-modern"
                  autoComplete="off"
                />
                {sugestoesProcedimentos.length > 0 && focoProcedimento === 'descricao' && (
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
                    maxHeight: '200px',
                    overflowY: 'auto',
                    marginTop: '4px'
                  }}>
                    {sugestoesProcedimentos.map(proc => (
                      <div
                        key={proc.co_procedimento}
                        onClick={() => selecionarProcedimento(proc)}
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
                        <div style={{ fontWeight: '600' }}>{proc.no_procedimento}</div>
                        <div style={{ fontSize: '11px', color: '#64748b' }}>Código: {proc.co_procedimento}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div>
              <label className="label-modern" style={{ textAlign: 'center' }}>17 - Qtde.</label>
              <input
                type="number"
                name="quantidade"
                value={formData.quantidade}
                onChange={handleChange}
                required
                min="1"
                className="input-modern"
                style={{ textAlign: 'center', fontWeight: 'bold' }}
              />
            </div>
          </div>
        </div>

        {/* 4. PROCEDIMENTO(S) SECUNDÁRIO(S) */}
        <div className="card" style={{ padding: '28px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', marginBottom: '20px', borderBottom: '1px solid #e2e8f0', paddingBottom: '10px' }}>
            <h3 style={{ fontFamily: 'Sora, sans-serif', fontSize: '15px', fontWeight: '700', color: '#172554', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <FileText size={18} style={{ color: '#10b981' }} />
              PROCEDIMENTO(S) SECUNDÁRIO(S) (Opcional - Máximo 5)
            </h3>
            <button
              type="button"
              onClick={limparSecundarios}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#ef4444',
                cursor: 'pointer',
                fontSize: '12px',
                fontWeight: '600',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                padding: '6px 12px',
                borderRadius: '8px',
                transition: 'background 0.2s'
              }}
              onMouseEnter={e => e.currentTarget.style.background = '#fef2f2'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              <Trash2 size={14} />
              Limpar Secundários
            </button>
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {procedimentosSecundarios.map((proc, index) => {
              const startNum = 18 + (index * 3)
              return (
                <div key={index} style={{ display: 'grid', gridTemplateColumns: '1.8fr 3.2fr 0.6fr', gap: '16px', borderBottom: index < 4 ? '1px solid #f1f5f9' : 'none', paddingBottom: index < 4 ? '16px' : 0 }}>
                  <div>
                    <label className="label-modern" style={{ color: '#94a3b8', fontSize: '10px' }}>{startNum} - Código Secundário</label>
                    <div style={{ position: 'relative' }} onClick={e => e.stopPropagation()}>
                      <input
                        type="text"
                        value={proc.codigo}
                        onChange={(e) => {
                          handleSecundarioChange(index, 'codigo', e.target.value)
                          buscarSigtapSecundario(index, e.target.value)
                        }}
                        onFocus={() => setFocoSecundario({ index, campo: 'codigo' })}
                        placeholder="Código SIGTAP"
                        className="input-modern"
                        autoComplete="off"
                      />
                      {sugestoesSecundarios[index]?.length > 0 && focoSecundario.index === index && focoSecundario.campo === 'codigo' && (
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
                          {sugestoesSecundarios[index].map(p => (
                            <div
                              key={p.co_procedimento}
                              onClick={() => selecionarProcedimentoSecundario(index, p)}
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
                              <div style={{ fontWeight: '600' }}>{p.co_procedimento}</div>
                              <div style={{ fontSize: '10px', color: '#64748b' }}>{p.no_procedimento}</div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  <div>
                    <label className="label-modern" style={{ color: '#94a3b8', fontSize: '10px' }}>{startNum + 1} - Nome do Procedimento Secundário</label>
                    <div style={{ position: 'relative' }} onClick={e => e.stopPropagation()}>
                      <input
                        type="text"
                        value={proc.nome}
                        onChange={(e) => {
                          handleSecundarioChange(index, 'nome', e.target.value)
                          buscarSigtapSecundario(index, e.target.value)
                        }}
                        onFocus={() => setFocoSecundario({ index, campo: 'nome' })}
                        placeholder="Nome do procedimento secundário"
                        className="input-modern"
                        autoComplete="off"
                      />
                      {sugestoesSecundarios[index]?.length > 0 && focoSecundario.index === index && focoSecundario.campo === 'nome' && (
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
                          {sugestoesSecundarios[index].map(p => (
                            <div
                              key={p.co_procedimento}
                              onClick={() => selecionarProcedimentoSecundario(index, p)}
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
                              <div style={{ fontWeight: '600' }}>{p.no_procedimento}</div>
                              <div style={{ fontSize: '10px', color: '#64748b' }}>Código: {p.co_procedimento}</div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  <div>
                    <label className="label-modern" style={{ color: '#94a3b8', fontSize: '10px', textAlign: 'center' }}>{startNum + 2} - Qtde.</label>
                    <input
                      type="number"
                      value={proc.quantidade}
                      onChange={e => handleSecundarioChange(index, 'quantidade', e.target.value)}
                      placeholder="Qtd"
                      min="1"
                      className="input-modern"
                      style={{ textAlign: 'center' }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* 5. JUSTIFICATIVA E DIAGNÓSTICO */}
        <div className="card" style={{ padding: '28px' }}>
          <h3 style={{ fontFamily: 'Sora, sans-serif', fontSize: '15px', fontWeight: '700', color: '#172554', margin: '0 0 20px', borderBottom: '1px solid #e2e8f0', paddingBottom: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertCircle size={18} style={{ color: '#10b981' }} />
            JUSTIFICATIVA DO(S) PROCEDIMENTO(S) SOLICITADO(S)
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '3fr 1fr 1fr 1fr', gap: '16px' }}>
              <div>
                <label className="label-modern">33 - Descrição do Diagnóstico</label>
                <input
                  type="text"
                  name="diagnosticoDescricao"
                  value={formData.diagnosticoDescricao}
                  onChange={handleChange}
                  className="input-modern"
                />
              </div>
              <div>
                <label className="label-modern">34 - CID-10 Principal</label>
                <input
                  type="text"
                  name="cid10"
                  value={formData.cid10}
                  onChange={handleChange}
                  required
                  placeholder="Ex: C50"
                  className="input-modern"
                  style={{ color: '#065f46', fontWeight: 'bold', background: 'rgba(16,185,129,0.05)', borderColor: '#a7f3d0', textAlign: 'center' }}
                />
              </div>
              <div>
                <label className="label-modern">35 - CID Sec.</label>
                <input
                  type="text"
                  name="cidSecundario"
                  value={formData.cidSecundario}
                  onChange={handleChange}
                  className="input-modern"
                  style={{ textAlign: 'center' }}
                />
              </div>
              <div>
                <label className="label-modern">36 - CID Assoc.</label>
                <input
                  type="text"
                  name="cidCausasAssociadas"
                  value={formData.cidCausasAssociadas}
                  onChange={handleChange}
                  className="input-modern"
                  style={{ textAlign: 'center' }}
                />
              </div>
            </div>
            
            <div>
              <label className="label-modern">37 - Observações / Justificativa Clínica</label>
              <textarea
                name="justificativaClinica"
                value={formData.justificativaClinica}
                onChange={handleChange}
                rows={5}
                className="input-modern"
                style={{ lineHeight: '1.6', fontFamily: 'inherit' }}
              />
            </div>
          </div>
        </div>

        {/* 6. SOLICITAÇÃO (PROFISSIONAL SOLICITANTE) */}
        <div className="card" style={{ padding: '28px' }}>
          <h3 style={{ fontFamily: 'Sora, sans-serif', fontSize: '15px', fontWeight: '700', color: '#172554', margin: '0 0 20px', borderBottom: '1px solid #e2e8f0', paddingBottom: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Stethoscope size={18} style={{ color: '#10b981' }} />
            SOLICITAÇÃO (PROFISSIONAL SOLICITANTE)
          </h3>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: '16px' }}>
              <div>
                <label className="label-modern">38 - Nome do Profissional Solicitante</label>
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
                    placeholder={formData.cnesSolicitante ? "Clique ou digite para buscar profissional do CNES..." : "Comece a digitar para buscar médico..."}
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
                            {prof.crm ? `Conselho: ${prof.crm}` : 'Conselho não cadastrado'} {prof.cpf ? `| CPF: ${prof.cpf}` : (prof.cns ? `| CNS: ${prof.cns}` : '')}
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
                  className="input-modern"
                />
              </div>
              <div>
                <label className="label-modern">39 - Data da Solicitação</label>
                <input
                  type="date"
                  name="dataSolicitacao"
                  value={formData.dataSolicitacao}
                  onChange={handleChange}
                  required
                  className="input-modern"
                />
              </div>
              <div>
                <label className="label-modern">40 - Tipo de Documento</label>
                <select
                  name="documentoSolicitanteTipo"
                  value={formData.documentoSolicitanteTipo}
                  onChange={handleChange}
                  className="input-modern"
                  style={{ cursor: 'pointer' }}
                >
                  <option value="CNS">CNS</option>
                  <option value="CPF">CPF</option>
                </select>
              </div>
            </div>

            <div>
              <label className="label-modern">41 - Número do Documento do Solicitante (CNS ou CPF)</label>
              <input
                type="text"
                name="documentoSolicitanteNumero"
                value={formData.documentoSolicitanteNumero}
                onChange={handleChange}
                className="input-modern"
              />
            </div>
          </div>
        </div>

        {/* Botões do Rodapé */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '24px', borderTop: '1px solid #e2e8f0', paddingTop: '20px' }}>
          <button
            type="button"
            onClick={() => {
              if(confirm('Deseja limpar todos os dados digitados?')) {
                setCodigoBusca('')
                setErroBusca('')
                setSucessoBusca(false)
                
                let estSolicitante = 'SECRETARIA MUNICIPAL DE SAÚDE'
                let munPaciente = ''
                
                if (typeof window !== 'undefined') {
                  const cached = localStorage.getItem('sms_client_config')
                  if (cached) {
                    try {
                      const cc = JSON.parse(cached)
                      if (cc.municipalityName) {
                        const nomeMun = cc.municipalityName.toUpperCase()
                        estSolicitante = `SECRETARIA MUNICIPAL DE SAÚDE DE ${nomeMun}`
                        munPaciente = nomeMun
                      }
                    } catch (e) {}
                  }
                }

                setFormData({
                  estabelecimentoSolicitante: estSolicitante,
                  cnesSolicitante: '1234567',
                  nomePaciente: '',
                  numeroProntuario: '',
                  cnsPaciente: '',
                  dataNascimento: '',
                  sexo: 'M',
                  nomeMae: '',
                  telefone: '',
                  enderecoPaciente: '',
                  municipioPaciente: munPaciente,
                  codigoIbge: '1705607',
                  ufPaciente: 'TO',
                  cep: '',
                  codigoSigtap: '',
                  descricaoProcedimento: '',
                  quantidade: 1,
                  diagnosticoDescricao: '',
                  cid10: '',
                  cidSecundario: '',
                  cidCausasAssociadas: '',
                  justificativaClinica: '',
                  nomeMedico: '',
                  crmMedico: '',
                  ufMedico: 'TO',
                  dataSolicitacao: new Date().toISOString().split('T')[0],
                  documentoSolicitanteTipo: 'CNS',
                  documentoSolicitanteNumero: '',
                  cpfPaciente: ''
                })
                limparSecundarios()
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
            style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 24px', background: 'linear-gradient(135deg, #10b981, #059669)', boxShadow: '0 4px 12px rgba(16,185,129,0.2)' }}
          >
            {gerandoPdf ? (
              <>
                <RefreshCw className="animate-spin" size={16} />
                Gerando Laudo...
              </>
            ) : (
              <>
                <Download size={16} />
                Gerar Laudo APAC (PDF)
              </>
            )}
          </button>
        </div>

      </form>

    </div>
  )
}
