import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
)

function normalizarTexto(v: string) {
  return String(v || '').toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Z0-9 ]/g, ' ').trim()
}

function tratarSexo(v: string) {
  const s = String(v || '').toUpperCase().trim()
  if (s === 'M' || s.startsWith('MASC')) return 'M'
  if (s === 'F' || s.startsWith('FEM')) return 'F'
  return ''
}

function calcularIdade(nasc: Date, ref: Date) {
  let idade = ref.getFullYear() - nasc.getFullYear()
  const m = ref.getMonth() - nasc.getMonth()
  if (m < 0 || (m === 0 && ref.getDate() < nasc.getDate())) idade--
  return idade
}

function definirCodigoLogradouro(endereco: string) {
  const end = String(endereco || '').toUpperCase()
  const rurais = ['SITIO', 'FAZENDA', 'CHACARA', 'POVOADO', 'ZONA RURAL', 'ASSENTAMENTO']
  return rurais.some(t => end.includes(t)) ? '037' : '081'
}

function extrairDocumento(cpfCns: string) {
  const limpo = String(cpfCns || '').replace(/\D/g, '')
  if (limpo.length === 11) return { cpf: limpo.padStart(11, '0'), cns: '' }
  if (limpo.length >= 12 && limpo.length <= 15) return { cns: limpo.padStart(15, '0'), cpf: '' }
  return { cpf: '', cns: '' }
}

function cpfInvalidoObvio(cpf: string) {
  if (!cpf || cpf.length !== 11) return false
  return /^(\d)\1+$/.test(cpf)
}

function formatarData(d: Date) {
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const yyyy = d.getFullYear()
  return `${dd}/${mm}/${yyyy}`
}

function padNum(v: any, t: number) {
  return String(v).replace(/\D/g, '').padStart(t, '0').slice(-t)
}

function padTxt(v: any, t: number) {
  return normalizarTexto(String(v || '')).padEnd(t, ' ').substring(0, t)
}

// Quantidade de procedimentos por destino (igual ao sistema antigo)
const QTD_POR_DESTINO: Record<string, number> = {
  'PALMAS': 6,
  'PORTO NACIONAL': 5,
  'ARRAIAS': 2,
  'DIANOPOLIS': 2,
  'DIANÓPOLIS': 2,
  'CAMPOS BELOS': 3,
  'GURUPI': 6
}

function qtdPorDestino(destino: string): number {
  const d = String(destino || '').toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim()
  for (const [chave, qtd] of Object.entries(QTD_POR_DESTINO)) {
    const chaveNorm = chave.toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    if (d.includes(chaveNorm)) return qtd
  }
  return 1
}

