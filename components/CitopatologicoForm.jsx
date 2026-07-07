'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Search, FileText, User, Stethoscope, Building, 
  AlertCircle, Download, CheckCircle, RefreshCw, Trash2, Heart, Loader2
} from 'lucide-react'
import { supabase } from '@/lib/supabase'

function calcularIdadeCompleta(dataNasc) {
  if (!dataNasc) return ''
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
  }
  
  if (meses < 0) {
    anos--
  }
  
  return `${anos} ano${anos !== 1 ? 's' : ''}`
}

function normalizarRaca(racaStr) {
  if (!racaStr) return '03' // parda default
  const r = String(racaStr).toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim()
  if (r.includes('BRANCA') || r === '1' || r === '01') return '01'
  if (r.includes('PRETA') || r === '2' || r === '02') return '02'
  if (r.includes('PARDA') || r === '3' || r === '03') return '03'
  if (r.includes('AMARELA') || r === '4' || r === '04') return '04'
  if (r.includes('INDIGENA') || r.includes('ETNIA') || r === '5' || r === '05') return '05'
  return '03' // parda default
}

export default function CitopatologicoForm() {
  const router = useRouter()
  const [usuario, setUsuario] = useState(null)
  
  // Estados de busca de paciente
  const [sugestoesPacientes, setSugestoesPacientes] = useState([])
  const [gerandoPdf, setGerandoPdf] = useState(false)
  const [avisoSexo, setAvisoSexo] = useState(false)

  // Estados de Unidades e Profissionais SCNES
  const [unidadesSolicitantes, setUnidadesSolicitantes] = useState([])
  const [carregandoUnidades, setCarregandoUnidades] = useState(false)
  const [excluidosCnes, setExcluidosCnes] = useState([])
  const [ibgeConsulta, setIbgeConsulta] = useState('1705607')

  const [sugestoesProfissionais, setSugestoesProfissionais] = useState([])
  const [buscandoProfissionais, setBuscandoProfissionais] = useState(false)

  // Estados de busca por solicitação do SISREG
  const [codigoBusca, setCodigoBusca] = useState('')
  const [buscando, setBuscando] = useState(false)
  const [erroBusca, setErroBusca] = useState('')
  const [sucessoBusca, setSucessoBusca] = useState(false)

  // Dados do formulário
  const [formData, setFormData] = useState({
    // Unidade
    ufUnidade: 'TO',
    cnesUnidade: '',
    unidadeSaude: '',
    municipioUnidade: '',
    prontuario: '',
    numeroProtocolo: '',

    // Informações Pessoais
    cnsPaciente: '',
    nomePaciente: '',
    nomeMae: '',
    apelido: '',
    cpfPaciente: '',
    nacionalidade: 'BRASILEIRA',
    dataNascimento: '',
    idade: '',
    sexo: '',
    raca: '03', // parda default

    // Endereço
    logradouro: '',
    numero: '',
    complemento: '',
    bairro: '',
    ufResidencia: 'TO',
    codigoMunicipio: '170560',
    municipio: 'CONCEIÇÃO DO TOCANTINS',
    cep: '77305000',
    ddd: '63',
    telefone: '',
    pontoReferencia: '',
    escolaridade: 'Ensino Médio Completo',

    // Anamnese - DEVEM VIR EM BRANCO
    motivoExame: '',
    fezPreventivo: '',
    preventivoAno: '',
    usaDiu: '',
    estaGravida: '',
    usaPilula: '',
    usaHormonioMenopausa: '',
    tratamentoRadioterapia: '',
    dataUltimaMenstruacao: '',
    dumNaoSabe: false,
    sangramentoAposRacao: '',
    sangramentoAposMenopausa: '',

    // Exame Clínico - EM BRANCO
    inspecaoColo: '',
    sinaisDst: '',

    // Coleta - DEVEM VIR EM BRANCO
    dataColeta: '',
    responsavel: ''
  })

  useEffect(() => {
    const u = localStorage.getItem('sms_user')
    if (u) {
      const parsedUser = JSON.parse(u)
      setUsuario(parsedUser)
    }
  }, [])

  // Fecha todas as caixas de sugestões ao clicar fora
  useEffect(() => {
    const handleClose = () => {
      setSugestoesPacientes([])
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
    const limpo = pac.cpf_cns ? pac.cpf_cns.replace(/\D/g, '') : ''
    const isCns = limpo.length >= 15
    const dataNasc = pac.dt_nasc || ''
    const idadeCalculada = calcularIdadeCompleta(dataNasc)

    // Alerta de gênero
    if (pac.sexo === 'M' || pac.sexo === 'MASCULINO' || pac.sexo === 'Masculino') {
      setAvisoSexo(true)
    } else {
      setAvisoSexo(false)
    }

    setFormData(prev => ({
      ...prev,
      nomePaciente: pac.nome || '',
      cnsPaciente: isCns ? limpo : '',
      cpfPaciente: !isCns ? limpo : '',
      dataNascimento: dataNasc,
      idade: idadeCalculada,
      sexo: pac.sexo || '',
      telefone: pac.telefone || '',
      nomeMae: pac.mae || '',
      logradouro: pac.endereco || '',
      bairro: pac.bairro || '',
      cep: pac.cep || '77305000',
      raca: normalizarRaca(pac.raca)
    }))
    setSugestoesPacientes([])
  }

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
        cnesUnidade: '',
        unidadeSaude: '',
        municipioUnidade: ''
      }))
      return
    }
    const NOMES_MUNICIPIOS = {
      '1705607': 'CONCEIÇÃO DO TOCANTINS',
      '170560': 'CONCEIÇÃO DO TOCANTINS',
      '1721000': 'PALMAS',
      '172100': 'PALMAS',
      '1718204': 'PORTO NACIONAL',
      '171820': 'PORTO NACIONAL',
      '1707001': 'DIANÓPOLIS',
      '170700': 'DIANÓPOLIS',
      '1702406': 'ARRAIAS',
      '170240': 'ARRAIAS',
      '1716109': 'PARANÃ',
      '171610': 'PARANÃ',
      '1720903': 'TAGUATINGA',
      '172090': 'TAGUATINGA',
      '1714302': 'NATIVIDADE',
      '171430': 'NATIVIDADE',
      '1700402': 'ALMAS',
      '170040': 'ALMAS',
      '1718006': 'PONTE ALTA DO BOM JESUS',
      '171800': 'PONTE ALTA DO BOM JESUS',
      '1702901': 'AURORA DO TOCANTINS',
      '170290': 'AURORA DO TOCANTINS',
      '1709502': 'GURUPI',
      '170950': 'GURUPI'
    }
    const unidade = unidadesSolicitantes.find(u => u.cnes === cnes)
    if (unidade) {
      const nomeMuni = NOMES_MUNICIPIOS[ibgeConsulta] || 'CONCEIÇÃO DO TOCANTINS'
      setFormData(prev => ({
        ...prev,
        cnesUnidade: cnes,
        unidadeSaude: unidade.nome,
        municipioUnidade: nomeMuni
      }))
      // Puxa profissionais do CNES selecionado
      buscarProfissionaisCNES('', cnes)
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
      if (formData.cnesUnidade === cnes) {
        setFormData(prev => ({
          ...prev,
          cnesUnidade: '',
          unidadeSaude: ''
        }))
      }
    }
  }

  async function buscarProfissionaisCNES(val, customCnes = null) {
    const termo = String(val || '').trim()
    const targetCnes = customCnes || formData.cnesUnidade
    
    if (termo.length < 3 && !targetCnes) {
      setSugestoesProfissionais([])
      return
    }

    setBuscandoProfissionais(true)
    try {
      let resultados = []
      
      if (targetCnes) {
        const res = await fetch(`/api/cnes/profissionais?cnes=${targetCnes}`)
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
          .select('nome')
          .eq('ativo', true)
          .order('nome')
          .limit(10)

        if (termo.length >= 3) {
          query = query.ilike('nome', `%${termo}%`)
        }

        const { data, error } = await query
        if (!error && data) {
          resultados = data.map(p => ({
            nome: p.nome,
            crm: '',
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

  // Função para buscar a solicitação no SISREG por CPF ou CNS
  async function buscarSolicitacao() {
    const docClean = codigoBusca.replace(/\D/g, '')
    if (!docClean || docClean.length < 11) {
      setErroBusca('Por favor, digite um CPF (11 dígitos) ou CNS (15 dígitos) válido.')
      return
    }

    setBuscando(true)
    setErroBusca('')
    setSucessoBusca(false)

    try {
      const res = await fetch(`/api/sisreg/buscar?documento=${docClean}`)
      const resData = await res.json()

      if (!res.ok) {
        throw new Error(resData.error || 'Erro ao buscar dados do paciente no SISREG.')
      }

      const s = resData.data

      // Preenche os campos do formulário com os dados do SISREG
      setFormData(prev => ({
        ...prev,
        nomePaciente: s.no_usuario || '',
        cnsPaciente: s.cns_usuario || '',
        cpfPaciente: s.cpf_usuario || '',
        dataNascimento: s.dt_nascimento_usuario ? s.dt_nascimento_usuario.split('T')[0] : '',
        sexo: s.sexo_usuario === 'F' || s.sexo_usuario === 'FEMININO' ? 'F' : 'M',
        nomeMae: s.no_mae_usuario || '',
        telefone: s.telefone || '',
        logradouro: s.tipo_logradouro_paciente_residencia 
          ? `${s.tipo_logradouro_paciente_residencia} ${s.endereco_paciente_residencia || ''}`.trim()
          : (s.endereco_paciente_residencia || ''),
        numero: s.numero_paciente_residencia || '',
        bairro: s.bairro_paciente_residencia || '',
        cep: s.cep_paciente_residencia || '',
        codigoMunicipio: s.codigo_ibge_paciente || prev.codigoMunicipio,
        municipio: s.municipio_paciente_residencia || prev.municipio,
        ufResidencia: s.uf_paciente || prev.ufResidencia,
        idade: s.dt_nascimento_usuario ? calcularIdadeCompleta(s.dt_nascimento_usuario.split('T')[0]) : '',
        raca: normalizarRaca(s.raca_usuario)
      }))

      // Atualiza dropdown de unidades
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

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }))
  }

  const handleGerarPdf = async (e) => {
    e.preventDefault()
    setGerandoPdf(true)

    try {
      const response = await fetch('/api/citopatologico/pdf', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(errorText || 'Falha ao gerar a requisição.')
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
          Buscar Dados da Paciente no SISREG (por CPF ou CNS)
        </h2>
        
        <div style={{ display: 'flex', gap: '12px' }}>
          <div style={{ position: 'relative', flexGrow: 1 }}>
            <input
              type="text"
              placeholder="Insira o CPF (11 dígitos) ou CNS (15 dígitos) da paciente..."
              value={codigoBusca}
              onChange={(e) => setCodigoBusca(e.target.value)}
              className="input-modern"
              style={{ paddingLeft: '40px' }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') buscarSolicitacao()
              }}
            />
            <Search size={16} style={{ position: 'absolute', left: '14px', top: '13px', color: '#94a3b8' }} />
          </div>
          <button
            type="button"
            onClick={buscarSolicitacao}
            disabled={buscando}
            className="btn-primary"
            style={{
              background: '#059669',
              color: 'white',
              border: 'none',
              borderRadius: '10px',
              padding: '0 24px',
              fontWeight: '600',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              height: '42px'
            }}
          >
            {buscando ? (
              <>
                <Loader2 size={16} className="animate-spin" /> Buscando...
              </>
            ) : (
              <>
                <Search size={16} /> Buscar Dados
              </>
            )}
          </button>
        </div>

        {erroBusca && (
          <div style={{ color: '#dc2626', fontSize: '12.5px', marginTop: '8px', fontWeight: '500' }}>
            ❌ {erroBusca}
          </div>
        )}
        {sucessoBusca && (
          <div style={{ color: '#16a34a', fontSize: '12.5px', marginTop: '8px', fontWeight: '500' }}>
            ✅ Solicitação carregada com sucesso! Os campos foram preenchidos.
          </div>
        )}
      </div>



      {/* Formulário Principal */}
      <form onSubmit={handleGerarPdf} style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        <div className="card" style={{ padding: '28px' }}>
          <h3 style={{ fontFamily: 'Sora, sans-serif', fontSize: '15px', fontWeight: '700', color: '#172554', margin: '0 0 20px', borderBottom: '1px solid #e2e8f0', paddingBottom: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Building size={18} style={{ color: '#10b981' }} />
            IDENTIFICAÇÃO DA UNIDADE DE SAÚDE SOLICITANTE
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
                    value={formData.cnesUnidade}
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
                  {formData.cnesUnidade && (
                    <button
                      type="button"
                      onClick={() => excluirEstabelecimento(formData.cnesUnidade)}
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
                  fontWeight: '600',
                  marginTop: '12px',
                  textDecoration: 'underline',
                  display: 'block'
                }}
              >
                Restaurar estabelecimentos ocultados
              </button>
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
            <div>
              <label className="label-modern">CNES da Unidade *</label>
              <input type="text" name="cnesUnidade" value={formData.cnesUnidade} onChange={handleChange} required className="input-modern" />
            </div>
            <div>
              <label className="label-modern">Nome da Unidade *</label>
              <input type="text" name="unidadeSaude" value={formData.unidadeSaude} onChange={handleChange} required className="input-modern" />
            </div>
            <div>
              <label className="label-modern">Município *</label>
              <input type="text" name="municipioUnidade" value={formData.municipioUnidade} onChange={handleChange} required className="input-modern" />
            </div>
            <div>
              <label className="label-modern">Nº Prontuário</label>
              <input type="text" name="prontuario" value={formData.prontuario} onChange={handleChange} className="input-modern" placeholder="Opcional" />
            </div>
            <div>
              <label className="label-modern">Nº Protocolo (SISCAN)</label>
              <input type="text" name="numeroProtocolo" value={formData.numeroProtocolo} onChange={handleChange} className="input-modern" placeholder="Gerado automaticamente se vazio" />
            </div>
          </div>
        </div>

        {/* 2. DADOS DA MULHER */}
        <div className="card" style={{ padding: '28px' }}>
          <h3 style={{ fontFamily: 'Sora, sans-serif', fontSize: '15px', fontWeight: '700', color: '#172554', margin: '0 0 20px', borderBottom: '1px solid #e2e8f0', paddingBottom: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <User size={18} style={{ color: '#10b981' }} />
            INFORMAÇÕES PESSOAIS DA PACIENTE
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '16px' }}>
            <div>
              <label className="label-modern">Cartão SUS *</label>
              <input type="text" name="cnsPaciente" value={formData.cnsPaciente} onChange={handleChange} required maxLength={15} placeholder="Apenas números" className="input-modern" />
            </div>
            <div>
              <label className="label-modern">Nome Completo *</label>
              <input type="text" name="nomePaciente" value={formData.nomePaciente} onChange={handleChange} required className="input-modern" />
            </div>
            <div>
              <label className="label-modern">Nome Completo da Mãe *</label>
              <input type="text" name="nomeMae" value={formData.nomeMae} onChange={handleChange} required className="input-modern" />
            </div>
            <div>
              <label className="label-modern">CPF</label>
              <input type="text" name="cpfPaciente" value={formData.cpfPaciente} onChange={handleChange} placeholder="Opcional" className="input-modern" />
            </div>
            <div>
              <label className="label-modern">Apelido</label>
              <input type="text" name="apelido" value={formData.apelido} onChange={handleChange} placeholder="Opcional" className="input-modern" />
            </div>
            <div>
              <label className="label-modern">Data de Nascimento *</label>
              <input type="date" name="dataNascimento" value={formData.dataNascimento} onChange={(e) => {
                handleChange(e)
                setFormData(prev => ({
                  ...prev,
                  idade: calcularIdadeCompleta(e.target.value)
                }))
              }} required className="input-modern" />
            </div>
            <div>
              <label className="label-modern">Idade Calculada</label>
              <input type="text" name="idade" value={formData.idade} readOnly className="input-modern" style={{ background: '#f1f5f9' }} />
            </div>
            <div>
              <label className="label-modern">Raça/Cor *</label>
              <select name="raca" value={formData.raca} onChange={handleChange} className="input-modern">
                <option value="01">Branca</option>
                <option value="02">Preta</option>
                <option value="03">Parda</option>
                <option value="04">Amarela</option>
                <option value="05">Indígena / Etnia</option>
              </select>
            </div>
            <div>
              <label className="label-modern">Nacionalidade</label>
              <input type="text" name="nacionalidade" value={formData.nacionalidade} onChange={handleChange} className="input-modern" />
            </div>
          </div>

          <h4 style={{ fontFamily: 'Sora, sans-serif', fontSize: '13px', fontWeight: '700', color: '#475569', margin: '20px 0 10px' }}>Endereço Residencial</h4>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
            <div style={{ gridColumn: 'span 2' }}>
              <label className="label-modern">Logradouro (Rua, Av.)</label>
              <input type="text" name="logradouro" value={formData.logradouro} onChange={handleChange} className="input-modern" />
            </div>
            <div>
              <label className="label-modern">Número</label>
              <input type="text" name="numero" value={formData.numero} onChange={handleChange} className="input-modern" />
            </div>
            <div>
              <label className="label-modern">Complemento</label>
              <input type="text" name="complemento" value={formData.complemento} onChange={handleChange} className="input-modern" />
            </div>
            <div>
              <label className="label-modern">Bairro</label>
              <input type="text" name="bairro" value={formData.bairro} onChange={handleChange} className="input-modern" />
            </div>
            <div>
              <label className="label-modern">CEP</label>
              <input type="text" name="cep" value={formData.cep} onChange={handleChange} className="input-modern" />
            </div>
            <div>
              <label className="label-modern">Telefone</label>
              <input type="text" name="telefone" value={formData.telefone} onChange={handleChange} className="input-modern" />
            </div>
            <div>
              <label className="label-modern">Ponto de Referência</label>
              <input type="text" name="pontoReferencia" value={formData.pontoReferencia} onChange={handleChange} className="input-modern" />
            </div>
            <div>
              <label className="label-modern">Escolaridade</label>
              <select name="escolaridade" value={formData.escolaridade} onChange={handleChange} className="input-modern">
                <option value="Analfabeta">Analfabeta</option>
                <option value="Ensino Fundamental Incompleto">Ensino Fundamental Incompleto</option>
                <option value="Ensino Fundamental Completo">Ensino Fundamental Completo</option>
                <option value="Ensino Médio Completo">Ensino Médio Completo</option>
                <option value="Ensino Superior Completo">Ensino Superior Completo</option>
              </select>
            </div>
          </div>
        </div>

        {/* 3. ANAMNESE */}
        <div className="card" style={{ padding: '28px' }}>
          <h3 style={{ fontFamily: 'Sora, sans-serif', fontSize: '15px', fontWeight: '700', color: '#172554', margin: '0 0 20px', borderBottom: '1px solid #e2e8f0', paddingBottom: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Heart size={18} style={{ color: '#10b981' }} />
            DADOS DA ANAMNESE (HISTÓRICO CLÍNICO)
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '28px', flexWrap: 'wrap' }}>
            
            {/* Esquerda */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label className="label-modern">1. Motivo do exame *</label>
                <div style={{ display: 'flex', gap: '14px', marginTop: '4px' }}>
                  {['Rastreamento', 'Repetição', 'Seguimento'].map(opt => (
                    <label key={opt} style={{ fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                      <input type="radio" name="motivoExame" value={opt} checked={formData.motivoExame === opt} onChange={handleChange} /> {opt}
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="label-modern">2. Fez o exame preventivo alguma vez? *</label>
                <div style={{ display: 'flex', gap: '14px', marginTop: '4px', marginBottom: '8px' }}>
                  {['Sim', 'Não', 'Não sabe'].map(opt => (
                    <label key={opt} style={{ fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                      <input type="radio" name="fezPreventivo" value={opt} checked={formData.fezPreventivo === opt} onChange={handleChange} /> {opt}
                    </label>
                  ))}
                </div>
                {formData.fezPreventivo === 'Sim' && (
                  <div>
                    <label className="label-modern" style={{ fontSize: '11px' }}>Quando fez o último exame (Ano)?</label>
                    <input type="text" name="preventivoAno" value={formData.preventivoAno} onChange={handleChange} placeholder="Ex: 2024" className="input-modern" style={{ width: '120px' }} />
                  </div>
                )}
              </div>

              <div>
                <label className="label-modern">3. Usa DIU? *</label>
                <div style={{ display: 'flex', gap: '14px', marginTop: '4px' }}>
                  {['Sim', 'Não', 'Não sabe'].map(opt => (
                    <label key={opt} style={{ fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                      <input type="radio" name="usaDiu" value={opt} checked={formData.usaDiu === opt} onChange={handleChange} /> {opt}
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="label-modern">4. Está grávida? *</label>
                <div style={{ display: 'flex', gap: '14px', marginTop: '4px' }}>
                  {['Sim', 'Não', 'Não sabe'].map(opt => (
                    <label key={opt} style={{ fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                      <input type="radio" name="estaGravida" value={opt} checked={formData.estaGravida === opt} onChange={handleChange} /> {opt}
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="label-modern">5. Usa pílula anticoncepcional? *</label>
                <div style={{ display: 'flex', gap: '14px', marginTop: '4px' }}>
                  {['Sim', 'Não', 'Não sabe'].map(opt => (
                    <label key={opt} style={{ fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                      <input type="radio" name="usaPilula" value={opt} checked={formData.usaPilula === opt} onChange={handleChange} /> {opt}
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="label-modern">6. Usa hormônio / remédio para tratar a menopausa? *</label>
                <div style={{ display: 'flex', gap: '14px', marginTop: '4px' }}>
                  {['Sim', 'Não', 'Não sabe'].map(opt => (
                    <label key={opt} style={{ fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                      <input type="radio" name="usaHormonioMenopausa" value={opt} checked={formData.usaHormonioMenopausa === opt} onChange={handleChange} /> {opt}
                    </label>
                  ))}
                </div>
              </div>
            </div>

            {/* Direita */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label className="label-modern">7. Já fez tratamento por radioterapia? *</label>
                <div style={{ display: 'flex', gap: '14px', marginTop: '4px' }}>
                  {['Sim', 'Não', 'Não sabe'].map(opt => (
                    <label key={opt} style={{ fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                      <input type="radio" name="tratamentoRadioterapia" value={opt} checked={formData.tratamentoRadioterapia === opt} onChange={handleChange} /> {opt}
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="label-modern">8. Data da última menstruação / regra (DUM) *</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '4px' }}>
                  <input type="date" name="dataUltimaMenstruacao" value={formData.dataUltimaMenstruacao} onChange={handleChange} disabled={formData.dumNaoSabe} className="input-modern" style={{ width: '160px' }} />
                  <label style={{ fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', userSelect: 'none' }}>
                    <input type="checkbox" name="dumNaoSabe" checked={formData.dumNaoSabe} onChange={(e) => {
                      handleChange(e)
                      if (e.target.checked) {
                        setFormData(prev => ({ ...prev, dataUltimaMenstruacao: '' }))
                      }
                    }} /> Não sabe / Não lembra
                  </label>
                </div>
              </div>

              <div>
                <label className="label-modern">9. Tem ou teve algum sangramento após relações sexuais? *</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '4px' }}>
                  {['Sim', 'Não / Não sabe / Não lembra'].map(opt => (
                    <label key={opt} style={{ fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                      <input type="radio" name="sangramentoAposRacao" value={opt} checked={formData.sangramentoAposRacao === opt} onChange={handleChange} /> {opt}
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="label-modern">10. Tem ou teve algum sangramento após a menopausa? *</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '4px' }}>
                  {['Sim', 'Não / Não sabe / Não lembra / Não está na menopausa'].map(opt => (
                    <label key={opt} style={{ fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                      <input type="radio" name="sangramentoAposMenopausa" value={opt} checked={formData.sangramentoAposMenopausa === opt} onChange={handleChange} /> {opt}
                    </label>
                  ))}
                </div>
              </div>
            </div>

          </div>
        </div>

        {/* 4. EXAME CLÍNICO & COLETA */}
        <div className="card" style={{ padding: '28px' }}>
          <h3 style={{ fontFamily: 'Sora, sans-serif', fontSize: '15px', fontWeight: '700', color: '#172554', margin: '0 0 20px', borderBottom: '1px solid #e2e8f0', paddingBottom: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Stethoscope size={18} style={{ color: '#10b981' }} />
            EXAME CLÍNICO & DADOS DA COLETA
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px', marginBottom: '20px' }}>
            <div>
              <label className="label-modern">11. Inspeção do colo *</label>
              <select name="inspecaoColo" value={formData.inspecaoColo} onChange={handleChange} required className="input-modern">
                <option value="">-- Selecione --</option>
                <option value="Normal">Normal</option>
                <option value="Ausente">Ausente (retirado ou congênito)</option>
                <option value="Alterado">Alterado</option>
                <option value="Colo não visualizado">Colo não visualizado</option>
              </select>
            </div>
            <div>
              <label className="label-modern">12. Sinais sugestivos de DST? *</label>
              <div style={{ display: 'flex', gap: '14px', marginTop: '8px' }}>
                {['Sim', 'Não'].map(opt => (
                  <label key={opt} style={{ fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                    <input type="radio" name="sinaisDst" value={opt} checked={formData.sinaisDst === opt} onChange={handleChange} /> {opt}
                  </label>
                ))}
              </div>
            </div>
            <div>
              <label className="label-modern">Data da Coleta *</label>
              <input type="date" name="dataColeta" value={formData.dataColeta} onChange={handleChange} required className="input-modern" />
            </div>
            <div>
              <label className="label-modern">Profissional Responsável *</label>
              <div style={{ position: 'relative' }} onClick={e => e.stopPropagation()}>
                <input
                  type="text"
                  name="responsavel"
                  value={formData.responsavel}
                  onChange={(e) => {
                    handleChange(e)
                    buscarProfissionaisCNES(e.target.value)
                  }}
                  onFocus={(e) => {
                    buscarProfissionaisCNES(e.target.value)
                  }}
                  required
                  placeholder="Nome do profissional regulador/coletor..."
                  className="input-modern"
                  autoComplete="off"
                />
                
                {sugestoesProfissionais.length > 0 && (
                  <div style={{
                    position: 'absolute',
                    bottom: '100%',
                    left: 0,
                    right: 0,
                    backgroundColor: 'white',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    boxShadow: '0 -10px 15px -3px rgba(0,0,0,0.1), 0 -4px 6px -2px rgba(0,0,0,0.05)',
                    zIndex: 50,
                    maxHeight: '180px',
                    overflowY: 'auto',
                    marginBottom: '4px'
                  }}>
                    {sugestoesProfissionais.map((prof, i) => (
                      <div
                        key={i}
                        onClick={() => {
                          setFormData(prev => ({ ...prev, responsavel: prof.nome }))
                          setSugestoesProfissionais([])
                        }}
                        style={{
                          padding: '8px 12px',
                          cursor: 'pointer',
                          borderBottom: '1px solid #f1f5f9',
                          fontSize: '12.5px',
                          color: '#1e293b',
                          transition: 'background-color 0.15s'
                        }}
                        onMouseEnter={e => e.currentTarget.style.backgroundColor = '#f1f5f9'}
                        onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                      >
                        <div style={{ fontWeight: '600' }}>{prof.nome}</div>
                        {prof.crm && <div style={{ fontSize: '10px', color: '#64748b' }}>SCNES: {prof.crm}</div>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Gerar Botão */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '8px' }}>
          <button
            type="submit"
            disabled={gerandoPdf}
            className="btn-primary"
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '8px', 
              padding: '12px 32px', 
              fontSize: '15px', 
              fontWeight: '700',
              background: 'linear-gradient(135deg, #10b981, #059669)', 
              boxShadow: '0 4px 12px rgba(16,185,129,0.2)' 
            }}
          >
            {gerandoPdf ? (
              <>
                <RefreshCw className="animate-spin" size={16} />
                Gerando PDF...
              </>
            ) : (
              <>
                <Download size={16} />
                Gerar Requisição (PDF)
              </>
            )}
          </button>
        </div>

      </form>

    </div>
  )
}
