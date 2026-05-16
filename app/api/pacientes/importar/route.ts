import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const maxDuration = 60

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
    const { linhas, sobrescreverTelefones } = await request.json()
    if (!linhas || !Array.isArray(linhas) || linhas.length === 0) {
      return NextResponse.json({ error: 'Nenhum dado recebido.' }, { status: 400 })
    }

    // Coleta documentos válidos (apenas quem tem CPF/CNS)
    const docsNormalizados: string[] = []
    const docsFormatados: string[] = []

    linhas.forEach(l => {
      const doc = normalizarDocumento(l.cpf || l.cns)
      if (doc && doc.length >= 11) {
        docsNormalizados.push(doc)
        if (doc.length === 11) {
          docsFormatados.push(doc.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4'))
        }
      }
    })

    const mapaPacientesPorDoc: Record<string, any> = {}

    // Busca por documentos normalizados (dígitos) — query única eficiente
    if (docsNormalizados.length > 0) {
      // Busca por dígitos puros
      const { data: pac1 } = await supabase
        .from('pacientes')
        .select('id, nome, cpf_cns, dt_nasc, sexo, telefone, endereco, bairro, cep')
        .in('cpf_cns', docsNormalizados)
      ;(pac1 || []).forEach(p => {
        mapaPacientesPorDoc[normalizarDocumento(p.cpf_cns)] = p
      })

      // Busca pelos CPFs formatados (xxx.xxx.xxx-xx) que o banco possa ter
      if (docsFormatados.length > 0) {
        const { data: pac2 } = await supabase
          .from('pacientes')
          .select('id, nome, cpf_cns, dt_nasc, sexo, telefone, endereco, bairro, cep')
          .in('cpf_cns', docsFormatados)
        ;(pac2 || []).forEach(p => {
          const doc = normalizarDocumento(p.cpf_cns)
          if (!mapaPacientesPorDoc[doc]) mapaPacientesPorDoc[doc] = p
        })
      }
    }

    const inserts: any[] = []
    const updates: any[] = []
    let ignorados = 0

    for (const linha of linhas) {
      const nome = normalizarTexto(linha.nome)
      if (!nome) continue

      let dtNasc = linha.dtNasc
      if (dtNasc && dtNasc.includes('/')) {
        dtNasc = dtNasc.split('/').reverse().join('-')
      }

      const docLinha = normalizarDocumento(linha.cpf || linha.cns)
      const pacDb = docLinha ? mapaPacientesPorDoc[docLinha] : null

      const telefoneCSV = normalizarDocumento(linha.telefone)
      const enderecoNovo = normalizarTexto(linha.endereco)
      const bairroNovo = normalizarTexto(linha.bairro)
      const cepNovo = normalizarDocumento(linha.cep)
      const sexoNovo = tratarSexo(linha.sexo)

      const payload: any = {
        nome,
        cpf_cns: docLinha || (pacDb ? pacDb.cpf_cns : ''),
        dt_nasc: dtNasc || (pacDb ? pacDb.dt_nasc : null),
        sexo: sexoNovo || (pacDb ? pacDb.sexo : ''),
        endereco: enderecoNovo || (pacDb ? pacDb.endereco : ''),
        bairro: bairroNovo || (pacDb ? pacDb.bairro : ''),
        cep: cepNovo || (pacDb ? pacDb.cep : '')
      }

      if (!pacDb) {
        payload.telefone = telefoneCSV
        inserts.push(payload)
      } else {
        const telefoneBanco = normalizarDocumento(pacDb.telefone)
        if (telefoneCSV && sobrescreverTelefones) {
          payload.telefone = telefoneCSV
        } else if (telefoneBanco) {
          payload.telefone = telefoneBanco
        } else {
          payload.telefone = telefoneCSV
        }

        let mudou = false
        if (docLinha && docLinha !== normalizarDocumento(pacDb.cpf_cns)) mudou = true
        if (dtNasc && dtNasc !== pacDb.dt_nasc) mudou = true
        if (sexoNovo && sexoNovo !== pacDb.sexo) mudou = true
        if (payload.telefone !== normalizarDocumento(pacDb.telefone)) mudou = true
        if (enderecoNovo && enderecoNovo !== normalizarTexto(pacDb.endereco)) mudou = true
        if (bairroNovo && bairroNovo !== normalizarTexto(pacDb.bairro)) mudou = true
        if (cepNovo && cepNovo !== normalizarDocumento(pacDb.cep)) mudou = true

        if (mudou) {
          payload.id = pacDb.id
          updates.push(payload)
        } else {
          ignorados++
        }
      }
    }

    // Inserir novos em lote único
    let inseridosReal = 0
    if (inserts.length > 0) {
      const { error } = await supabase.from('pacientes').insert(inserts)
      if (!error) inseridosReal = inserts.length
      else console.error('Erro insert:', error.message)
    }

    // Atualizar existentes: lotes de 25 em paralelo (controlado)
    let atualizadosReal = 0
    const LOTE_UP = 25
    for (let i = 0; i < updates.length; i += LOTE_UP) {
      const lote = updates.slice(i, i + LOTE_UP)
      const resultados = await Promise.all(
        lote.map(({ id, ...payload }) =>
          supabase.from('pacientes').update(payload).eq('id', id)
        )
      )
      atualizadosReal += resultados.filter(r => !r.error).length
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
    console.error('Erro importar:', error)
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }
}