// Urgência: dados do TFD (viagens) + pacientes
// Cada viagem gera registro para o PACIENTE + cada ACOMPANHANTE (igual ao sistema antigo)
async function consolidarUrgencia(competencia: string, fixos: any) {
  const ano = competencia.substring(0, 4)
  const mes = competencia.substring(4, 6)
  const dataInicio = `${ano}-${mes}-01`
  const ultimoDia = new Date(Number(ano), Number(mes), 0).getDate()
  const dataFim = `${ano}-${mes}-${String(ultimoDia).padStart(2, '0')}`

  const { data: viagens, error } = await supabase
    .from('viagens')
    .select('*')
    .gte('data_viagem', dataInicio)
    .lte('data_viagem', dataFim)
    .order('data_viagem')

  if (error) throw new Error('Erro ao buscar viagens: ' + error.message)

  const registros = viagens || []

  // Coletar todos os CPFs (pacientes + acompanhantes) para busca em lote
  const todosCpfs = new Set<string>()
  for (const v of registros) {
    const cpfLimpo = String(v.paciente_cpf || '').replace(/\D/g, '')
    if (cpfLimpo) todosCpfs.add(cpfLimpo)
    const a1 = String(v.acomp1_cpf || '').replace(/\D/g, '')
    if (a1) todosCpfs.add(a1)
    const a2 = String(v.acomp2_cpf || '').replace(/\D/g, '')
    if (a2) todosCpfs.add(a2)
  }

  // Buscar apenas os pacientes cujos CPFs estão nas viagens do mês
  // Normaliza ambos os lados para evitar falhas por formatação (123.456.789-00 vs 12345678900)
  let mapaPacientes: Record<string, any> = {}
  if (todosCpfs.size > 0) {
    const cpfsArray = Array.from(todosCpfs)
    // Busca em lotes de 200 para não estourar limites de URL
    const LOTE = 200
    for (let i = 0; i < cpfsArray.length; i += LOTE) {
      const lote = cpfsArray.slice(i, i + LOTE)
      // Tenta buscar pelos CPFs limpos e também pelos formatados
      const cpfsFormatados = lote.map(c => {
        if (c.length === 11) return c.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')
        return c
      })
      const { data: pacs } = await supabase
        .from('pacientes')
        .select('*')
        .or(`cpf_cns.in.(${lote.join(',')}),cpf_cns.in.(${cpfsFormatados.join(',')})`)
      ;(pacs || []).forEach((p: any) => {
        const cpfNorm = String(p.cpf_cns || '').replace(/\D/g, '')
        if (cpfNorm) mapaPacientes[cpfNorm] = p
      })
    }
  }

  const consolidados: any[] = []
  const erros: any[] = []
  let folha = 1
  let seq = 1

  // Expande cada viagem em pessoas: paciente + acompanhantes
  const PROC_PACIENTE     = '0803010125'
  const PROC_ACOMPANHANTE = '0803010109'
  interface Pessoa { nome: string; cpfRaw: string; dtNascViagem: string; sexoViagem: string; endViagem: string; isAcompanhante: boolean }
  const expandirViagem = (v: any): Pessoa[] => {
    const pessoas: Pessoa[] = [
      { nome: v.paciente_nome, cpfRaw: v.paciente_cpf, dtNascViagem: '', sexoViagem: '', endViagem: '', isAcompanhante: false }
    ]
    if (v.acomp1_nome) pessoas.push({ nome: v.acomp1_nome, cpfRaw: v.acomp1_cpf, dtNascViagem: '', sexoViagem: '', endViagem: '', isAcompanhante: true })
    if (v.acomp2_nome) pessoas.push({ nome: v.acomp2_nome, cpfRaw: v.acomp2_cpf, dtNascViagem: '', sexoViagem: '', endViagem: '', isAcompanhante: true })
    return pessoas
  }

  for (const v of registros) {
    const dataAtend = new Date(v.data_viagem + 'T12:00:00')
    const qtd = String(qtdPorDestino(v.destino || '')).padStart(6, '0')
    const pessoas = expandirViagem(v)

    for (const pessoa of pessoas) {
      const nomePaciente = String(pessoa.nome || '').trim()
      if (!nomePaciente) continue

      const cpfNorm = String(pessoa.cpfRaw || '').replace(/\D/g, '')
      const pac = mapaPacientes[cpfNorm] || {}

      const dtNascRaw = pac.dt_nasc || ''
      const dataNasc = dtNascRaw ? new Date(dtNascRaw + 'T12:00:00') : null

      if (!dataNasc || isNaN(dataNasc.getTime())) {
        const motivo = Object.keys(pac).length === 0
          ? 'Paciente não encontrado na base de pacientes'
          : 'Data de nascimento ausente/inválida'
        erros.push({ nome: nomePaciente, data: v.data_viagem, motivo, valor: `CPF: ${cpfNorm}` })
        continue
      }

      const idade = calcularIdade(dataNasc, dataAtend)
      if (idade < 0 || idade > 120) {
        erros.push({ nome: nomePaciente, data: v.data_viagem, motivo: 'Idade inconsistente', valor: String(idade) })
        continue
      }

      const sexoTratado = tratarSexo(pac.sexo || '')
      if (!sexoTratado) {
        erros.push({ nome: nomePaciente, data: v.data_viagem, motivo: 'Sexo não informado', valor: pac.sexo || `CPF: ${cpfNorm}` })
        continue
      }

      const doc = extrairDocumento(cpfNorm || pac.cpf_cns || '')
      if (!doc.cpf && !doc.cns) {
        erros.push({ nome: nomePaciente, data: v.data_viagem, motivo: 'CPF/CNS ausente ou inválido', valor: pessoa.cpfRaw || '' })
        continue
      }

      const endereco = pac.endereco || ''
      const bairro = pac.bairro || ''
      const cep = (String(pac.cep || fixos.CEP_PADRAO)).replace(/\D/g, '').padStart(8, '0')
      const telefone = (pac.telefone || '').replace(/\D/g, '')

      if (seq > 99) { folha++; seq = 1 }

      consolidados.push({
        tipo: '03',
        cnes: fixos.CNES_UNIDADE,
        competencia,
        cnsProfissional: fixos.CNS_PROFISSIONAL,
        cbo: fixos.CBO,
        dataAtendimento: formatarData(dataAtend),
        folha: String(folha).padStart(3, '0'),
        sequencia: String(seq).padStart(2, '0'),
        procedimento: pessoa.isAcompanhante ? PROC_ACOMPANHANTE : PROC_PACIENTE,
        cnsPaciente: doc.cns,
        sexo: sexoTratado,
        ibge: fixos.IBGE,
        cid: '',
        idade: String(idade).padStart(3, '0'),
        quantidade: qtd,
        carater: '01',
        autorizacao: '',
        origem: fixos.ORIGEM,
        nomePaciente: nomePaciente.substring(0, 30),
        dtNascimento: formatarData(dataNasc),
        raca: fixos.RACA,
        nacionalidade: fixos.NACIONALIDADE,
        cep,
        codLogradouro: definirCodigoLogradouro(endereco),
        endereco: endereco.substring(0, 30),
        complemento: '',
        numero: 'SN',
        bairro: bairro.substring(0, 30),
        telefone,
        email: '',
        ine: '',
        cpf: doc.cpf,
        categoria: ''
      })
      seq++
    } // fim pessoas
  } // fim registros

  return { consolidados, erros }
}

