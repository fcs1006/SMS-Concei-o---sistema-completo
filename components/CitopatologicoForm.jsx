'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Search, FileText, User, Stethoscope, Building, 
  AlertCircle, Download, CheckCircle, RefreshCw, Trash2, Heart
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

export default function CitopatologicoForm() {
  const router = useRouter()
  const [usuario, setUsuario] = useState(null)
  
  // Estados de busca de paciente
  const [sugestoesPacientes, setSugestoesPacientes] = useState([])
  const [gerandoPdf, setGerandoPdf] = useState(false)
  const [avisoSexo, setAvisoSexo] = useState(false)

  // Dados do formulário
  const [formData, setFormData] = useState({
    // Unidade
    ufUnidade: 'TO',
    cnesUnidade: '5193273',
    unidadeSaude: 'UBS LUIZ FRANCISCO DE MIRANDA',
    municipioUnidade: 'CONCEIÇÃO DO TOCANTINS',
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

    // Anamnese
    motivoExame: 'Rastreamento',
    fezPreventivo: 'Não',
    preventivoAno: '',
    usaDiu: 'Não',
    estaGravida: 'Não',
    usaPilula: 'Não',
    usaHormonioMenopausa: 'Não',
    tratamentoRadioterapia: 'Não',
    dataUltimaMenstruacao: '',
    dumNaoSabe: false,
    sangramentoAposRacao: 'Não / Não sabe / Não lembra',
    sangramentoAposMenopausa: 'Não / Não sabe / Não lembra / Não está na menopausa',

    // Exame Clínico
    inspecaoColo: 'Normal',
    sinaisDst: 'Não',

    // Coleta
    dataColeta: new Date().toISOString().substring(0, 10),
    responsavel: ''
  })

  useEffect(() => {
    const u = localStorage.getItem('sms_user')
    if (u) {
      const parsedUser = JSON.parse(u)
      setUsuario(parsedUser)
      setFormData(prev => ({
        ...prev,
        responsavel: parsedUser.nome || ''
      }))
    }
  }, [])

  // Fecha todas as caixas de sugestões ao clicar fora
  useEffect(() => {
    const handleClose = () => {
      setSugestoesPacientes([])
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
        .select('id, nome, cpf_cns, dt_nasc, sexo, telefone, endereco, bairro, cep, mae')
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
      cep: pac.cep || '77305000'
    }))
    setSugestoesPacientes([])
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
      
      {/* Busca de Paciente */}
      <div className="card" style={{ padding: '28px', marginBottom: '24px' }}>
        <h2 style={{ fontFamily: 'Sora, sans-serif', fontSize: '15px', fontWeight: '700', color: '#172554', margin: '0 0 16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Search size={18} style={{ color: '#10b981' }} />
          Buscar Paciente Cadastrado
        </h2>
        <div style={{ position: 'relative' }}>
          <input
            type="text"
            placeholder="Comece a digitar o Nome, CPF ou CNS do paciente..."
            onChange={(e) => {
              handleChange(e)
              buscarPacientesLocal(e.target.value)
            }}
            name="nomePaciente"
            value={formData.nomePaciente}
            className="input-modern"
            autoComplete="off"
            style={{ paddingLeft: '40px' }}
          />
          <Search size={16} style={{ position: 'absolute', left: '14px', top: '13px', color: '#94a3b8' }} />

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
                    Doc: {pac.cpf_cns} | Nasc: {pac.dt_nasc ? pac.dt_nasc.split('-').reverse().join('/') : '-'}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {avisoSexo && (
          <div style={{ padding: '12px', background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)', borderRadius: '10px', color: '#b45309', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px', marginTop: '16px' }}>
            <AlertCircle size={18} className="shrink-0" style={{ color: '#f59e0b' }} />
            <span><strong>Atenção:</strong> O paciente selecionado está cadastrado com o sexo Masculino. Este exame é destinado ao público feminino.</span>
          </div>
        )}
      </div>

      {/* Formulário Principal */}
      <form onSubmit={handleGerarPdf} style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        
        {/* 1. CABEÇALHO & UNIDADE */}
        <div className="card" style={{ padding: '28px' }}>
          <h3 style={{ fontFamily: 'Sora, sans-serif', fontSize: '15px', fontWeight: '700', color: '#172554', margin: '0 0 20px', borderBottom: '1px solid #e2e8f0', paddingBottom: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Building size={18} style={{ color: '#10b981' }} />
            IDENTIFICAÇÃO DA UNIDADE DE SAÚDE SOLICITANTE
          </h3>
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
              <select name="inspecaoColo" value={formData.inspecaoColo} onChange={handleChange} className="input-modern">
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
              <input type="text" name="responsavel" value={formData.responsavel} onChange={handleChange} required className="input-modern" />
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
