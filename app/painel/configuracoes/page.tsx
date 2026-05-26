'use client'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Layout from '@/components/Layout'
import { 
  Save, Plus, Trash2, ShieldAlert, Clock, Phone, MapPin, 
  CheckSquare, ListPlus, Activity, Check, X, RefreshCw, Edit, Globe, MessageSquare
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { clientConfig } from '@/lib/config'

const GRADIENTES = [
  { id: 'gradient', label: 'Azul', style: { background: 'linear-gradient(135deg, #0f172a 0%, #1e3a8a 100%)' } },
  { id: 'cyan',     label: 'Cyan',   style: { background: 'linear-gradient(135deg, #0f172a 0%, #0891b2 100%)' } },
  { id: 'roxo',     label: 'Roxo',   style: { background: 'linear-gradient(135deg, #1e1b4b 0%, #6366f1 100%)' } },
]

interface SupportContacts {
  urgencia: string
  ubs_urbana: string
  laboratorio: string
  vigilancia: string
  [key: string]: string
}

interface HorarioPeriodo {
  inicio: string
  fim: string
}

interface HorarioAtendimento {
  dias: number[]
  mensagem_fechado: string
  periodos: HorarioPeriodo[]
}

interface ServicosMunicipio {
  tfd: boolean
  farmacia: boolean
  laboratorio: boolean
  vigilancia: boolean
}

interface UbsUnidade {
  nome: string
  descricao: string
  telefone: string
  servicos: string[]
}

interface ListaAcs {
  rural: string[]
  urbana: string[]
}

function mascararTelefone(v: string): string {
  const num = v.replace(/\D/g, '')
  if (num.length <= 2) {
    return num.length > 0 ? `(${num}` : ''
  }
  if (num.length <= 6) {
    return `(${num.slice(0, 2)}) ${num.slice(2)}`
  }
  if (num.length <= 10) {
    return `(${num.slice(0, 2)}) ${num.slice(2, 6)}-${num.slice(6)}`
  }
  return `(${num.slice(0, 2)}) ${num.slice(2, 7)}-${num.slice(7, 11)}`
}

function mascararCNPJ(v: string): string {
  const num = v.replace(/\D/g, '')
  if (num.length <= 2) return num
  if (num.length <= 5) return `${num.slice(0, 2)}.${num.slice(2)}`
  if (num.length <= 8) return `${num.slice(0, 2)}.${num.slice(2, 5)}.${num.slice(5)}`
  if (num.length <= 12) return `${num.slice(0, 2)}.${num.slice(2, 5)}.${num.slice(5, 8)}/${num.slice(8)}`
  return `${num.slice(0, 2)}.${num.slice(2, 5)}.${num.slice(5, 8)}/${num.slice(8, 12)}-${num.slice(12, 14)}`
}

function mascararCEP(v: string): string {
  const num = v.replace(/\D/g, '')
  if (num.length <= 5) return num
  return `${num.slice(0, 5)}-${num.slice(5, 8)}`
}

const DEFAULT_TEMPLATES = {
  template_esp_auto: `Olá, *{paciente_nome}*! 🎉

Temos uma boa notícia! O seu agendamento de *{especialidade}* ({tipo_exame}) foi *AUTORIZADO* e agendado para:

📅 Data: *{data_evento}*
👨‍⚕️ Profissional: {profissional}
⏰ {periodo}

🏢 Local: Secretaria Municipal de Saúde de {municipio} (ou local indicado)

⚠️ *Importante:* Compareça à Secretaria Municipal de Saúde de {municipio} para obter mais informações, realizar a retirada da sua autorização e agendar a viagem (caso vá utilizar o transporte sanitário do município).`,

  template_sis_auto: `Olá, *{paciente_nome}*! 🎉

Temos uma boa notícia! O seu procedimento do *SISREG* foi *AUTORIZADO* e agendado para:

🩺 *{procedimento}*
📅 Data: *{data_evento}* às *{horario}*
📍 Local: {local}

⚠️ *Importante:* Compareça à Secretaria Municipal de Saúde de {municipio} para obter mais informações, realizar a retirada da sua autorização e agendar a viagem (caso vá utilizar o transporte sanitário do município).`,

  template_esp_vesp: `Olá, *{paciente_nome}*! 👋

Lembramos que você tem um(a) *{especialidade}* ({tipo_exame}) agendado(a) para amanhã (*{data_evento}*) na Secretaria Municipal de Saúde de {municipio}:

👨‍⚕️ Profissional: {profissional}
⏰ {periodo}

⚠️ Se não puder comparecer, por favor, avise a secretaria com antecedência para podermos liberar a vaga para outro paciente. Obrigado!`,

  template_sis_vesp: `Olá, *{paciente_nome}*! 👋

Lembramos que você tem um procedimento regulado pelo *SISREG* agendado para amanhã (*{data_evento}*) às *{horario}*:

🩺 *{procedimento}*
📍 Local: {local}

⚠️ Por favor, compareça no horário e local indicados com seus documentos. Caso não possa comparecer, comunique a secretaria de saúde o quanto antes.`,

  template_tfd_vesp: `Olá, *{paciente_nome}*! 🚗

Lembramos que sua viagem de *TFD (Tratamento Fora de Domicílio)* está agendada para amanhã (*{data_evento}*):

📍 Destino: {destino}
⏰ Horário de Saída: *{horario_saida}*
🏢 Local de Saída: *Secretaria Municipal de Saúde de {municipio}*
👥 Acompanhante: {acompanhante}

⚠️ Recomendamos comparecer com 15 minutos de antecedência. Não esqueça seus documentos pessoais e o encaminhamento de viagem. Boa viagem!`,

  template_esp_5d: `Olá, *{paciente_nome}*! 👋

Lembramos que falta pouco para o seu agendamento de *{especialidade}* ({tipo_exame}) marcado para daqui a 5 dias (*{data_evento}*):

👨‍⚕️ Profissional: {profissional}
⏰ {periodo}

⚠️ *Atenção:* Não identificamos agendamento de transporte (TFD) para esta data. Se você precisar do transporte da prefeitura, por favor realize a retirada da sua autorização e agende a viagem o mais rápido possível.

Como podemos ajudar? Escolha uma das opções abaixo:`,

  template_esp_5d_confirmado: `Olá, *{paciente_nome}*! 👋

Lembramos que falta pouco para o seu agendamento de *{especialidade}* ({tipo_exame}) marcado para daqui a 5 dias (*{data_evento}*):

👨‍⚕️ Profissional: {profissional}
⏰ {periodo}

🚗 *Transporte Confirmado:* Identificamos que sua viagem de TFD já está agendada para esta data. Por favor, lembre-se de retirar a sua guia de autorização física na Secretaria Municipal de Saúde de {municipio} caso ainda não o tenha feito. Obrigado!`,

  template_sis_5d: `Olá, *{paciente_nome}*! 👋

Lembramos que falta pouco para o seu procedimento pelo *SISREG*! Seu agendamento de *{procedimento}* está marcado para o dia *{data_evento}* às *{horario}*:

📍 Local: {local}

⚠️ *Atenção:* Não identificamos agendamento de transporte (TFD) para esta data. Se você precisar do transporte da prefeitura, por favor realize a retirada da sua autorização e agende a viagem o mais rápido possível.

Como podemos ajudar? Escolha uma das opções abaixo:`,

  template_sis_5d_confirmado: `Olá, *{paciente_nome}*! 👋

Lembramos que falta pouco para o seu procedimento pelo *SISREG*! Seu agendamento de *{procedimento}* está marcado para o dia *{data_evento}* às *{horario}*:

📍 Local: {local}

🚗 *Transporte Confirmado:* Identificamos que sua viagem de TFD já está agendada para esta data. Por favor, lembre-se de retirar a sua guia de autorização física na Secretaria Municipal de Saúde de {municipio} caso ainda não o tenha feito. Obrigado!`
}

type Tab = 'identidade' | 'geral' | 'horarios' | 'ubs' | 'acs' | 'tfd' | 'templates'

export default function ConfiguracoesPainel() {
  const router = useRouter()
  const [usuario, setUsuario] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [status, setStatus] = useState({ txt: '', ok: true })
  const [activeTab, setActiveTab] = useState<Tab>('identidade')

  const [municipio, setMunicipio] = useState({
    municipalityName: clientConfig.municipalityName,
    municipalityUF: clientConfig.municipalityUF,
    defaultDDD: clientConfig.defaultDDD,
    assistantName: clientConfig.assistantName,
    phone: clientConfig.phone,
    cnpj: clientConfig.cnpj,
    address: clientConfig.address,
    cep: clientConfig.cep,
    email: clientConfig.email,
    modoLembrete: 'automatico',
    template_esp_auto: DEFAULT_TEMPLATES.template_esp_auto,
    template_sis_auto: DEFAULT_TEMPLATES.template_sis_auto,
    template_esp_vesp: DEFAULT_TEMPLATES.template_esp_vesp,
    template_sis_vesp: DEFAULT_TEMPLATES.template_sis_vesp,
    template_tfd_vesp: DEFAULT_TEMPLATES.template_tfd_vesp,
    template_esp_5d: DEFAULT_TEMPLATES.template_esp_5d,
    template_esp_5d_confirmado: DEFAULT_TEMPLATES.template_esp_5d_confirmado,
    template_sis_5d: DEFAULT_TEMPLATES.template_sis_5d,
    template_sis_5d_confirmado: DEFAULT_TEMPLATES.template_sis_5d_confirmado
  })

  // Login background custom states & refs
  const fileInputRef = useRef<HTMLInputElement>(null)
  const prevRef = useRef<HTMLDivElement>(null)
  const dragging = useRef(false)
  const pendingSelectionRef = useRef<{ elementId: string, pos: number } | null>(null)
  const [focusedField, setFocusedField] = useState<{ key: string, id: string } | null>(null)

  const [loginBgId, setLoginBgId] = useState('foto')
  const [loginBgUrl, setLoginBgUrl] = useState('')
  const [loginBgZoom, setLoginBgZoom] = useState(100)
  const [loginBgX, setLoginBgX] = useState(50)
  const [loginBgY, setLoginBgY] = useState(50)
  const [loginBgModoAj, setLoginBgModoAj] = useState(false)

  const onPrevMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    dragging.current = true
    e.preventDefault()
  }

  const onPrevMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!dragging.current || !prevRef.current) return
    const rect = prevRef.current.getBoundingClientRect()
    const x = Math.round(Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100)))
    const y = Math.round(Math.max(0, Math.min(100, ((e.clientY - rect.top) / rect.height) * 100)))
    setLoginBgX(x)
    setLoginBgY(y)
    setLoginBgModoAj(true)
  }

  const onPrevMouseUp = () => {
    dragging.current = false
  }

  const handleUploadBg = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => {
      const url = ev.target?.result as string
      setLoginBgUrl(url)
      setLoginBgId('custom')
    }
    reader.readAsDataURL(file)
  }

  // Configs states
  const [contatos, setContatos] = useState<SupportContacts>({
    urgencia: '',
    ubs_urbana: '',
    laboratorio: '',
    vigilancia: ''
  })

  const [horarios, setHorarios] = useState<HorarioAtendimento>({
    dias: [1, 2, 3, 4, 5],
    mensagem_fechado: '',
    periodos: []
  })

  const [servicos, setServicos] = useState<ServicosMunicipio>({
    tfd: true,
    farmacia: true,
    laboratorio: true,
    vigilancia: true
  })

  const [listaUbs, setListaUbs] = useState<UbsUnidade[]>([])
  const [listaAcs, setListaAcs] = useState<ListaAcs>({ rural: [], urbana: [] })
  const [tfdDestinos, setTfdDestinos] = useState<string[]>([])

  // States for new items creation
  const [newPeriod, setNewPeriod] = useState<HorarioPeriodo>({ inicio: '08:00', fim: '12:00' })
  const [newUbs, setNewUbs] = useState<UbsUnidade>({ nome: '', descricao: '', telefone: '', servicos: [] })
  const [newUbsServico, setNewUbsServico] = useState('')
  const [newAcsName, setNewAcsName] = useState('')
  const [newAcsArea, setNewAcsArea] = useState<'urbana' | 'rural'>('urbana')
  const [newDestino, setNewDestino] = useState('')

  // States for editing existing items
  const [editingPeriodIdx, setEditingPeriodIdx] = useState<number | null>(null)
  const [editingUbsIdx, setEditingUbsIdx] = useState<number | null>(null)
  const [editingAcs, setEditingAcs] = useState<{ area: 'rural' | 'urbana'; index: number } | null>(null)
  const [editAcsName, setEditAcsName] = useState('')
  const [editingDestinoIdx, setEditingDestinoIdx] = useState<number | null>(null)
  const [editDestinoName, setEditDestinoName] = useState('')

  // States for new support contacts
  const [newContatoLabel, setNewContatoLabel] = useState('')
  const [newContatoValor, setNewContatoValor] = useState('')

  // States for editing support contacts
  const [editingContatoKey, setEditingContatoKey] = useState<string | null>(null)
  const [editContatoLabel, setEditContatoLabel] = useState('')
  const [editContatoValor, setEditContatoValor] = useState('')

  useEffect(() => {
    const u = localStorage.getItem('sms_user')
    if (!u) {
      router.push('/')
      return
    }
    const userObj = JSON.parse(u)
    setUsuario(userObj)

    if (userObj.perfil !== 'admin') {
      router.push('/painel')
      return
    }

    carregarConfigs()
  }, [])

  useEffect(() => {
    if (pendingSelectionRef.current) {
      const { elementId, pos } = pendingSelectionRef.current
      const textarea = document.getElementById(elementId) as HTMLTextAreaElement
      if (textarea) {
        textarea.focus()
        textarea.selectionStart = textarea.selectionEnd = pos
      }
      pendingSelectionRef.current = null
    }
  }, [municipio])

  function mostrarMsg(txt: string, ok = true) {
    setStatus({ txt, ok })
    window.scrollTo({ top: 0, behavior: 'smooth' })
    setTimeout(() => setStatus({ txt: '', ok: true }), 5000)
  }

  async function carregarConfigs() {
    setLoading(true)
    try {
      const res = await fetch('/api/config/geral')
      const data = await res.json()
      if (data.ok && data.configs) {
        const c = data.configs
        if (c.client_config) {
          setMunicipio(prev => ({
            ...prev,
            ...c.client_config,
            template_esp_auto: c.client_config.template_esp_auto || DEFAULT_TEMPLATES.template_esp_auto,
            template_sis_auto: c.client_config.template_sis_auto || DEFAULT_TEMPLATES.template_sis_auto,
            template_esp_vesp: c.client_config.template_esp_vesp || DEFAULT_TEMPLATES.template_esp_vesp,
            template_sis_vesp: c.client_config.template_sis_vesp || DEFAULT_TEMPLATES.template_sis_vesp,
            template_tfd_vesp: c.client_config.template_tfd_vesp || DEFAULT_TEMPLATES.template_tfd_vesp,
            template_esp_5d: c.client_config.template_esp_5d || DEFAULT_TEMPLATES.template_esp_5d,
            template_esp_5d_confirmado: c.client_config.template_esp_5d_confirmado || DEFAULT_TEMPLATES.template_esp_5d_confirmado,
            template_sis_5d: c.client_config.template_sis_5d || DEFAULT_TEMPLATES.template_sis_5d,
            template_sis_5d_confirmado: c.client_config.template_sis_5d_confirmado || DEFAULT_TEMPLATES.template_sis_5d_confirmado,
          }))
        }
        if (c.contatos_suporte) setContatos(c.contatos_suporte)
        if (c.horario_atendimento) setHorarios(c.horario_atendimento)
        if (c.servicos_municipio) setServicos(c.servicos_municipio)
        if (c.lista_ubs) setListaUbs(c.lista_ubs)
        if (c.lista_acs) setListaAcs(c.lista_acs)
        if (c.tfd_destinos) setTfdDestinos(c.tfd_destinos)
      } else {
        mostrarMsg(data.error || 'Erro ao carregar configurações gerais.', false)
      }

      // Carregar fundo
      const resFundo = await fetch('/api/config/fundo')
      const dataFundo = await resFundo.json()
      if (dataFundo.ok && dataFundo.cfg) {
        const cfg = dataFundo.cfg
        if (cfg.login_fundo_id) setLoginBgId(cfg.login_fundo_id)
        if (cfg.login_fundo_url) setLoginBgUrl(cfg.login_fundo_url)
        if (cfg.login_fundo_zoom) setLoginBgZoom(Number(cfg.login_fundo_zoom))
        if (cfg.login_fundo_ajX) setLoginBgX(Number(cfg.login_fundo_ajX))
        if (cfg.login_fundo_ajY) setLoginBgY(Number(cfg.login_fundo_ajY))
        if (cfg.login_fundo_modoAj) setLoginBgModoAj(cfg.login_fundo_modoAj === '1')
      }
    } catch (err: any) {
      mostrarMsg('Erro de conexão ao carregar dados: ' + err.message, false)
    } finally {
      setLoading(false)
    }
  }

  async function salvarConfigs() {
    if (!usuario?.usuario) return
    setSalvando(true)
    try {
      const res = await fetch('/api/config/geral', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          adminCpf: usuario.usuario,
          configs: {
            client_config: municipio,
            contatos_suporte: contatos,
            horario_atendimento: horarios,
            servicos_municipio: servicos,
            lista_ubs: listaUbs,
            lista_acs: listaAcs,
            tfd_destinos: tfdDestinos
          }
        })
      })
      const data = await res.json()
      if (!data.ok) {
        mostrarMsg(data.error || 'Erro ao salvar configurações gerais.', false)
        return
      }

      // Salva configurações do fundo
      const resFundo = await fetch('/api/config/fundo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          adminCpf: usuario.usuario,
          login_fundo_id: loginBgId,
          login_fundo_url: loginBgUrl,
          login_fundo_zoom: String(loginBgZoom),
          login_fundo_ajX: String(loginBgX),
          login_fundo_ajY: String(loginBgY),
          login_fundo_modoAj: loginBgModoAj ? '1' : '0'
        })
      })
      const dataFundo = await resFundo.json()

      if (dataFundo.ok) {
        mostrarMsg('Configurações salvas com sucesso! ✨')
      } else {
        mostrarMsg(dataFundo.error || 'Erro ao salvar o fundo da tela de login.', false)
      }
    } catch (err: any) {
      mostrarMsg('Erro de conexão ao salvar: ' + err.message, false)
    } finally {
      setSalvando(false)
    }
  }

  // --- Helpers to manage sublists ---
  const toggleDiaSemana = (dia: number) => {
    setHorarios(prev => {
      const existe = prev.dias.includes(dia)
      const novosDias = existe
        ? prev.dias.filter(d => d !== dia)
        : [...prev.dias, dia].sort()
      return { ...prev, dias: novosDias }
    })
  }

  const handleAddPeriod = () => {
    if (!newPeriod.inicio || !newPeriod.fim) return
    setHorarios(prev => {
      let novosPeriodos = [...(prev.periodos || [])]
      if (editingPeriodIdx !== null) {
        novosPeriodos = novosPeriodos.map((p, i) => i === editingPeriodIdx ? newPeriod : p)
        setEditingPeriodIdx(null)
      } else {
        novosPeriodos.push(newPeriod)
      }
      return {
        ...prev,
        periodos: novosPeriodos.sort((a, b) => a.inicio.localeCompare(b.inicio))
      }
    })
    setNewPeriod({ inicio: '08:00', fim: '12:00' })
  }

  const handleEditPeriod = (index: number) => {
    setEditingPeriodIdx(index)
    setNewPeriod(horarios.periodos[index])
  }

  const handleCancelEditPeriod = () => {
    setEditingPeriodIdx(null)
    setNewPeriod({ inicio: '08:00', fim: '12:00' })
  }

  const insertVariable = (key: string, variable: string, elementId: string) => {
    // Se o usuário estiver com o foco em alguma das caixas de template, insere nela
    const targetKey = focusedField ? focusedField.key : key
    const targetId = focusedField ? focusedField.id : elementId

    const textarea = document.getElementById(targetId) as HTMLTextAreaElement
    if (!textarea) return
    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const text = (municipio as any)[targetKey] || ''
    const newText = text.substring(0, start) + `{${variable}}` + text.substring(end)
    
    // Store caret pos in ref
    const newPos = start + variable.length + 2
    pendingSelectionRef.current = { elementId: targetId, pos: newPos }
    
    setMunicipio(prev => ({ ...prev, [targetKey]: newText }))
  }

  const handleRemovePeriod = (index: number) => {
    setHorarios(prev => ({
      ...prev,
      periodos: prev.periodos.filter((_, i) => i !== index)
    }))
    if (editingPeriodIdx === index) {
      setEditingPeriodIdx(null)
      setNewPeriod({ inicio: '08:00', fim: '12:00' })
    }
  }

  const handleAddUbsServico = () => {
    if (!newUbsServico.trim()) return
    setNewUbs(prev => ({
      ...prev,
      servicos: [...prev.servicos, newUbsServico.trim().toUpperCase()]
    }))
    setNewUbsServico('')
  }

  const handleRemoveNewUbsServico = (index: number) => {
    setNewUbs(prev => ({
      ...prev,
      servicos: prev.servicos.filter((_, i) => i !== index)
    }))
  }

  const handleAddUbs = () => {
    if (!newUbs.nome.trim() || !newUbs.telefone.trim()) {
      alert('Nome e Telefone da UBS são obrigatórios.')
      return
    }
    const formatted = { ...newUbs, nome: newUbs.nome.toUpperCase().trim() }
    if (editingUbsIdx !== null) {
      setListaUbs(prev => prev.map((item, i) => i === editingUbsIdx ? formatted : item))
      setEditingUbsIdx(null)
    } else {
      setListaUbs(prev => [...prev, formatted])
    }
    setNewUbs({ nome: '', descricao: '', telefone: '', servicos: [] })
  }

  const handleEditUbs = (index: number) => {
    setEditingUbsIdx(index)
    setNewUbs(listaUbs[index])
  }

  const handleCancelEditUbs = () => {
    setEditingUbsIdx(null)
    setNewUbs({ nome: '', descricao: '', telefone: '', servicos: [] })
  }

  const handleRemoveUbs = (index: number) => {
    if (!confirm('Deseja realmente remover esta UBS?')) return
    setListaUbs(prev => prev.filter((_, i) => i !== index))
    if (editingUbsIdx === index) {
      setEditingUbsIdx(null)
      setNewUbs({ nome: '', descricao: '', telefone: '', servicos: [] })
    }
  }

  const handleAddAcs = () => {
    if (!newAcsName.trim()) return
    const formatted = newAcsName.trim()
    setListaAcs(prev => {
      const list = prev[newAcsArea] || []
      if (list.includes(formatted)) {
        alert('Este ACS já está cadastrado nesta área.')
        return prev
      }
      return {
        ...prev,
        [newAcsArea]: [...list, formatted].sort()
      }
    })
    setNewAcsName('')
  }

  const handleStartEditAcs = (area: 'rural' | 'urbana', index: number, currentName: string) => {
    setEditingAcs({ area, index })
    setEditAcsName(currentName)
  }

  const handleSaveAcsEdit = () => {
    if (!editingAcs || !editAcsName.trim()) return
    const { area, index } = editingAcs
    const formatted = editAcsName.trim()
    setListaAcs(prev => {
      const list = [...(prev[area] || [])]
      const oldName = list[index]
      if (list.includes(formatted) && formatted !== oldName) {
        alert('Este ACS já está cadastrado nesta área.')
        return prev
      }
      list[index] = formatted
      return {
        ...prev,
        [area]: list.sort()
      }
    })
    setEditingAcs(null)
    setEditAcsName('')
  }

  const handleCancelAcsEdit = () => {
    setEditingAcs(null)
    setEditAcsName('')
  }

  const handleRemoveAcs = (area: 'rural' | 'urbana', name: string) => {
    setListaAcs(prev => ({
      ...prev,
      [area]: (prev[area] || []).filter(n => n !== name)
    }))
    if (editingAcs && editingAcs.area === area && (listaAcs[area] || [])[editingAcs.index] === name) {
      setEditingAcs(null)
      setEditAcsName('')
    }
  }

  const handleAddDestino = () => {
    if (!newDestino.trim()) return
    const formatted = newDestino.trim().toUpperCase()
    if (tfdDestinos.includes(formatted)) {
      alert('Esta rota já está cadastrada.')
      return
    }
    setTfdDestinos(prev => [...prev, formatted].sort())
    setNewDestino('')
  }

  const handleStartEditDestino = (index: number, currentName: string) => {
    setEditingDestinoIdx(index)
    setEditDestinoName(currentName)
  }

  const handleSaveDestinoEdit = () => {
    if (editingDestinoIdx === null || !editDestinoName.trim()) return
    const formatted = editDestinoName.trim().toUpperCase()
    const oldName = tfdDestinos[editingDestinoIdx]
    if (tfdDestinos.includes(formatted) && formatted !== oldName) {
      alert('Esta rota já está cadastrada.')
      return
    }
    setTfdDestinos(prev => prev.map((d, i) => i === editingDestinoIdx ? formatted : d).sort())
    setEditingDestinoIdx(null)
    setEditDestinoName('')
  }

  const handleCancelDestinoEdit = () => {
    setEditingDestinoIdx(null)
    setEditDestinoName('')
  }

  const getFriendlyLabel = (key: string) => {
    const dict: Record<string, string> = {
      urgencia: '🚨 Urgência/Emergência',
      ubs_urbana: '🏨 UBS Urbana',
      laboratorio: '🔬 Laboratório Municipal',
      vigilancia: '🛡️ Vigilância Sanitária (VISA)'
    }
    return dict[key] || key
  }

  const handleAddCustomContato = () => {
    if (!newContatoLabel.trim() || !newContatoValor.trim()) return
    const label = newContatoLabel.trim()
    const exists = Object.keys(contatos).some(k => k.toLowerCase() === label.toLowerCase())
    if (exists) {
      alert('Já existe um contato com este nome.')
      return
    }
    setContatos(prev => ({
      ...prev,
      [label]: newContatoValor.trim()
    }))
    setNewContatoLabel('')
    setNewContatoValor('')
  }

  const handleStartEditContato = (key: string, currentValue: string) => {
    setEditingContatoKey(key)
    setEditContatoLabel(key)
    setEditContatoValor(currentValue)
  }

  const handleSaveCustomContatoEdit = (oldKey: string) => {
    if (!editContatoLabel.trim() || !editContatoValor.trim()) return
    const newKey = editContatoLabel.trim()
    const exists = Object.keys(contatos).some(k => k.toLowerCase() === newKey.toLowerCase() && k !== oldKey)
    
    if (exists) {
      alert('Já existe um contato com este nome.')
      return
    }

    setContatos(prev => {
      const copy = { ...prev }
      if (newKey !== oldKey) {
        delete copy[oldKey]
      }
      copy[newKey] = editContatoValor.trim()
      return copy
    })
    setEditingContatoKey(null)
    setEditContatoLabel('')
    setEditContatoValor('')
  }

  const handleCancelCustomContatoEdit = () => {
    setEditingContatoKey(null)
    setEditContatoLabel('')
    setEditContatoValor('')
  }

  const handleRemoveCustomContato = (key: string) => {
    if (!confirm(`Deseja realmente remover o contato "${getFriendlyLabel(key)}"?`)) return
    setContatos(prev => {
      const copy = { ...prev }
      delete copy[key]
      return copy
    })
    if (editingContatoKey === key) {
      setEditingContatoKey(null)
      setEditContatoLabel('')
      setEditContatoValor('')
    }
  }

  const handleRemoveDestino = (destino: string) => {
    setTfdDestinos(prev => prev.filter(d => d !== destino))
    if (editingDestinoIdx !== null && tfdDestinos[editingDestinoIdx] === destino) {
      setEditingDestinoIdx(null)
      setEditDestinoName('')
    }
  }

  const DIAS_NOMES = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']

  return (
    <Layout>
      <div style={{ padding: '32px', maxWidth: '1100px', margin: '0 auto' }}>
        
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '28px' }}>
          <div>
            <h1 style={{ fontFamily: 'Sora, sans-serif', fontSize: '22px', fontWeight: '700', color: '#1e293b', margin: '0 0 4px' }}>
              Configurações Gerais
            </h1>
            <p style={{ color: '#64748b', fontSize: '13px', margin: 0 }}>
              Gerenciamento dinâmico de contatos, horários, UBSs, ACSs e serviços ativos do município.
            </p>
          </div>
          <button 
            onClick={salvarConfigs} 
            disabled={salvando || loading}
            className="btn-primary" 
            style={{ 
              display: 'flex', alignItems: 'center', gap: '8px', 
              background: 'linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%)', 
              boxShadow: '0 4px 12px rgba(14,165,233,0.25)' 
            }}
          >
            {salvando ? <RefreshCw className="animate-spin" size={15} /> : <Save size={15} />}
            {salvando ? 'Salvando...' : 'Salvar Alterações'}
          </button>
        </div>

        {status.txt && (
          <div className={status.ok ? 'status-ok' : 'status-err'} style={{ marginBottom: '20px' }}>
            {status.txt}
          </div>
        )}

        {loading ? (
          <div style={{ color: '#94a3b8', fontSize: '14px', padding: '40px 0', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <RefreshCw className="animate-spin" size={16} /> Carregando configurações...
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: '28px' }}>
            
            {/* Sidebar Tabs */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {[
                { id: 'identidade', label: 'Identidade do Município', Icon: Globe },
                { id: 'geral', label: 'Geral & Contatos', Icon: Phone },
                { id: 'horarios', label: 'Funcionamento & IA', Icon: Clock },
                { id: 'templates', label: 'Templates WhatsApp', Icon: MessageSquare },
                { id: 'ubs', label: 'Lista de UBSs', Icon: MapPin },
                { id: 'acs', label: 'Equipes ACS', Icon: CheckSquare },
                { id: 'tfd', label: 'Rotas TFD', Icon: ListPlus }
              ].map(t => {
                const active = activeTab === t.id
                return (
                  <button
                    key={t.id}
                    onClick={() => setActiveTab(t.id as Tab)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '10px',
                      padding: '12px 14px', borderRadius: '10px', border: 'none',
                      textAlign: 'left', cursor: 'pointer', fontSize: '13px',
                      fontWeight: active ? '600' : '400',
                      background: active ? 'rgba(14,165,233,0.08)' : 'transparent',
                      color: active ? '#0ea5e9' : '#64748b',
                      transition: 'all 0.2s'
                    }}
                    onMouseEnter={e => { if (!active) e.currentTarget.style.background = '#f8fafc' }}
                    onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent' }}
                  >
                    <t.Icon size={16} />
                    {t.label}
                  </button>
                )
              })}
            </div>

            {/* Tab Contents */}
            <div className="card" style={{ padding: '28px', background: '#fff', minHeight: '400px' }}>
              <AnimatePresence mode="wait">

                {/* TAB 0: IDENTIDADE DO MUNICÍPIO */}
                {activeTab === 'identidade' && (
                  <motion.div
                    key="identidade"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}
                  >
                    <div>
                      <h3 style={{ fontSize: '15px', fontWeight: '700', color: '#1e293b', margin: '0 0 4px' }}>Identidade do Município</h3>
                      <p style={{ color: '#64748b', fontSize: '12px', margin: 0 }}>Configure as informações oficiais da prefeitura e do assistente virtual (white-label).</p>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                      <div>
                        <label className="label-modern">Nome do Município</label>
                        <input 
                          type="text" 
                          className="input-modern" 
                          placeholder="Ex: Conceição do Tocantins" 
                          value={municipio.municipalityName} 
                          onChange={e => setMunicipio(prev => ({ ...prev, municipalityName: e.target.value }))} 
                        />
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                        <div>
                          <label className="label-modern">Estado (UF)</label>
                          <input 
                            type="text" 
                            className="input-modern" 
                            placeholder="Ex: TO" 
                            maxLength={2}
                            style={{ textTransform: 'uppercase' }}
                            value={municipio.municipalityUF} 
                            onChange={e => setMunicipio(prev => ({ ...prev, municipalityUF: e.target.value.toUpperCase() }))} 
                          />
                        </div>
                        <div>
                          <label className="label-modern">DDD Padrão</label>
                          <input 
                            type="text" 
                            className="input-modern" 
                            placeholder="Ex: 63" 
                            maxLength={2}
                            value={municipio.defaultDDD} 
                            onChange={e => setMunicipio(prev => ({ ...prev, defaultDDD: e.target.value.replace(/\D/g, '') }))} 
                          />
                        </div>
                      </div>

                      <div>
                        <label className="label-modern">Nome do Assistente Virtual</label>
                        <input 
                          type="text" 
                          className="input-modern" 
                          placeholder="Ex: Francisco" 
                          value={municipio.assistantName} 
                          onChange={e => setMunicipio(prev => ({ ...prev, assistantName: e.target.value }))} 
                        />
                      </div>

                      <div>
                        <label className="label-modern">CNPJ</label>
                        <input 
                          type="text" 
                          className="input-modern" 
                          placeholder="Ex: 11.419.212/0001-24" 
                          value={municipio.cnpj} 
                          onChange={e => setMunicipio(prev => ({ ...prev, cnpj: mascararCNPJ(e.target.value) }))} 
                        />
                      </div>

                      <div>
                        <label className="label-modern">Telefone Geral / Suporte</label>
                        <input 
                          type="text" 
                          className="input-modern" 
                          placeholder="Ex: (63) 99132-5537" 
                          value={municipio.phone} 
                          onChange={e => setMunicipio(prev => ({ ...prev, phone: mascararTelefone(e.target.value) }))} 
                        />
                      </div>

                      <div>
                        <label className="label-modern">E-mail de Contato</label>
                        <input 
                          type="email" 
                          className="input-modern" 
                          placeholder="Ex: conceicaodotocantins170560@gmail.com" 
                          value={municipio.email} 
                          onChange={e => setMunicipio(prev => ({ ...prev, email: e.target.value }))} 
                        />
                      </div>

                      <div style={{ gridColumn: 'span 2' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 200px', gap: '16px' }}>
                          <div>
                            <label className="label-modern">Endereço da Secretaria</label>
                            <input 
                              type="text" 
                              className="input-modern" 
                              placeholder="Ex: Avenida Sebastião de Brito, Centro, 181" 
                              value={municipio.address} 
                              onChange={e => setMunicipio(prev => ({ ...prev, address: e.target.value }))} 
                            />
                          </div>
                          <div>
                            <label className="label-modern">CEP</label>
                            <input 
                              type="text" 
                              className="input-modern" 
                              placeholder="Ex: 77.305-000" 
                              value={municipio.cep} 
                              onChange={e => setMunicipio(prev => ({ ...prev, cep: mascararCEP(e.target.value) }))} 
                            />
                          </div>
                        </div>
                      </div>
                    </div>

                    <hr style={{ border: 'none', borderTop: '1px solid #f1f5f9', margin: '20px 0' }} />

                    <div>
                      <h3 style={{ fontSize: '15px', fontWeight: '700', color: '#1e293b', margin: '0 0 4px' }}>Personalização da Tela de Login</h3>
                      <p style={{ color: '#64748b', fontSize: '12px', margin: '0 0 16px' }}>Configure a imagem de fundo ou o gradiente de cores da tela de autenticação do portal.</p>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                        <div>
                          <label className="label-modern">Tipo de Fundo</label>
                          <select 
                            className="input-modern" 
                            value={loginBgId} 
                            onChange={e => {
                              const val = e.target.value
                              setLoginBgId(val)
                              if (val !== 'foto' && val !== 'custom') {
                                setLoginBgModoAj(false)
                              }
                            }}
                          >
                            <option value="foto">Foto do Portal (Padrão)</option>
                            <option value="custom">Imagem Personalizada (Upload)</option>
                            <option value="gradient">🎨 Gradiente Azul</option>
                            <option value="cyan">🔵 Gradiente Cyan</option>
                            <option value="roxo">🟣 Gradiente Roxo</option>
                          </select>
                        </div>

                        {(loginBgId === 'foto' || loginBgId === 'custom') && (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            {loginBgId === 'custom' && (
                              <div>
                                <label className="label-modern" style={{ display: 'block', marginBottom: '6px' }}>Upload de Nova Imagem</label>
                                <input 
                                  ref={fileInputRef} 
                                  type="file" 
                                  accept="image/*" 
                                  style={{ display: 'none' }} 
                                  onChange={handleUploadBg} 
                                />
                                <button 
                                  type="button" 
                                  onClick={() => fileInputRef.current?.click()}
                                  className="btn-secondary"
                                  style={{ width: '100%', height: '36px', fontSize: '12px', border: '1px dashed #0ea5e9' }}
                                >
                                  {loginBgUrl ? '🔄 Substituir Imagem' : '📤 Selecionar Imagem'}
                                </button>
                              </div>
                            )}

                            <div 
                              onClick={() => setLoginBgModoAj(!loginBgModoAj)}
                              style={{
                                display: 'flex', alignItems: 'center', gap: '10px',
                                padding: '12px', borderRadius: '10px', border: '1px solid #e2e8f0',
                                cursor: 'pointer', background: loginBgModoAj ? 'rgba(14,165,233,0.02)' : 'none',
                                borderColor: loginBgModoAj ? '#0ea5e9' : '#e2e8f0',
                                transition: 'all 0.2s', marginTop: '6px'
                              }}
                            >
                              <div style={{
                                width: '16px', height: '16px', borderRadius: '4px',
                                border: '2px solid', borderColor: loginBgModoAj ? '#0ea5e9' : '#cbd5e1',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                background: loginBgModoAj ? '#0ea5e9' : 'none',
                                color: 'white', flexShrink: 0
                              }}>
                                {loginBgModoAj && <Check size={12} strokeWidth={3} />}
                              </div>
                              <span style={{ fontSize: '12px', fontWeight: '600', color: '#334155' }}>
                                Habilitar Ajuste Manual de Posição & Zoom
                              </span>
                            </div>

                            {loginBgModoAj && (
                              <div style={{ marginTop: '4px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                                  <label className="label-modern" style={{ margin: 0 }}>Zoom da Imagem</label>
                                  <span style={{ color: '#0ea5e9', fontSize: '11px', fontWeight: '700' }}>{loginBgZoom}%</span>
                                </div>
                                <input 
                                  type="range" 
                                  min={50} 
                                  max={300} 
                                  step={5} 
                                  value={loginBgZoom}
                                  onChange={e => setLoginBgZoom(Number(e.target.value))} 
                                  style={{ width: '100%', accentColor: '#0ea5e9', cursor: 'pointer', height: '4px' }} 
                                />
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Interactive Preview Container */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <span className="label-modern" style={{ margin: 0 }}>Visualização Prévia (Clique/Arraste para posicionar)</span>
                        {(() => {
                          const ehFoto = loginBgId === 'foto' || loginBgId === 'custom'
                          const fotoUrl = loginBgId === 'custom' ? loginBgUrl : '/conceicao-bg.jpg'
                          const gradiente = GRADIENTES.find(g => g.id === loginBgId)
                          const previewBgStyle: React.CSSProperties = ehFoto
                            ? loginBgModoAj
                              ? { backgroundImage: `url(${fotoUrl})`, backgroundSize: `${loginBgZoom}%`, backgroundPosition: `${loginBgX}% ${loginBgY}%`, backgroundRepeat: 'no-repeat' }
                              : { backgroundImage: `url(${fotoUrl})`, backgroundSize: 'cover', backgroundPosition: 'center', backgroundRepeat: 'no-repeat' }
                            : (gradiente?.style ?? GRADIENTES[0].style)

                          return (
                            <div 
                              ref={prevRef}
                              onMouseDown={ehFoto && loginBgModoAj ? onPrevMouseDown : undefined}
                              onMouseMove={ehFoto && loginBgModoAj ? onPrevMouseMove : undefined}
                              onMouseUp={ehFoto && loginBgModoAj ? onPrevMouseUp : undefined}
                              onMouseLeave={ehFoto && loginBgModoAj ? onPrevMouseUp : undefined}
                              style={{
                                width: '100%', height: '180px', borderRadius: '12px',
                                border: '1px solid #e2e8f0', overflow: 'hidden',
                                ...previewBgStyle,
                                position: 'relative',
                                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                                cursor: ehFoto && loginBgModoAj ? 'grab' : 'default',
                                boxShadow: 'inset 0 0 40px rgba(0,0,0,0.3)'
                              }}
                            >
                              {ehFoto && (
                                <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 0 }} />
                              )}
                              
                              {/* Mini Login Card Mockup */}
                              <div style={{
                                position: 'relative', zIndex: 1,
                                width: '75%', background: 'rgba(15,23,42,0.8)',
                                backdropFilter: 'blur(4px)',
                                borderRadius: '12px', padding: '12px',
                                border: '1px solid rgba(255,255,255,0.1)',
                                textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '3px'
                              }}>
                                <span style={{ color: 'white', fontSize: '10px', fontWeight: '700', fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
                                  SMS {municipio.municipalityName || 'Município'}
                                </span>
                                <span style={{ color: '#cbd5e1', fontSize: '8px', fontFamily: 'Inter, sans-serif' }}>
                                  Secretaria de Saúde
                                </span>
                              </div>

                              {ehFoto && loginBgModoAj && (
                                <div style={{
                                  position: 'absolute', left: `${loginBgX}%`, top: `${loginBgY}%`,
                                  transform: 'translate(-50%,-50%)',
                                  width: '18px', height: '18px', borderRadius: '50%',
                                  border: '2px solid #0ea5e9', boxShadow: '0 0 0 1px rgba(0,0,0,0.5)',
                                  pointerEvents: 'none'
                                }} />
                              )}
                            </div>
                          )
                        })()}
                        {loginBgId === 'custom' && !loginBgUrl && (
                          <span style={{ fontSize: '10px', color: '#ef4444', fontWeight: '500' }}>⚠️ Por favor, faça upload de uma imagem personalizada.</span>
                        )}
                        {(loginBgId === 'foto' || loginBgId === 'custom') && loginBgModoAj && (
                          <span style={{ fontSize: '10px', color: '#64748b', textAlign: 'center' }}>
                            🖱️ Clique e arraste na imagem acima para definir a posição de foco.
                          </span>
                        )}
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* TAB 1: GERAL & CONTATOS */}
                {activeTab === 'geral' && (
                  <motion.div
                    key="geral"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}
                  >
                    <div>
                      <h3 style={{ fontSize: '15px', fontWeight: '700', color: '#1e293b', margin: '0 0 4px' }}>Contatos da Secretaria</h3>
                      <p style={{ color: '#64748b', fontSize: '12px', margin: 0 }}>Configure os telefones de suporte que aparecem no chatbot e nos cabeçalhos.</p>
                    </div>

                    {/* All Support Contacts */}
                    <div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
                        {Object.keys(contatos).map(k => {
                          const isEditing = editingContatoKey === k
                          return (
                            <div key={k} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: isEditing ? '#f0f9ff' : '#f8fafc', padding: '10px 14px', borderRadius: '10px', border: '1px solid', borderColor: isEditing ? '#0ea5e9' : '#e2e8f0' }}>
                              {isEditing ? (
                                <div style={{ display: 'flex', gap: '8px', flex: 1, marginRight: '12px' }}>
                                  <input 
                                    type="text" 
                                    value={editContatoLabel} 
                                    onChange={e => setEditContatoLabel(e.target.value)}
                                    className="input-modern"
                                    placeholder="Nome do Contato"
                                    style={{ height: '28px', padding: '2px 8px', fontSize: '12px', margin: 0, flex: 1 }}
                                  />
                                  <input 
                                    type="text" 
                                    value={editContatoValor} 
                                    onChange={e => setEditContatoValor(mascararTelefone(e.target.value))}
                                    className="input-modern"
                                    placeholder="Telefone"
                                    style={{ height: '28px', padding: '2px 8px', fontSize: '12px', margin: 0, flex: 1 }}
                                  />
                                </div>
                              ) : (
                                <span style={{ fontSize: '13px', fontWeight: '600', color: '#334155' }}>
                                  📞 <strong style={{ color: '#0ea5e9' }}>{getFriendlyLabel(k)}:</strong> {mascararTelefone(contatos[k])}
                                </span>
                              )}
                              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                {isEditing ? (
                                  <>
                                    <button type="button" onClick={() => handleSaveCustomContatoEdit(k)} style={{ background: 'none', border: 'none', color: '#10b981', cursor: 'pointer', display: 'flex', alignItems: 'center' }} title="Salvar">
                                      <Check size={15} />
                                    </button>
                                    <button type="button" onClick={handleCancelCustomContatoEdit} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', display: 'flex', alignItems: 'center' }} title="Cancelar">
                                      <X size={15} />
                                    </button>
                                  </>
                                ) : (
                                  <>
                                    <button type="button" onClick={() => handleStartEditContato(k, contatos[k])} style={{ background: 'none', border: 'none', color: '#0284c7', cursor: 'pointer', display: 'flex', alignItems: 'center' }} title="Editar Contato">
                                      <Edit size={14} />
                                    </button>
                                    <button type="button" onClick={() => handleRemoveCustomContato(k)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', display: 'flex', alignItems: 'center' }} title="Remover Contato">
                                      <Trash2 size={14} />
                                    </button>
                                  </>
                                )}
                              </div>
                            </div>
                          )
                        })}
                        {Object.keys(contatos).length === 0 && (
                          <p style={{ fontSize: '12px', color: '#94a3b8', margin: 0, fontStyle: 'italic' }}>Nenhum contato cadastrado.</p>
                        )}
                      </div>

                      {/* Add Custom Contact Form */}
                      <div style={{ background: '#f8fafc', border: '1px dashed #cbd5e1', borderRadius: '12px', padding: '14px', maxWidth: '500px' }}>
                        <h5 style={{ fontSize: '12px', fontWeight: '700', color: '#475569', margin: '0 0 10px' }}>➕ Adicionar Novo Contato</h5>
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
                          <div style={{ flex: 1 }}>
                            <label className="label-modern" style={{ fontSize: '10px' }}>Nome / Identificador</label>
                            <input 
                              type="text" 
                              className="input-modern" 
                              placeholder="Ex: Coordenação TFD" 
                              value={newContatoLabel} 
                              onChange={e => setNewContatoLabel(e.target.value)} 
                              style={{ height: '32px', fontSize: '12px' }}
                            />
                          </div>
                          <div style={{ flex: 1 }}>
                            <label className="label-modern" style={{ fontSize: '10px' }}>Telefone / WhatsApp</label>
                            <input 
                              type="text" 
                              className="input-modern" 
                              placeholder="Ex: (63) 99200-0000" 
                              value={newContatoValor} 
                              onChange={e => setNewContatoValor(mascararTelefone(e.target.value))} 
                              style={{ height: '32px', fontSize: '12px' }}
                            />
                          </div>
                          <button 
                            type="button" 
                            onClick={handleAddCustomContato} 
                            className="btn-primary" 
                            style={{ background: '#0284c7', height: '32px', padding: '0 12px', fontSize: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                          >
                            Adicionar
                          </button>
                        </div>
                      </div>
                    </div>

                    <hr style={{ border: 'none', borderTop: '1px solid #f1f5f9', margin: '10px 0' }} />

                    <div>
                      <h3 style={{ fontSize: '15px', fontWeight: '700', color: '#1e293b', margin: '0 0 4px' }}>Serviços Ativos</h3>
                      <p style={{ color: '#64748b', fontSize: '12px', margin: 0 }}>Habilite ou desabilite opções no menu do assistente virtual.</p>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                      {[
                        { id: 'tfd', label: 'TFD (Tratamento Fora de Domicílio)', desc: 'Permite consulta de viagens agendadas.' },
                        { id: 'farmacia', label: 'Farmácia Municipal', desc: 'Informa telefones e orientações de retirada.' },
                        { id: 'laboratorio', label: 'Laboratório de Exames', desc: 'Informa exames e resultados.' },
                        { id: 'vigilancia', label: 'Vigilância Sanitária', desc: 'Informa contatos e alvarás sanitários.' }
                      ].map(s => (
                        <div 
                          key={s.id} 
                          onClick={() => setServicos(prev => ({ ...prev, [s.id]: !prev[s.id as keyof ServicosMunicipio] }))}
                          style={{
                            display: 'flex', alignItems: 'center', gap: '14px',
                            padding: '14px', borderRadius: '12px', border: '1px solid #e2e8f0',
                            cursor: 'pointer', background: servicos[s.id as keyof ServicosMunicipio] ? 'rgba(16,185,129,0.02)' : 'none',
                            borderColor: servicos[s.id as keyof ServicosMunicipio] ? '#10b981' : '#e2e8f0',
                            transition: 'all 0.2s'
                          }}
                        >
                          <div style={{
                            width: '20px', height: '20px', borderRadius: '6px',
                            border: '2px solid', borderColor: servicos[s.id as keyof ServicosMunicipio] ? '#10b981' : '#cbd5e1',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            background: servicos[s.id as keyof ServicosMunicipio] ? '#10b981' : 'none',
                            color: 'white', flexShrink: 0
                          }}>
                            {servicos[s.id as keyof ServicosMunicipio] && <Check size={14} strokeWidth={3} />}
                          </div>
                          <div>
                            <p style={{ fontSize: '13px', fontWeight: '600', color: '#1e293b', margin: '0 0 2px' }}>{s.label}</p>
                            <p style={{ fontSize: '11px', color: '#64748b', margin: 0 }}>{s.desc}</p>
                          </div>
                        </div>
                      ))}
                    </div>

                    <hr style={{ border: 'none', borderTop: '1px solid #f1f5f9', margin: '10px 0' }} />

                    <div>
                      <h3 style={{ fontSize: '15px', fontWeight: '700', color: '#1e293b', margin: '0 0 4px' }}>Modo de Lembretes (WhatsApp)</h3>
                      <p style={{ color: '#64748b', fontSize: '12px', margin: 0 }}>Escolha se os lembretes de exames, SISREG e TFD devem ser disparados de forma automática ou retidos em uma fila para envio manual.</p>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                      {[
                        { id: 'automatico', label: 'Disparo Automático (Recomendado)', desc: 'Envia os lembretes diretamente pelo WhatsApp nas datas configuradas.' },
                        { id: 'manual', label: 'Disparo Manual (Fila de Lembretes)', desc: 'O sistema realiza a varredura e retém os lembretes em uma fila para aprovação manual.' }
                      ].map(m => (
                        <div 
                          key={m.id} 
                          onClick={() => setMunicipio(prev => ({ ...prev, modoLembrete: m.id }))}
                          style={{
                            display: 'flex', alignItems: 'center', gap: '14px',
                            padding: '14px', borderRadius: '12px', border: '1px solid #e2e8f0',
                            cursor: 'pointer', background: municipio.modoLembrete === m.id ? 'rgba(59,130,246,0.02)' : 'none',
                            borderColor: municipio.modoLembrete === m.id ? '#3b82f6' : '#e2e8f0',
                            transition: 'all 0.2s'
                          }}
                        >
                          <div style={{
                            width: '20px', height: '20px', borderRadius: '50%',
                            border: '2px solid', borderColor: municipio.modoLembrete === m.id ? '#3b82f6' : '#cbd5e1',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            flexShrink: 0
                          }}>
                            {municipio.modoLembrete === m.id && (
                              <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#3b82f6' }} />
                            )}
                          </div>
                          <div>
                            <p style={{ fontSize: '13px', fontWeight: '600', color: '#1e293b', margin: '0 0 2px' }}>{m.label}</p>
                            <p style={{ fontSize: '11px', color: '#64748b', margin: 0 }}>{m.desc}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}

                {/* TAB 2: HORÁRIOS & IA */}
                {activeTab === 'horarios' && (
                  <motion.div
                    key="horarios"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}
                  >
                    <div>
                      <h3 style={{ fontSize: '15px', fontWeight: '700', color: '#1e293b', margin: '0 0 4px' }}>Dias de Funcionamento</h3>
                      <p style={{ color: '#64748b', fontSize: '12px', margin: 0 }}>Selecione os dias em que o bot operará no horário normal. Nos demais dias responderá como fechado.</p>
                    </div>

                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                      {[0, 1, 2, 3, 4, 5, 6].map(d => {
                        const ativo = horarios.dias.includes(d)
                        return (
                          <button
                            key={d}
                            type="button"
                            onClick={() => toggleDiaSemana(d)}
                            style={{
                              padding: '8px 12px', borderRadius: '20px', border: '1px solid',
                              fontSize: '12px', fontWeight: '600', cursor: 'pointer',
                              background: ativo ? '#0ea5e9' : '#fff',
                              color: ativo ? '#fff' : '#64748b',
                              borderColor: ativo ? '#0ea5e9' : '#e2e8f0',
                              transition: 'all 0.15s'
                            }}
                          >
                            {DIAS_NOMES[d]}
                          </button>
                        )
                      })}
                    </div>

                    <hr style={{ border: 'none', borderTop: '1px solid #f1f5f9' }} />

                    <div>
                      <h3 style={{ fontSize: '15px', fontWeight: '700', color: '#1e293b', margin: '0 0 4px' }}>Períodos de Atendimento</h3>
                      <p style={{ color: '#64748b', fontSize: '12px', margin: 0 }}>Defina faixas de horário em que a secretaria atende (ex: 07:00 as 11:00).</p>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxWidth: '400px' }}>
                      {horarios.periodos?.map((p, idx) => (
                        <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: editingPeriodIdx === idx ? '#f0f9ff' : '#f8fafc', padding: '10px 14px', borderRadius: '10px', border: '1px solid', borderColor: editingPeriodIdx === idx ? '#0ea5e9' : '#e2e8f0' }}>
                          <span style={{ fontSize: '13px', fontWeight: '600', color: '#334155' }}>⏰ {p.inicio} até {p.fim}</span>
                          <div style={{ display: 'flex', gap: '8px' }}>
                            <button type="button" onClick={() => handleEditPeriod(idx)} style={{ background: 'none', border: 'none', color: '#0284c7', cursor: 'pointer', display: 'flex', alignItems: 'center' }} title="Editar">
                              <Edit size={14} />
                            </button>
                            <button type="button" onClick={() => handleRemovePeriod(idx)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', display: 'flex', alignItems: 'center' }} title="Remover">
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      ))}

                      <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end', marginTop: '4px' }}>
                        <div style={{ flex: 1 }}>
                          <label className="label-modern">Início</label>
                          <input type="time" className="input-modern" value={newPeriod.inicio} onChange={e => setNewPeriod(p => ({ ...p, inicio: e.target.value }))} />
                        </div>
                        <div style={{ flex: 1 }}>
                          <label className="label-modern">Fim</label>
                          <input type="time" className="input-modern" value={newPeriod.fim} onChange={e => setNewPeriod(p => ({ ...p, fim: e.target.value }))} />
                        </div>
                        <button type="button" onClick={handleAddPeriod} className="btn-primary" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '38px', padding: '0 12px', background: '#0284c7' }} title={editingPeriodIdx !== null ? 'Salvar Período' : 'Adicionar Período'}>
                          {editingPeriodIdx !== null ? <Check size={16} /> : <Plus size={16} />}
                        </button>
                        {editingPeriodIdx !== null && (
                          <button type="button" onClick={handleCancelEditPeriod} className="btn-secondary" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '38px', padding: '0 12px', background: '#ef4444', color: 'white', border: 'none' }} title="Cancelar Edição">
                            <X size={16} />
                          </button>
                        )}
                      </div>
                    </div>

                    <hr style={{ border: 'none', borderTop: '1px solid #f1f5f9' }} />

                    <div>
                      <h3 style={{ fontSize: '15px', fontWeight: '700', color: '#1e293b', margin: '0 0 4px' }}>Mensagem de Fechado</h3>
                      <p style={{ color: '#64748b', fontSize: '12px', margin: '0 0 10px' }}>
                        Mensagem automática quando o cidadão falar fora do horário. Use os marcadores: <code style={{ background: '#f1f5f9', padding: '2px 4px', borderRadius: '4px' }}>{`{nome_assistente}`}</code>, <code style={{ background: '#f1f5f9', padding: '2px 4px', borderRadius: '4px' }}>{`{nome_municipio}`}</code> e <code style={{ background: '#f1f5f9', padding: '2px 4px', borderRadius: '4px' }}>{`{telefone_urgencia}`}</code>.
                      </p>
                      <textarea
                        className="input-modern"
                        rows={6}
                        value={horarios.mensagem_fechado}
                        onChange={e => setHorarios(h => ({ ...h, mensagem_fechado: e.target.value }))}
                        style={{ resize: 'vertical', fontFamily: 'monospace', fontSize: '12px' }}
                      />
                    </div>
                  </motion.div>
                )}

                {/* TAB 3: LISTA DE UBSs */}
                {activeTab === 'ubs' && (
                  <motion.div
                    key="ubs"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}
                  >
                    <div>
                      <h3 style={{ fontSize: '15px', fontWeight: '700', color: '#1e293b', margin: '0 0 4px' }}>Unidades Básicas de Saúde</h3>
                      <p style={{ color: '#64748b', fontSize: '12px', margin: 0 }}>Configure as UBSs para que a IA oriente os pacientes sobre locais de consultas e vacinas.</p>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '12px' }}>
                      {listaUbs.map((ubs, idx) => (
                        <div key={idx} style={{ border: '1px solid', borderRadius: '12px', padding: '16px', position: 'relative', background: editingUbsIdx === idx ? '#f0f9ff' : 'none', borderColor: editingUbsIdx === idx ? '#0ea5e9' : '#e2e8f0' }}>
                          <div style={{ position: 'absolute', top: '16px', right: '16px', display: 'flex', gap: '8px' }}>
                            <button 
                              type="button" 
                              onClick={() => handleEditUbs(idx)} 
                              style={{ background: 'none', border: 'none', color: '#0284c7', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                              title="Editar UBS"
                            >
                              <Edit size={16} />
                            </button>
                            <button 
                              type="button" 
                              onClick={() => handleRemoveUbs(idx)} 
                              style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                              title="Remover UBS"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                          <h4 style={{ color: '#0ea5e9', fontSize: '14px', fontWeight: '700', margin: '0 0 4px' }}>🏢 {ubs.nome}</h4>
                          <p style={{ color: '#475569', fontSize: '12px', margin: '0 0 2px' }}><strong>Descrição:</strong> {ubs.descricao}</p>
                          <p style={{ color: '#475569', fontSize: '12px', margin: '0 0 8px' }}><strong>📞 Contato:</strong> {mascararTelefone(ubs.telefone)}</p>
                          
                          <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                            {ubs.servicos?.map((s, sIdx) => (
                              <span key={sIdx} style={{ fontSize: '10px', background: '#f1f5f9', color: '#475569', padding: '3px 8px', borderRadius: '20px', fontWeight: '600' }}>
                                {s}
                              </span>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>

                    <div style={{ background: '#f8fafc', border: '1px dashed', borderRadius: '12px', padding: '16px', borderColor: editingUbsIdx !== null ? '#0ea5e9' : '#cbd5e1' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                        <h4 style={{ fontSize: '13px', fontWeight: '700', color: '#334155', margin: 0 }}>
                          {editingUbsIdx !== null ? `✍️ Editar UBS: ${listaUbs[editingUbsIdx]?.nome}` : '➕ Adicionar Nova UBS'}
                        </h4>
                        {editingUbsIdx !== null && (
                          <button type="button" onClick={handleCancelEditUbs} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <X size={14} /> Cancelar Edição
                          </button>
                        )}
                      </div>
                      
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                        <div>
                          <label className="label-modern">Nome da Unidade</label>
                          <input type="text" className="input-modern" placeholder="Ex: UBS URBANA" value={newUbs.nome} onChange={e => setNewUbs(u => ({ ...u, nome: e.target.value }))} />
                        </div>
                        <div>
                          <label className="label-modern">Telefone de Contato</label>
                          <input type="text" className="input-modern" placeholder="Ex: (63) 99999-9999" value={newUbs.telefone} onChange={e => setNewUbs(u => ({ ...u, telefone: mascararTelefone(e.target.value) }))} />
                        </div>
                      </div>
                      
                      <div style={{ marginBottom: '12px' }}>
                        <label className="label-modern">Descrição / Localização</label>
                        <input type="text" className="input-modern" placeholder="Ex: Postinho de Saúde Abilio Azevedo" value={newUbs.descricao} onChange={e => setNewUbs(u => ({ ...u, descricao: e.target.value }))} />
                      </div>

                      <div style={{ marginBottom: '16px' }}>
                        <label className="label-modern">Serviços Oferecidos</label>
                        <div style={{ display: 'flex', gap: '6px', marginBottom: '8px', flexWrap: 'wrap' }}>
                          {newUbs.servicos.map((s, sIdx) => (
                            <span key={sIdx} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '10px', background: 'rgba(14,165,233,0.1)', color: '#0284c7', padding: '3px 8px', borderRadius: '20px', fontWeight: '600' }}>
                              {s}
                              <button type="button" onClick={() => handleRemoveNewUbsServico(sIdx)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: 0, fontSize: '12px', fontWeight: 'bold' }}>×</button>
                            </span>
                          ))}
                        </div>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <input type="text" className="input-modern" placeholder="Ex: DENTISTA" value={newUbsServico} onChange={e => setNewUbsServico(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddUbsServico() } }} />
                          <button type="button" onClick={handleAddUbsServico} className="btn-secondary" style={{ padding: '0 12px' }}>Inserir</button>
                        </div>
                      </div>

                      <button type="button" onClick={handleAddUbs} className="btn-primary" style={{ background: editingUbsIdx !== null ? '#0ea5e9' : '#0284c7', width: '100%' }}>
                        {editingUbsIdx !== null ? '✓ Salvar Alterações da UBS' : '✓ Adicionar UBS à Lista'}
                      </button>
                    </div>
                  </motion.div>
                )}

                {/* TAB 4: EQUIPES ACS */}
                {activeTab === 'acs' && (
                  <motion.div
                    key="acs"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}
                  >
                    <div>
                      <h3 style={{ fontSize: '15px', fontWeight: '700', color: '#1e293b', margin: '0 0 4px' }}>Agentes Comunitários de Saúde (ACS)</h3>
                      <p style={{ color: '#64748b', fontSize: '12px', margin: 0 }}>O bot usa esta lista para fazer a triagem inicial e indicar qual ACS o paciente deve procurar.</p>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                      {/* Urbana */}
                      <div style={{ border: '1px solid #e2e8f0', borderRadius: '12px', padding: '16px' }}>
                        <h4 style={{ fontSize: '13px', fontWeight: '700', color: '#0ea5e9', borderBottom: '1px solid #f1f5f9', paddingBottom: '6px', marginBottom: '12px' }}>🏙️ Área Urbana</h4>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '200px', overflowY: 'auto' }}>
                          {(listaAcs.urbana || []).map((name, index) => {
                            const isEditing = editingAcs?.area === 'urbana' && editingAcs?.index === index
                            return (
                              <div key={index} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: isEditing ? '#f0f9ff' : '#f8fafc', padding: '6px 10px', borderRadius: '6px', border: '1px solid', borderColor: isEditing ? '#0ea5e9' : '#f1f5f9' }}>
                                {isEditing ? (
                                  <input 
                                    type="text" 
                                    value={editAcsName} 
                                    onChange={e => setEditAcsName(e.target.value)}
                                    className="input-modern"
                                    style={{ height: '24px', padding: '2px 6px', fontSize: '12px', margin: 0 }}
                                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleSaveAcsEdit() } else if (e.key === 'Escape') { handleCancelAcsEdit() } }}
                                    autoFocus
                                  />
                                ) : (
                                  <span style={{ fontSize: '12px', color: '#334155' }}>{name}</span>
                                )}
                                <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                                  {isEditing ? (
                                    <>
                                      <button type="button" onClick={handleSaveAcsEdit} style={{ background: 'none', border: 'none', color: '#10b981', cursor: 'pointer', padding: 0 }} title="Salvar">
                                        <Check size={14} />
                                      </button>
                                      <button type="button" onClick={handleCancelAcsEdit} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: 0 }} title="Cancelar">
                                        <X size={14} />
                                      </button>
                                    </>
                                  ) : (
                                    <>
                                      <button type="button" onClick={() => handleStartEditAcs('urbana', index, name)} style={{ background: 'none', border: 'none', color: '#0284c7', cursor: 'pointer', padding: 0 }} title="Editar">
                                        <Edit size={13} />
                                      </button>
                                      <button type="button" onClick={() => handleRemoveAcs('urbana', name)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: 0 }} title="Remover">
                                        <Trash2 size={13} />
                                      </button>
                                    </>
                                  )}
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>

                      {/* Rural */}
                      <div style={{ border: '1px solid #e2e8f0', borderRadius: '12px', padding: '16px' }}>
                        <h4 style={{ fontSize: '13px', fontWeight: '700', color: '#f59e0b', borderBottom: '1px solid #f1f5f9', paddingBottom: '6px', marginBottom: '12px' }}>🌾 Área Rural</h4>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '200px', overflowY: 'auto' }}>
                          {(listaAcs.rural || []).map((name, index) => {
                            const isEditing = editingAcs?.area === 'rural' && editingAcs?.index === index
                            return (
                              <div key={index} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: isEditing ? '#f0f9ff' : '#f8fafc', padding: '6px 10px', borderRadius: '6px', border: '1px solid', borderColor: isEditing ? '#0ea5e9' : '#f1f5f9' }}>
                                {isEditing ? (
                                  <input 
                                    type="text" 
                                    value={editAcsName} 
                                    onChange={e => setEditAcsName(e.target.value)}
                                    className="input-modern"
                                    style={{ height: '24px', padding: '2px 6px', fontSize: '12px', margin: 0 }}
                                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleSaveAcsEdit() } else if (e.key === 'Escape') { handleCancelAcsEdit() } }}
                                    autoFocus
                                  />
                                ) : (
                                  <span style={{ fontSize: '12px', color: '#334155' }}>{name}</span>
                                )}
                                <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                                  {isEditing ? (
                                    <>
                                      <button type="button" onClick={handleSaveAcsEdit} style={{ background: 'none', border: 'none', color: '#10b981', cursor: 'pointer', padding: 0 }} title="Salvar">
                                        <Check size={14} />
                                      </button>
                                      <button type="button" onClick={handleCancelAcsEdit} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: 0 }} title="Cancelar">
                                        <X size={14} />
                                      </button>
                                    </>
                                  ) : (
                                    <>
                                      <button type="button" onClick={() => handleStartEditAcs('rural', index, name)} style={{ background: 'none', border: 'none', color: '#0284c7', cursor: 'pointer', padding: 0 }} title="Editar">
                                        <Edit size={13} />
                                      </button>
                                      <button type="button" onClick={() => handleRemoveAcs('rural', name)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: 0 }} title="Remover">
                                        <Trash2 size={13} />
                                      </button>
                                    </>
                                  )}
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    </div>

                    <div style={{ background: '#f8fafc', border: '1px dashed #cbd5e1', borderRadius: '12px', padding: '16px', maxWidth: '500px' }}>
                      <h4 style={{ fontSize: '13px', fontWeight: '700', color: '#334155', margin: '0 0 12px' }}>➕ Cadastrar Agente</h4>
                      
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
                        <div style={{ flex: 2 }}>
                          <label className="label-modern">Nome do Agente (ou Identificador)</label>
                          <input type="text" className="input-modern" placeholder="Ex: 01-Maria" value={newAcsName} onChange={e => setNewAcsName(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddAcs() } }} />
                        </div>
                        <div style={{ flex: 1 }}>
                          <label className="label-modern">Área</label>
                          <select className="input-modern" value={newAcsArea} onChange={e => setNewAcsArea(e.target.value as any)}>
                            <option value="urbana">Urbana</option>
                            <option value="rural">Rural</option>
                          </select>
                        </div>
                        <button type="button" onClick={handleAddAcs} className="btn-primary" style={{ background: '#0284c7', height: '38px', padding: '0 12px' }}>
                          Adicionar
                        </button>
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* TAB 5: ROTAS TFD */}
                {activeTab === 'tfd' && (
                  <motion.div
                    key="tfd"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}
                  >
                    <div>
                      <h3 style={{ fontSize: '15px', fontWeight: '700', color: '#1e293b', margin: '0 0 4px' }}>Destinos de Viagens TFD</h3>
                      <p style={{ color: '#64748b', fontSize: '12px', margin: 0 }}>Configure as rotas municipais oficiais para viagens de Tratamento Fora do Domicílio.</p>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '8px', maxHeight: '300px', overflowY: 'auto', padding: '4px' }}>
                      {tfdDestinos.map((destino, index) => {
                        const isEditing = editingDestinoIdx === index
                        return (
                          <div key={index} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: isEditing ? '#f0f9ff' : '#f8fafc', padding: '10px 14px', borderRadius: '10px', border: '1px solid', borderColor: isEditing ? '#0ea5e9' : '#e2e8f0' }}>
                            {isEditing ? (
                              <input 
                                type="text" 
                                value={editDestinoName} 
                                onChange={e => setEditDestinoName(e.target.value)}
                                className="input-modern"
                                style={{ height: '24px', padding: '2px 6px', fontSize: '12px', margin: 0, textTransform: 'uppercase' }}
                                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleSaveDestinoEdit() } else if (e.key === 'Escape') { handleCancelDestinoEdit() } }}
                                autoFocus
                              />
                            ) : (
                              <span style={{ fontSize: '12px', fontWeight: '600', color: '#334155' }}>🚗 {destino}</span>
                            )}
                            <div style={{ display: 'flex', gap: '8px' }}>
                              {isEditing ? (
                                <>
                                  <button type="button" onClick={handleSaveDestinoEdit} style={{ background: 'none', border: 'none', color: '#10b981', cursor: 'pointer', padding: 0 }} title="Salvar Rota">
                                    <Check size={14} />
                                  </button>
                                  <button type="button" onClick={handleCancelDestinoEdit} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: 0 }} title="Cancelar">
                                    <X size={14} />
                                  </button>
                                </>
                              ) : (
                                <>
                                  <button type="button" onClick={() => handleStartEditDestino(index, destino)} style={{ background: 'none', border: 'none', color: '#0284c7', cursor: 'pointer', padding: 0 }} title="Editar Rota">
                                    <Edit size={14} />
                                  </button>
                                  <button type="button" onClick={() => handleRemoveDestino(destino)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: 0 }} title="Remover Rota">
                                    <Trash2 size={14} />
                                  </button>
                                </>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>

                    <div style={{ background: '#f8fafc', border: '1px dashed #cbd5e1', borderRadius: '12px', padding: '16px', maxWidth: '400px' }}>
                      <h4 style={{ fontSize: '13px', fontWeight: '700', color: '#334155', margin: '0 0 12px' }}>➕ Adicionar Rota de Viagem</h4>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <input type="text" className="input-modern" placeholder="Ex: CONCEIÇÃO/PALMAS" value={newDestino} onChange={e => setNewDestino(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddDestino() } }} />
                        <button type="button" onClick={handleAddDestino} className="btn-primary" style={{ background: '#0284c7', whiteSpace: 'nowrap' }}>Adicionar</button>
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* TAB 6: TEMPLATES WHATSAPP */}
                {activeTab === 'templates' && (
                  <motion.div
                    key="templates"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}
                  >
                    <div>
                      <h3 style={{ fontSize: '15px', fontWeight: '700', color: '#1e293b', margin: '0 0 4px' }}>Templates de Mensagens do WhatsApp (Sincronizado)</h3>
                      <p style={{ color: '#64748b', fontSize: '12px', margin: 0 }}>Configure os textos que a assistente de saúde enviará aos pacientes via WhatsApp. Use chaves como <code style={{ background: '#f1f5f9', padding: '2px 4px', borderRadius: '4px', color: '#0f172a' }}>{"{paciente_nome}"}</code> para inserir dados dinâmicos. Deixe vazio para usar a mensagem padrão do sistema.</p>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                      
                      {/* Grupo 1: Autorizações Imediatas */}
                      <div style={{ border: '1px solid #e2e8f0', borderRadius: '12px', overflow: 'hidden' }}>
                        <div style={{ padding: '12px 16px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', fontWeight: '600', color: '#334155', fontSize: '13px' }}>
                          ⚡ Autorizações Imediatas (Enviadas ao autorizar no sistema)
                        </div>
                        <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '20px', background: '#ffffff' }}>
                          
                          <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                              <label className="label-modern" style={{ fontWeight: '600', color: '#475569', margin: 0 }}>Autorização Local (Especialidades)</label>
                              <span style={{ fontSize: '11px', color: '#94a3b8' }}>Chave: template_esp_auto</span>
                            </div>
                            <textarea
                              id="t_esp_auto"
                              className="input-modern"
                              style={{ width: '100%', height: '160px', resize: 'vertical', fontFamily: 'monospace', fontSize: '12px', lineHeight: '1.4', padding: '10px' }}
                              placeholder="Olá, {paciente_nome}! O seu agendamento de {especialidade} foi autorizado..."
                              value={municipio.template_esp_auto || ''}
                              onChange={e => setMunicipio(prev => ({ ...prev, template_esp_auto: e.target.value }))}
                              onFocus={() => setFocusedField({ key: 'template_esp_auto', id: 't_esp_auto' })}
                            />
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '6px' }}>
                              {['paciente_nome', 'especialidade', 'tipo_exame', 'data_evento', 'profissional', 'periodo', 'municipio', 'assistente_nome'].map(v => (
                                <button
                                  key={v}
                                  type="button"
                                  onMouseDown={e => e.preventDefault()}
                                  onClick={() => insertVariable('template_esp_auto', v, 't_esp_auto')}
                                  style={{ background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '4px', padding: '2px 6px', fontSize: '10px', color: '#475569', cursor: 'pointer' }}
                                >
                                  +{v}
                                </button>
                              ))}
                            </div>
                          </div>

                          <hr style={{ border: 'none', borderTop: '1px solid #f1f5f9', margin: '4px 0' }} />

                          <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                              <label className="label-modern" style={{ fontWeight: '600', color: '#475569', margin: 0 }}>Autorização SISREG</label>
                              <span style={{ fontSize: '11px', color: '#94a3b8' }}>Chave: template_sis_auto</span>
                            </div>
                            <textarea
                              id="t_sis_auto"
                              className="input-modern"
                              style={{ width: '100%', height: '160px', resize: 'vertical', fontFamily: 'monospace', fontSize: '12px', lineHeight: '1.4', padding: '10px' }}
                              placeholder="Olá, {paciente_nome}! O seu procedimento do SISREG ({procedimento}) foi autorizado..."
                              value={municipio.template_sis_auto || ''}
                              onChange={e => setMunicipio(prev => ({ ...prev, template_sis_auto: e.target.value }))}
                              onFocus={() => setFocusedField({ key: 'template_sis_auto', id: 't_sis_auto' })}
                            />
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '6px' }}>
                              {['paciente_nome', 'procedimento', 'data_evento', 'horario', 'local', 'municipio', 'assistente_nome'].map(v => (
                                <button
                                  key={v}
                                  type="button"
                                  onMouseDown={e => e.preventDefault()}
                                  onClick={() => insertVariable('template_sis_auto', v, 't_sis_auto')}
                                  style={{ background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '4px', padding: '2px 6px', fontSize: '10px', color: '#475569', cursor: 'pointer' }}
                                >
                                  +{v}
                                </button>
                              ))}
                            </div>
                          </div>

                        </div>
                      </div>

                      {/* Grupo 2: Lembretes de Véspera */}
                      <div style={{ border: '1px solid #e2e8f0', borderRadius: '12px', overflow: 'hidden' }}>
                        <div style={{ padding: '12px 16px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', fontWeight: '600', color: '#334155', fontSize: '13px' }}>
                          ⏰ Lembretes de Véspera (Enviados 1 dia antes da consulta/viagem)
                        </div>
                        <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '20px', background: '#ffffff' }}>
                          
                          <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                              <label className="label-modern" style={{ fontWeight: '600', color: '#475569', margin: 0 }}>Lembrete de Véspera Local (Especialidades)</label>
                              <span style={{ fontSize: '11px', color: '#94a3b8' }}>Chave: template_esp_vesp</span>
                            </div>
                            <textarea
                              id="t_esp_vesp"
                              className="input-modern"
                              style={{ width: '100%', height: '160px', resize: 'vertical', fontFamily: 'monospace', fontSize: '12px', lineHeight: '1.4', padding: '10px' }}
                              placeholder="Olá, {paciente_nome}! Lembramos que você tem um(a) {especialidade} amanhã..."
                              value={municipio.template_esp_vesp || ''}
                              onChange={e => setMunicipio(prev => ({ ...prev, template_esp_vesp: e.target.value }))}
                              onFocus={() => setFocusedField({ key: 'template_esp_vesp', id: 't_esp_vesp' })}
                            />
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '6px' }}>
                              {['paciente_nome', 'especialidade', 'tipo_exame', 'data_evento', 'profissional', 'periodo', 'municipio', 'assistente_nome'].map(v => (
                                <button
                                  key={v}
                                  type="button"
                                  onMouseDown={e => e.preventDefault()}
                                  onClick={() => insertVariable('template_esp_vesp', v, 't_esp_vesp')}
                                  style={{ background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '4px', padding: '2px 6px', fontSize: '10px', color: '#475569', cursor: 'pointer' }}
                                >
                                  +{v}
                                </button>
                              ))}
                            </div>
                          </div>

                          <hr style={{ border: 'none', borderTop: '1px solid #f1f5f9', margin: '4px 0' }} />

                          <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                              <label className="label-modern" style={{ fontWeight: '600', color: '#475569', margin: 0 }}>Lembrete de Véspera SISREG</label>
                              <span style={{ fontSize: '11px', color: '#94a3b8' }}>Chave: template_sis_vesp</span>
                            </div>
                            <textarea
                              id="t_sis_vesp"
                              className="input-modern"
                              style={{ width: '100%', height: '160px', resize: 'vertical', fontFamily: 'monospace', fontSize: '12px', lineHeight: '1.4', padding: '10px' }}
                              placeholder="Olá, {paciente_nome}! Lembramos que você tem um procedimento amanhã..."
                              value={municipio.template_sis_vesp || ''}
                              onChange={e => setMunicipio(prev => ({ ...prev, template_sis_vesp: e.target.value }))}
                              onFocus={() => setFocusedField({ key: 'template_sis_vesp', id: 't_sis_vesp' })}
                            />
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '6px' }}>
                              {['paciente_nome', 'procedimento', 'data_evento', 'horario', 'local', 'municipio', 'assistente_nome'].map(v => (
                                <button
                                  key={v}
                                  type="button"
                                  onMouseDown={e => e.preventDefault()}
                                  onClick={() => insertVariable('template_sis_vesp', v, 't_sis_vesp')}
                                  style={{ background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '4px', padding: '2px 6px', fontSize: '10px', color: '#475569', cursor: 'pointer' }}
                                >
                                  +{v}
                                </button>
                              ))}
                            </div>
                          </div>

                          <hr style={{ border: 'none', borderTop: '1px solid #f1f5f9', margin: '4px 0' }} />

                          <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                              <label className="label-modern" style={{ fontWeight: '600', color: '#475569', margin: 0 }}>Lembrete de Véspera Viagem TFD</label>
                              <span style={{ fontSize: '11px', color: '#94a3b8' }}>Chave: template_tfd_vesp</span>
                            </div>
                            <textarea
                              id="t_tfd_vesp"
                              className="input-modern"
                              style={{ width: '100%', height: '160px', resize: 'vertical', fontFamily: 'monospace', fontSize: '12px', lineHeight: '1.4', padding: '10px' }}
                              placeholder="Olá, {paciente_nome}! Lembramos que sua viagem de TFD está marcada para amanhã..."
                              value={municipio.template_tfd_vesp || ''}
                              onChange={e => setMunicipio(prev => ({ ...prev, template_tfd_vesp: e.target.value }))}
                              onFocus={() => setFocusedField({ key: 'template_tfd_vesp', id: 't_tfd_vesp' })}
                            />
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '6px' }}>
                              {['paciente_nome', 'data_evento', 'destino', 'horario_saida', 'acompanhante', 'municipio', 'assistente_nome'].map(v => (
                                <button
                                  key={v}
                                  type="button"
                                  onMouseDown={e => e.preventDefault()}
                                  onClick={() => insertVariable('template_tfd_vesp', v, 't_tfd_vesp')}
                                  style={{ background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '4px', padding: '2px 6px', fontSize: '10px', color: '#475569', cursor: 'pointer' }}
                                >
                                  +{v}
                                </button>
                              ))}
                            </div>
                          </div>

                        </div>
                      </div>

                      {/* Grupo 3: Avisos Prévios de 5 dias */}
                      <div style={{ border: '1px solid #e2e8f0', borderRadius: '12px', overflow: 'hidden' }}>
                        <div style={{ padding: '12px 16px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', fontWeight: '600', color: '#334155', fontSize: '13px' }}>
                          📅 Avisos Prévios de 5 Dias (Enviados 5 dias antes da consulta)
                        </div>
                        <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '20px', background: '#ffffff' }}>

                          <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                              <label className="label-modern" style={{ fontWeight: '600', color: '#475569', margin: 0 }}>Lembrete SISREG - Sem Transporte Agendado</label>
                              <span style={{ fontSize: '11px', color: '#94a3b8' }}>Chave: template_sis_5d</span>
                            </div>
                            <textarea
                              id="t_sis_5d"
                              className="input-modern"
                              style={{ width: '100%', height: '160px', resize: 'vertical', fontFamily: 'monospace', fontSize: '12px', lineHeight: '1.4', padding: '10px' }}
                              placeholder="Olá, {paciente_nome}! Falta pouco para o seu procedimento SISREG ({procedimento})..."
                              value={municipio.template_sis_5d || ''}
                              onChange={e => setMunicipio(prev => ({ ...prev, template_sis_5d: e.target.value }))}
                              onFocus={() => setFocusedField({ key: 'template_sis_5d', id: 't_sis_5d' })}
                            />
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '6px' }}>
                              {['paciente_nome', 'procedimento', 'data_evento', 'horario', 'local', 'municipio', 'assistente_nome'].map(v => (
                                <button
                                  key={v}
                                  type="button"
                                  onMouseDown={e => e.preventDefault()}
                                  onClick={() => insertVariable('template_sis_5d', v, 't_sis_5d')}
                                  style={{ background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '4px', padding: '2px 6px', fontSize: '10px', color: '#475569', cursor: 'pointer' }}
                                >
                                  +{v}
                                </button>
                              ))}
                            </div>
                          </div>

                          <hr style={{ border: 'none', borderTop: '1px solid #f1f5f9', margin: '4px 0' }} />

                          <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                              <label className="label-modern" style={{ fontWeight: '600', color: '#475569', margin: 0 }}>Lembrete SISREG - Com Transporte Confirmado</label>
                              <span style={{ fontSize: '11px', color: '#94a3b8' }}>Chave: template_sis_5d_confirmado</span>
                            </div>
                            <textarea
                              id="t_sis_5d_confirmado"
                              className="input-modern"
                              style={{ width: '100%', height: '160px', resize: 'vertical', fontFamily: 'monospace', fontSize: '12px', lineHeight: '1.4', padding: '10px' }}
                              placeholder="Olá, {paciente_nome}! Seu procedimento SISREG ({procedimento}) está chegando... Transporte Confirmado..."
                              value={municipio.template_sis_5d_confirmado || ''}
                              onChange={e => setMunicipio(prev => ({ ...prev, template_sis_5d_confirmado: e.target.value }))}
                              onFocus={() => setFocusedField({ key: 'template_sis_5d_confirmado', id: 't_sis_5d_confirmado' })}
                            />
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '6px' }}>
                              {['paciente_nome', 'procedimento', 'data_evento', 'horario', 'local', 'municipio', 'assistente_nome'].map(v => (
                                <button
                                  key={v}
                                  type="button"
                                  onMouseDown={e => e.preventDefault()}
                                  onClick={() => insertVariable('template_sis_5d_confirmado', v, 't_sis_5d_confirmado')}
                                  style={{ background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '4px', padding: '2px 6px', fontSize: '10px', color: '#475569', cursor: 'pointer' }}
                                >
                                  +{v}
                                </button>
                              ))}
                            </div>
                          </div>

                        </div>
                      </div>

                    </div>
                  </motion.div>
                )}

              </AnimatePresence>
            </div>

          </div>
        )}

      </div>
    </Layout>
  )
}