// Base de procedimentos do laboratório
// C = BPA Consolidado (tipo 02) | I = BPA Individualizado (tipo 03)
const BASE_LAB: Record<string, { procedimento: string; tipo: 'C' | 'I' }[]> = {
  'EAS':    [{ procedimento: '0202050017', tipo: 'C' }],
  'HBSAG':  [{ procedimento: '0202031446', tipo: 'C' }],
  'HCV':    [{ procedimento: '0202031470', tipo: 'I' }],
  'HCGFB':  [{ procedimento: '0202060217', tipo: 'C' }],
  'VD':     [{ procedimento: '0202031381', tipo: 'I' }, { procedimento: '0202031390', tipo: 'I' }, { procedimento: '0202031403', tipo: 'I' }],
  'HIV':    [{ procedimento: '0202031519', tipo: 'C' }, { procedimento: '0202031500', tipo: 'C' }, { procedimento: '0202031527', tipo: 'C' }],
  'DENGUE': [{ procedimento: '0214010120', tipo: 'I' }],
  'GLI':    [{ procedimento: '0202010473', tipo: 'C' }],
  'COL':    [{ procedimento: '0202010295', tipo: 'C' }],
  'TRI':    [{ procedimento: '0202010678', tipo: 'C' }],
  'ELISAG': [{ procedimento: '0202030768', tipo: 'C' }],
  'ELISAM': [{ procedimento: '0202030873', tipo: 'C' }],
  'GSRH':   [{ procedimento: '0202120082', tipo: 'C' }],
  'U':      [{ procedimento: '0202010694', tipo: 'C' }],
  'HG':     [{ procedimento: '0202020380', tipo: 'C' }],
  'TGO':    [{ procedimento: '0202010643', tipo: 'C' }],
  'TGP':    [{ procedimento: '0202010651', tipo: 'C' }],
  'CRE':    [{ procedimento: '0202010317', tipo: 'C' }],
  'GLI2':   [{ procedimento: '0202010040', tipo: 'C' }],
  'GGT':    [{ procedimento: '0202010465', tipo: 'C' }],
  'PCR':    [{ procedimento: '0202030202', tipo: 'C' }],
  'FP':     [{ procedimento: '0202040089', tipo: 'C' }],
  'TC':     [{ procedimento: '0202020070', tipo: 'C' }],
  'TS':     [{ procedimento: '0202020096', tipo: 'C' }],
  'AEO':    [{ procedimento: '0202030474', tipo: 'C' }],
  'FR':     [{ procedimento: '0202030075', tipo: 'C' }],
  'AU':     [{ procedimento: '0202010120', tipo: 'C' }],
  'SOC':    [{ procedimento: '0202040143', tipo: 'C' }],
  'ZIKA':   [{ procedimento: '0214010112', tipo: 'I' }],
  'CHIKU':  [{ procedimento: '0214010139', tipo: 'I' }],
  'VHS':    [{ procedimento: '0202020150', tipo: 'C' }],
  'PSA':    [{ procedimento: '0202030105', tipo: 'C' }],
  'HDL':    [{ procedimento: '0202010279', tipo: 'C' }],
  'RUB':    [{ procedimento: '0202030814', tipo: 'C' }, { procedimento: '0202030920', tipo: 'C' }],
  'HER':    [{ procedimento: '0202030954', tipo: 'I' }],
}

