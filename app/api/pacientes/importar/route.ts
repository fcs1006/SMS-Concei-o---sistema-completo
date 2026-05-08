import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
)

function normalizarDocumento(v: string) {
  return String(v || '').replace(/\D/g, '')
}

function normalizarTexto(v: string) {
  return String(v || '').toUpperCase().trim()
}

function tratarSexo(v: string) {
  const s = normalizarTexto(v)
  if (s === 'M' || s.startsWith('MASC')) return 'M'
  if (s === 'F' || s.startsWith('FEM')) return 'F'
  return ''
}

export async function POST(request: NextRequest) {
  try {
    const { linhas } = await request.json()
    if (!linhas || !Array.isArray(linhas) || linhas.length === 0) {
      return NextResponse.json({ error: 'Nenhum dado recebido.' }, { status: 400 })
    }

    const todosDocumentos = new Set<string>()
    const todosNomes = new Set<string>()

    linhas.forEach(l => {
      const doc = normalizarDocumento(l.cpf || l.cns)
      if (doc) todosDocumentos.add(doc)
      const nome = normalizarTexto(l.nome)
      if (nome) todosNomes.add(nome)
    })

    const mapaPacientesPorDoc: Record<string, any> = {}
    const mapaPacientesPorNome: Record<string, any> = {}

    // Busca pacientes existentes no banco em lotes
    const LOTE = 200

    if (todosDocumentos.size > 0) {
      const docsArray = Array.from(todosDocumentos)
      for (let i = 0; i < docsArray.length; i += LOTE) {
        const lote = docsArray.slice(i, i + LOTE)
        const formatados = lote.map(c => c.length === 11 ? c.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4') : c)
        
        const { data: pacs } = await supabase
          .from('pacientes')
          .select('*')
          .or(`cpf_cns.in.(${lote.join(',')}),cpf_cns.in.(${formatados.join(',')})`)
        
        ;(pacs || []).forEach(p => {
          const doc = normalizarDocumento(p.cpf_cns)
          if (doc) mapaPacientesPorDoc[doc] = p
        })
      }
    }

    if (todosNomes.size > 0) {
      const nomesArray = Array.from(todosNomes)
      for (let i = 0; i < nomesArray.length; i += LOTE) {
        const lote = nomesArray.slice(i, i + LOTE)
        const { data: pacs } = await supabase.from('pacientes').select('*').in('nome', lote)
        ;(pacs || []).forEach(p => {
          const nome = normalizarTexto(p.nome)
          if (nome) mapaPacientesPorNome[nome] = p
        })
      }
    }

    const inserts = []
    const updates = []
    let ignorados = 0

    for (const linha of linhas) {
      const nome = normalizarTexto(linha.nome)
      if (!nome) continue

      let dtNasc = linha.dtNasc
      if (dtNasc && dtNasc.includes('/')) {
        dtNasc = dtNasc.split('/').reverse().join('-')
      }

      const docLinha = normalizarDocumento(linha.cpf || linha.cns)
      const pacDb = mapaPacientesPorDoc[docLinha] || mapaPacientesPorNome[nome]

      const telefoneCSV = normalizarDocumento(linha.telefone)
      
      const payload: any = {
        nome: nome,
        cpf_cns: docLinha || (pacDb ? pacDb.cpf_cns : ''),
        dt_nasc: dtNasc || (pacDb ? pacDb.dt_nasc : null),
        sexo: tratarSexo(linha.sexo) || (pacDb ? pacDb.sexo : ''),
        endereco: normalizarTexto(linha.endereco) || (pacDb ? pacDb.endereco : ''),
        bairro: normalizarTexto(linha.bairro) || (pacDb ? pacDb.bairro : ''),
        cep: normalizarDocumento(linha.cep) || (pacDb ? pacDb.cep : '')
      }

      if (!pacDb) {
        // NOVO PACIENTE
        payload.telefone = telefoneCSV
        inserts.push(payload)
      } else {
        // PACIENTE EXISTENTE
        // Regra de Ouro: NÃO ATUALIZAR O TELEFONE SE O BANCO JÁ TIVER UM TELEFONE
        const telefoneBanco = normalizarDocumento(pacDb.telefone)
        if (telefoneBanco) {
          payload.telefone = telefoneBanco // preserva o do banco
        } else {
          payload.telefone = telefoneCSV // atualiza se estava vazio
        }

        // Verifica se há alguma alteração real para evitar updates desnecessários
        let mudou = false
        if (payload.cpf_cns !== pacDb.cpf_cns) mudou = true
        if (payload.dt_nasc !== pacDb.dt_nasc) mudou = true
        if (payload.sexo !== pacDb.sexo) mudou = true
        if (payload.telefone !== normalizarDocumento(pacDb.telefone)) mudou = true
        if (payload.endereco !== pacDb.endereco && payload.endereco) mudou = true
        if (payload.bairro !== pacDb.bairro && payload.bairro) mudou = true

        if (mudou) {
          payload.id = pacDb.id
          updates.push(payload)
        } else {
          ignorados++
        }
      }
    }

    // Executar operações em lotes
    let inseridosReal = 0
    let atualizadosReal = 0

    if (inserts.length > 0) {
      for (let i = 0; i < inserts.length; i += LOTE) {
        const { error } = await supabase.from('pacientes').insert(inserts.slice(i, i + LOTE))
        if (!error) inseridosReal += inserts.slice(i, i + LOTE).length
      }
    }

    if (updates.length > 0) {
      // Upsert é seguro aqui pois temos os IDs
      for (let i = 0; i < updates.length; i += LOTE) {
        const { error } = await supabase.from('pacientes').upsert(updates.slice(i, i + LOTE))
        if (!error) atualizadosReal += updates.slice(i, i + LOTE).length
      }
    }

    return NextResponse.json({
      ok: true,
      resultados: {
        totalProcessado: linhas.length,
        inseridos: inseridosReal,
        atualizados: atualizadosReal,
        ignorados: ignorados + (inserts.length - inseridosReal) + (updates.length - atualizadosReal)
      }
    })

  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }
}
