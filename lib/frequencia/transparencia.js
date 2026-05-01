const TRANSPARENCIA_CONFIG = {
  URL_API_PAGINADO: 'https://api-transparencia.publixel.com.br/api/servidor/paginado',
  URL_API_ATUALIZACAO: 'https://api-transparencia.publixel.com.br/api/servidor/data-de-atualizacao',
  TAMANHO_PAGINA: 100,
  USER_AGENT: 'Mozilla/5.0 (compatible; SMSConceicao/1.0; +https://conceicaodotocantins.to.gov.br/)',
  CODIGO_ORGAO_SAUDE: 5
}

export function normalizarCompetenciaTransparencia(ano, mes) {
  const hoje = new Date()
  const anoNum = Number(ano || hoje.getFullYear())
  const mesNum = Number(mes || hoje.getMonth() + 1)

  if (!anoNum || anoNum < 2000) throw new Error('Ano inválido.')
  if (!mesNum || mesNum < 1 || mesNum > 12) throw new Error('Mês inválido.')

  return { ano: anoNum, mes: mesNum }
}

export function normalizarTexto(txt) {
  return String(txt || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase()
}

export function mapearServidorApi(item) {
  return {
    nome: String(item?.nome || '').trim(),
    matricula: String(item?.matricula || '').trim(),
    lotacao: String(item?.departamento || '').trim(),
    funcao: String(item?.cargo || '').trim(),
    situacao: String(item?.situacao || '').trim()
  }
}

export async function fetchJsonApi(url) {
  let resposta

  try {
    resposta = await fetch(url, {
      headers: {
        Accept: 'application/json',
        'Accept-Language': 'pt-BR,pt;q=0.9',
        'User-Agent': TRANSPARENCIA_CONFIG.USER_AGENT
      },
      cache: 'no-store'
    })
  } catch (error) {
    throw new Error(`Falha de rede ao consultar o portal: ${error.message}`)
  }

  const corpo = await resposta.text()
  if (!resposta.ok) {
    throw new Error(`API retornou HTTP ${resposta.status}`)
  }

  if (!corpo.trim()) {
    throw new Error('API retornou resposta vazia.')
  }

  try {
    return JSON.parse(corpo)
  } catch {
    throw new Error(`JSON inválido recebido da API: ${corpo.slice(0, 200)}`)
  }
}

export async function buscarDataAtualizacaoPortal() {
  const resposta = await fetch(TRANSPARENCIA_CONFIG.URL_API_ATUALIZACAO, {
    headers: {
      Accept: 'application/json',
      'User-Agent': TRANSPARENCIA_CONFIG.USER_AGENT
    },
    cache: 'no-store'
  })

  if (!resposta.ok) {
    throw new Error(`Portal retornou HTTP ${resposta.status} ao buscar atualização.`)
  }

  const bruto = await resposta.text()

  try {
    const valor = JSON.parse(bruto)
    return String(valor || '').trim()
  } catch {
    return bruto.replace(/^"+|"+$/g, '').trim()
  }
}

export async function buscarTodosServidoresApi(ano, mes) {
  const mes2 = String(mes).padStart(2, '0')
  const tamanho = TRANSPARENCIA_CONFIG.TAMANHO_PAGINA
  const todos = []
  let pagina = 1
  let totalEsperado = null

  while (true) {
    const url =
      `${TRANSPARENCIA_CONFIG.URL_API_PAGINADO}` +
      `?pagina=${pagina}&tamanhoDaPagina=${tamanho}` +
      `&ano=${ano}&mes=${mes2}` +
      `&codigoDoOrgao=${TRANSPARENCIA_CONFIG.CODIGO_ORGAO_SAUDE}`

    const dados = await fetchJsonApi(url)

    if (totalEsperado === null) {
      totalEsperado = Number(dados?.totalRegistros || dados?.total || 0)
    }

    const registros = Array.isArray(dados?.registros) ? dados.registros : []
    if (!registros.length) break

    todos.push(...registros.map(mapearServidorApi).filter((servidor) => servidor.nome))

    if (totalEsperado > 0 && todos.length >= totalEsperado) break
    if (registros.length < tamanho) break
    if (todos.length >= 5000) break
    pagina += 1
  }

  return todos
}

function montarPayloadServidor(servidor) {
  return {
    nome: servidor.nome,
    matricula: servidor.matricula,
    lotacao: servidor.lotacao || '',
    funcao: servidor.funcao,
    situacao: servidor.situacao || ''
  }
}

export async function sincronizarServidoresNoSupabase(supabase, servidoresPortal) {
  if (!servidoresPortal?.length) {
    return { inseridos: 0, atualizados: 0, ignorados: 0, inativos: 0 }
  }

  const { data: existentes, error: erroBusca } = await supabase
    .from('servidores')
    .select('*')

  if (erroBusca) {
    throw new Error(`Erro ao carregar servidores do Supabase: ${erroBusca.message}`)
  }

  const linhasExistentes = existentes || []
  const mapaPorMatricula = new Map()

  linhasExistentes.forEach((linha) => {
    const matricula = normalizarTexto(linha?.matricula)
    if (matricula) mapaPorMatricula.set(matricula, linha)
  })

  const temStatus = linhasExistentes.some((linha) => Object.prototype.hasOwnProperty.call(linha, 'status'))
  const matriculasPortal = new Set()
  const novos = []
  let atualizados = 0
  let ignorados = 0

  for (const servidor of servidoresPortal) {
    const matriculaNormalizada = normalizarTexto(servidor.matricula)
    if (!matriculaNormalizada) {
      ignorados += 1
      continue
    }

    matriculasPortal.add(matriculaNormalizada)

    const existente = mapaPorMatricula.get(matriculaNormalizada)
    const payload = montarPayloadServidor(servidor)

    if (existente?.id) {
      // Não sobrescreve `situacao` — campo gerenciado manualmente pelo usuário
      const { situacao: _ignorado, ...payloadSemSituacao } = payload
      const updatePayload = { ...payloadSemSituacao }
      if (temStatus) updatePayload.status = 'ATIVO'

      const { error } = await supabase
        .from('servidores')
        .update(updatePayload)
        .eq('id', existente.id)

      if (error) {
        throw new Error(`Erro ao atualizar matrícula ${servidor.matricula}: ${error.message}`)
      }

      atualizados += 1
      continue
    }

    novos.push({
      ...payload,
      ...(temStatus ? { status: 'ATIVO' } : {})
    })
  }

  if (novos.length) {
    for (let indice = 0; indice < novos.length; indice += 100) {
      const lote = novos.slice(indice, indice + 100)
      const { error } = await supabase.from('servidores').insert(lote)

      if (error) {
        throw new Error(`Erro ao inserir servidores no Supabase: ${error.message}`)
      }
    }
  }

  let inativos = 0

  if (temStatus) {
    for (const linha of linhasExistentes) {
      const matricula = normalizarTexto(linha?.matricula)
      if (!matricula || matriculasPortal.has(matricula)) continue

      const nivel = normalizarTexto(linha?.nivel)
      if (nivel === 'PRESTADOR') continue

      const { error } = await supabase
        .from('servidores')
        .update({ status: 'INATIVO' })
        .eq('id', linha.id)

      if (error) {
        throw new Error(`Erro ao marcar matrícula ${linha.matricula} como inativa: ${error.message}`)
      }

      inativos += 1
    }
  }

  return {
    inseridos: novos.length,
    atualizados,
    ignorados,
    inativos
  }
}