function normalizarExame(v: string) {
  return String(v || '').toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Z0-9]/g, '').trim()
}

function resolverProcedimentoLab(exame: string): { procedimento: string; tipo: 'C' | 'I' } | null {
  const exameNorm = normalizarExame(exame)
  if (!exameNorm) return null
  // Busca exata
  if (BASE_LAB[exameNorm]) return BASE_LAB[exameNorm][0]
  // Busca parcial (exame começa com a chave)
  for (const [chave, defs] of Object.entries(BASE_LAB)) {
    if (exameNorm.startsWith(chave) || chave.startsWith(exameNorm)) return defs[0]
  }
  return null
}

// Laboratório: dados enviados via XLS importado
// BPA-C (tipo 02): agrupa por procedimento e conta quantidade
// BPA-I (tipo 03): individualizado com dados do paciente
async function consolidarLaboratorio(linhas: any[], competencia: string, fixos: any) {
  const erros: any[] = []

  // --- BUSCA NA BASE DE PACIENTES ---
  const todosCpfs = new Set<string>()
  const todosNomes = new Set<string>()
  for (const linha of linhas) {
    const cpfLimpo = String(linha.cpf || linha.cns || '').replace(/\D/g, '')
    if (cpfLimpo) todosCpfs.add(cpfLimpo)
    const nome = String(linha.nome || '').trim().toUpperCase()
    if (nome) todosNomes.add(nome)
  }

  const mapaPacientesPorCpf: Record<string, any> = {}
  const mapaPacientesPorNome: Record<string, any> = {}

  const LOTE = 200
  // Busca por CPFs
  if (todosCpfs.size > 0) {
    const cpfsArray = Array.from(todosCpfs)
    for (let i = 0; i < cpfsArray.length; i += LOTE) {
      const lote = cpfsArray.slice(i, i + LOTE)
      const cpfsFormatados = lote.map(c => c.length === 11 ? c.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4') : c)
      const { data: pacs } = await supabase.from('pacientes').select('*').or(`cpf_cns.in.(${lote.join(',')}),cpf_cns.in.(${cpfsFormatados.join(',')})`)
      ;(pacs || []).forEach((p: any) => {
        const cpfNorm = String(p.cpf_cns || '').replace(/\D/g, '')
        if (cpfNorm) mapaPacientesPorCpf[cpfNorm] = p
      })
    }
  }

  // Busca por Nomes
  if (todosNomes.size > 0) {
    const nomesArray = Array.from(todosNomes)
    for (let i = 0; i < nomesArray.length; i += LOTE) {
      const lote = nomesArray.slice(i, i + LOTE)
      const { data: pacs } = await supabase.from('pacientes').select('*').in('nome', lote)
      ;(pacs || []).forEach((p: any) => {
        const nomeNorm = String(p.nome || '').trim().toUpperCase()
        if (nomeNorm) mapaPacientesPorNome[nomeNorm] = p
      })
    }
  }
  // ----------------------------------

  // Separa registros por tipo
  const agrupados: Record<string, number> = {} // chave: procedimento → quantidade (BPA-C)
  const individualizados: any[] = []            // BPA-I

  for (const linha of linhas) {
    const nomePaciente = String(linha.nome || '').trim()
    if (!nomePaciente) continue

    const dtAtendRaw = String(linha.dataAtendimento || '')
    const dataAtend = new Date(dtAtendRaw.includes('/')
      ? dtAtendRaw.split('/').reverse().join('-') + 'T12:00:00'
      : dtAtendRaw + 'T12:00:00')

    if (isNaN(dataAtend.getTime())) {
      erros.push({ nome: nomePaciente, data: dtAtendRaw, motivo: 'Data de atendimento inválida', valor: dtAtendRaw })
      continue
    }

    const compReg = String(dataAtend.getFullYear()) + String(dataAtend.getMonth() + 1).padStart(2, '0')
    if (compReg !== competencia) {
      erros.push({ nome: nomePaciente, data: dtAtendRaw, motivo: 'Competência errada, favor verificar o arquivo', valor: dtAtendRaw })
      continue
    }

    // Resolver procedimento via base de exames
    const exameRaw = String(linha.procedimento || '').trim()
    const def = resolverProcedimentoLab(exameRaw)
    const procedimento = def?.procedimento || String(exameRaw).replace(/\D/g, '') || fixos.PROCEDIMENTO
    const tipoReg = def?.tipo || 'I'

    if (!procedimento) {
      erros.push({ nome: nomePaciente, data: dtAtendRaw, motivo: 'Procedimento não encontrado na base', valor: exameRaw })
      continue
    }

    if (tipoReg === 'C') {
      // BPA Consolidado: apenas conta
      agrupados[procedimento] = (agrupados[procedimento] || 0) + 1
      continue
    }

    // BPA Individualizado: precisa de dados completos
    const cpfCSV = String(linha.cpf || linha.cns || '').replace(/\D/g, '')
    const nomeCSV = nomePaciente.toUpperCase()
    const pacDb = mapaPacientesPorCpf[cpfCSV] || mapaPacientesPorNome[nomeCSV] || {}

    const dtNascRaw = String(linha.dtNasc || '')
    let dataNasc = new Date(dtNascRaw.includes('/')
      ? dtNascRaw.split('/').reverse().join('-') + 'T12:00:00'
      : dtNascRaw + 'T12:00:00')

    if (isNaN(dataNasc.getTime())) {
      if (pacDb.dt_nasc) {
        dataNasc = new Date(pacDb.dt_nasc + 'T12:00:00')
      } else {
        erros.push({ nome: nomePaciente, data: dtAtendRaw, motivo: 'Data de nascimento inválida/ausente', valor: dtNascRaw })
        continue
      }
    }

    const idade = calcularIdade(dataNasc, dataAtend)
    if (idade < 0 || idade > 120) {
      erros.push({ nome: nomePaciente, data: dtAtendRaw, motivo: 'Idade inconsistente', valor: String(idade) })
      continue
    }

    const sexoTratado = tratarSexo(linha.sexo || '') || tratarSexo(pacDb.sexo || '')
    if (!sexoTratado) {
      erros.push({ nome: nomePaciente, data: dtAtendRaw, motivo: 'Sexo não informado', valor: linha.sexo || '' })
      continue
    }

    let doc = extrairDocumento(cpfCSV)
    if ((!doc.cpf && !doc.cns) || cpfInvalidoObvio(doc.cpf)) {
      const docDb = extrairDocumento(pacDb.cpf_cns || '')
      if (docDb.cpf || docDb.cns) {
        doc = docDb
      } else {
        erros.push({ nome: nomePaciente, data: dtAtendRaw, motivo: 'CPF/CNS ausente/inválido e não achou na base', valor: linha.cpf || '' })
        continue
      }
    }

    individualizados.push({
      nomePaciente,
      dataAtend,
      dataNasc,
      idade,
      sexoTratado,
      doc,
      procedimento,
      endereco: String(linha.endereco || pacDb.endereco || ''),
      bairro: String(linha.bairro || pacDb.bairro || ''),
      cep: String(linha.cep || pacDb.cep || fixos.CEP_PADRAO).replace(/\D/g, '').padStart(8, '0'),
      numero: String(linha.numero || 'SN').substring(0, 5),
      telefone: String(linha.telefone || pacDb.telefone || '').replace(/\D/g, ''),
    })
  }

  const consolidados: any[] = []
  let folha = 1
  let seq = 1

  // BPA-C primeiro
  for (const [proc, qtd] of Object.entries(agrupados).sort()) {
    if (seq > 99) { folha++; seq = 1 }
    consolidados.push({
      tipo: '02',
      cnes: fixos.CNES_UNIDADE,
      competencia,
      cnsProfissional: '',
      cbo: fixos.CBO,
      dataAtendimento: '',
      folha: String(folha).padStart(3, '0'),
      sequencia: String(seq).padStart(2, '0'),
      procedimento: proc,
      cnsPaciente: '',
      sexo: '',
      ibge: fixos.IBGE,
      cid: '',
      idade: '000',
      quantidade: String(qtd).padStart(6, '0'),
      carater: '',
      autorizacao: '',
      origem: fixos.ORIGEM,
      nomePaciente: '',
      dtNascimento: '',
      raca: fixos.RACA,
      nacionalidade: fixos.NACIONALIDADE,
      cep: '', codLogradouro: '', endereco: '',
      complemento: '', numero: '', bairro: '',
      telefone: '', email: '', ine: '', cpf: '', categoria: ''
    })
    seq++
  }

  // BPA-I depois (reinicia folha/seq conforme sistema antigo)
  if (Object.keys(agrupados).length > 0 && individualizados.length > 0) {
    folha = 1; seq = 1
  }

  for (const r of individualizados) {
    if (seq > 99) { folha++; seq = 1 }
    const endereco = r.endereco
    consolidados.push({
      tipo: '03',
      cnes: fixos.CNES_UNIDADE,
      competencia,
      cnsProfissional: fixos.CNS_PROFISSIONAL,
      cbo: fixos.CBO,
      dataAtendimento: formatarData(r.dataAtend),
      folha: String(folha).padStart(3, '0'),
      sequencia: String(seq).padStart(2, '0'),
      procedimento: r.procedimento,
      cnsPaciente: r.doc.cns,
      sexo: r.sexoTratado,
      ibge: fixos.IBGE,
      cid: '',
      idade: String(r.idade).padStart(3, '0'),
      quantidade: '000001',
      carater: '01',
      autorizacao: '',
      origem: fixos.ORIGEM,
      nomePaciente: r.nomePaciente.substring(0, 30),
      dtNascimento: formatarData(r.dataNasc),
      raca: fixos.RACA,
      nacionalidade: fixos.NACIONALIDADE,
      cep: r.cep,
      codLogradouro: definirCodigoLogradouro(endereco),
      endereco: endereco.substring(0, 30),
      complemento: '',
      numero: r.numero,
      bairro: r.bairro.substring(0, 30),
      telefone: r.telefone,
      email: '',
      ine: '',
      cpf: r.doc.cpf,
      categoria: ''
    })
    seq++
  }

  return { consolidados, erros }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { perfil, competencia, fixos, linhasLab } = body

    if (!/^\d{6}$/.test(competencia)) {
      return NextResponse.json({ error: 'Competência inválida. Use AAAAMM.' }, { status: 400 })
    }

    let resultado
    if (perfil === 'laboratorio') {
      if (!linhasLab?.length) return NextResponse.json({ error: 'Nenhum dado de laboratório enviado.' }, { status: 400 })
      resultado = await consolidarLaboratorio(linhasLab, competencia, fixos)
    } else {
      resultado = await consolidarUrgencia(competencia, fixos)
    }

    return NextResponse.json({ ok: true, ...resultado })
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }
}
