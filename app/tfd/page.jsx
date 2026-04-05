'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Layout from '@/components/Layout'
import { abrirJanelaImpressao } from '@/lib/printHeader'

export default function TFD() {
  const router = useRouter()
  const [usuario, setUsuario] = useState(null)
  const [data, setData] = useState('')
  const [palmas, setPalmas] = useState([])
  const [porto, setPorto] = useState([])
  const [carregando, setCarregando] = useState(false)
  const [gerado, setGerado] = useState(false)

  useEffect(() => {
    const u = localStorage.getItem('sms_user')
    if (!u) { router.push('/'); return }
    setUsuario(JSON.parse(u))
    const hoje = new Date().toISOString().split('T')[0]
    setData(hoje)
  }, [])

  async function gerar() {
    if (!data) { alert('Selecione uma data!'); return }
    setCarregando(true)
    setGerado(false)

    const { data: viagens } = await supabase
      .from('viagens').select('*')
      .eq('data_viagem', data)
      .order('hora', { ascending: true })

    const registros = viagens || []

    const cpfs = [...new Set(registros.map(v => v.paciente_cpf).filter(Boolean))]
    let mapaFone = {}
    if (cpfs.length > 0) {
      const { data: pacs } = await supabase
        .from('pacientes').select('cpf_cns, telefone').in('cpf_cns', cpfs)
      if (pacs) pacs.forEach(p => { mapaFone[p.cpf_cns] = p.telefone })
    }

    const comFone = registros.map(v => ({ ...v, telefone: mapaFone[v.paciente_cpf] || '' }))

    const ehPalmas = (d) => d && d.includes('PALMAS') && !d.includes('PORTO') && !d.includes('CARRO')
    const ehPorto  = (d) => d && d.includes('PORTO NACIONAL') && !d.includes('CARRO')

    setPalmas(comFone.filter(v => ehPalmas(v.destino)))
    setPorto(comFone.filter(v => ehPorto(v.destino)))
    setCarregando(false)
    setGerado(true)
  }

  function formatarData(d) {
    if (!d) return '-'
    const [ano, mes, dia] = d.split('-')
    return `${dia}/${mes}/${ano}`
  }

  function formatarCpf(v) {
    if (!v) return '-'
    const s = String(v).replace(/\D/g, '')
    if (s.length === 11) return s.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')
    if (s.length === 15) return s.replace(/^(\d{3})(\d{3})(\d{3})(\d{3})(\d{3})/, '$1.$2.$3.$4.$5')
    return v
  }

  function formatarTelefone(v) {
    if (!v) return '-'
    const s = String(v).replace(/\D/g, '')
    if (s.length === 11) return s.replace(/^(\d{2})(\d{5})(\d{4})/, '($1) $2-$3')
    if (s.length === 10) return s.replace(/^(\d{2})(\d{4})(\d{4})/, '($1) $2-$3')
    return v
  }

  function contarPessoas(lista) {
    return lista.reduce((acc, v) => {
      let q = 1
      if (v.acomp1_nome) q++
      if (v.acomp2_nome) q++
      return acc + q
    }, 0)
  }

  function construirResumoTFD(lista) {
    const resumo = [
      { num: 1, passagem: 'IDA E VOLTA C/ ACOMPANHANTE', pacientes: 0, acompanhantes: 0, total: 0 },
      { num: 2, passagem: 'IDA E VOLTA S/ ACOMPANHANTE', pacientes: 0, acompanhantes: 0, total: 0 },
      { num: 3, passagem: 'SÓ IDA COM ACOMPANHANTE',     pacientes: 0, acompanhantes: 0, total: 0 },
      { num: 4, passagem: 'SÓ IDA SEM ACOMPANHANTE',     pacientes: 0, acompanhantes: 0, total: 0 },
      { num: 5, passagem: 'SÓ VOLTA C/ ACOMPANHANTE',    pacientes: 0, acompanhantes: 0, total: 0 },
      { num: 6, passagem: 'SÓ VOLTA S/ ACOMPANHANTE',    pacientes: 0, acompanhantes: 0, total: 0 },
    ]
    lista.forEach(v => {
      const tipo = (v.tipo_viagem || '').toUpperCase().trim()
      const acompQtd = [v.acomp1_nome, v.acomp2_nome].filter(Boolean).length
      let linha = null
      let mult = 1
      if (tipo === 'IDA E VOLTA')  { mult = 2; linha = acompQtd > 0 ? resumo[0] : resumo[1] }
      else if (tipo === 'SÓ IDA')  { linha = acompQtd > 0 ? resumo[2] : resumo[3] }
      else if (tipo === 'SÓ VOLTA'){ linha = acompQtd > 0 ? resumo[4] : resumo[5] }
      if (linha) {
        linha.pacientes += 1
        linha.acompanhantes += acompQtd
        linha.total += (1 + acompQtd) * mult
      }
    })
    return resumo
  }

  function imprimirTFD() {
    const dataFmt = formatarData(data)
    const todos = [...porto, ...palmas]
    const resumo = construirResumoTFD(todos)

    const montarTabela = (titulo, lista) => {
      const linhas = lista.length === 0
        ? `<tr><td colspan="11" style="text-align:center;padding:10px;">Nenhum paciente para ${titulo}.</td></tr>`
        : lista.map((v, i) => {
            const acomps = [v.acomp1_nome, v.acomp2_nome].filter(Boolean).join(' / ') || ''
            return `<tr>
              <td style="text-align:center;">${i + 1}</td>
              <td style="text-align:left;font-weight:bold;">${v.paciente_nome || ''}</td>
              <td>${formatarCpf(v.paciente_cpf)}</td>
              <td>${acomps}</td>
              <td>${formatarTelefone(v.telefone)}</td>
              <td>${v.motivo || ''}</td>
              <td style="text-align:center;">${v.hora || ''}</td>
              <td>${v.local_destino || ''}</td>
              <td>${v.tipo_viagem || ''}</td>
              <td></td>
            </tr>`
          }).join('')

      return `
        <h2 style="text-align:center;font-size:13px;text-transform:uppercase;margin:10px 0 4px;">
          RELAÇÃO DOS PACIENTES COM TRATAMENTO FORA DE DOMICÍLIO - CONCEIÇÃO DO TOCANTINS
        </h2>
        <p style="font-size:12px;margin:2px 0;"><strong>DATA:</strong> ${dataFmt}</p>
        <p style="font-size:12px;margin:2px 0 6px;"><strong>NOME DA CIDADE DESTINO:</strong> ${titulo}</p>
        <table style="table-layout:fixed;width:100%;">
          <colgroup>
            <col style="width:3%"><col style="width:18%"><col style="width:14%">
            <col style="width:16%"><col style="width:10%"><col style="width:10%">
            <col style="width:6%"><col style="width:10%"><col style="width:8%">
            <col style="width:8%">
          </colgroup>
          <thead>
            <tr>
              <th>Nº</th><th>PACIENTE</th><th>CPF/CNS</th><th>ACOMPANHANTE</th>
              <th>TELEFONE</th><th>MOTIVO</th><th>HORÁRIO</th><th>LOCAL</th>
              <th>OBS</th><th>CONTROLE</th>
            </tr>
          </thead>
          <tbody>${linhas}</tbody>
        </table>
        <p style="font-size:12px;margin:6px 0 16px;">
          <strong>TOTAL ${titulo}:</strong> ${contarPessoas(lista)}
        </p>
        <hr style="border:1px solid #000;margin:10px 0;">
      `
    }

    const linhasResumo = resumo.map(r => {
      const total = r.pacientes + r.acompanhantes
      return `<tr>
        <td style="text-align:center;">${r.num}</td>
        <td style="text-align:left;">${r.passagem}</td>
        <td style="text-align:center;">${r.pacientes}</td>
        <td style="text-align:center;">${r.acompanhantes}</td>
        <td style="text-align:center;">${total}</td>
        <td style="text-align:center;background:#fff3e0;">${r.total}</td>
      </tr>`
    }).join('')

    const somaPac = resumo.reduce((a, r) => a + r.pacientes, 0)
    const somaAc  = resumo.reduce((a, r) => a + r.acompanhantes, 0)
    const somaP   = resumo.reduce((a, r) => a + r.pacientes + r.acompanhantes, 0)
    const somaT   = resumo.reduce((a, r) => a + r.total, 0)

    const conteudo = `
      ${montarTabela('PORTO NACIONAL', porto)}
      ${montarTabela('PALMAS', palmas)}
      <p style="font-size:12px;margin:4px 0 12px;">
        <strong>TOTAL DE PESSOAS NO TFD:</strong> ${contarPessoas(todos)}
      </p>
      <div style="text-align:center;font-weight:bold;text-transform:uppercase;margin:10px 0 6px;font-size:12px;">
        RESUMO TFD
      </div>
      <table style="table-layout:fixed;width:100%;">
        <colgroup>
          <col style="width:4%"><col style="width:35%"><col style="width:13%">
          <col style="width:14%"><col style="width:17%"><col style="width:17%">
        </colgroup>
        <thead>
          <tr>
            <th>Nº</th><th style="text-align:left;">PASSAGENS</th><th>PACIENTES</th>
            <th>ACOMPANHANTE</th><th>TOTAL (PESSOAS)</th><th>PASSAGENS DO DIA</th>
          </tr>
        </thead>
        <tbody>${linhasResumo}</tbody>
        <tfoot>
          <tr>
            <td colspan="2" style="text-align:right;"><strong>TOTAL</strong></td>
            <td style="text-align:center;"><strong>${somaPac}</strong></td>
            <td style="text-align:center;"><strong>${somaAc}</strong></td>
            <td style="text-align:center;"><strong>${somaP}</strong></td>
            <td style="text-align:center;background:#ffe0b2;"><strong>${somaT}</strong></td>
          </tr>
        </tfoot>
      </table>
    `

    abrirJanelaImpressao(`TFD - ${dataFmt}`, conteudo)
  }

  function TabelaTFD({ titulo, lista, cor }) {
    return (
      <div style={{ marginBottom: '28px' }}>
        <div style={{
          background: cor || 'linear-gradient(135deg, #450a0a, #7f1d1d)',
          color: 'white', padding: '10px 16px', borderRadius: '10px 10px 0 0',
          fontFamily: 'Sora, sans-serif', fontWeight: '600', fontSize: '14px',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center'
        }}>
          <span>📍 {titulo}</span>
          <span style={{ fontSize: '12px', opacity: 0.9 }}>{contarPessoas(lista)} pessoas</span>
        </div>

        {lista.length === 0 ? (
          <div style={{
            padding: '20px', textAlign: 'center', color: '#94a3b8',
            border: '1px solid #e2e8f0', borderRadius: '0 0 10px 10px',
            background: 'white', fontSize: '13px'
          }}>
            Nenhum paciente para {titulo}
          </div>
        ) : (
          <div style={{ border: '1px solid #e2e8f0', borderTop: 'none', borderRadius: '0 0 10px 10px', overflow: 'hidden' }}>
            <table className="table-modern" style={{ fontSize: '12px', tableLayout: 'fixed', width: '100%' }}>
              <colgroup>
                <col style={{ width: '40px' }} />
                <col style={{ width: '18%' }} />
                <col style={{ width: '14%' }} />
                <col style={{ width: '18%' }} />
                <col style={{ width: '12%' }} />
                <col style={{ width: '10%' }} />
                <col style={{ width: '6%' }} />
                <col style={{ width: '10%' }} />
                <col style={{ width: '9%' }} />
                <col style={{ width: '8%' }} />
              </colgroup>
              <thead>
                <tr>
                  <th>Nº</th>
                  <th>Paciente</th>
                  <th>CPF/CNS</th>
                  <th>Acompanhante</th>
                  <th>Telefone</th>
                  <th>Motivo</th>
                  <th>Hora</th>
                  <th>Local</th>
                  <th>Obs</th>
                  <th>Controle</th>
                </tr>
              </thead>
              <tbody>
                {lista.map((v, i) => {
                  const acomps = [v.acomp1_nome, v.acomp2_nome].filter(Boolean).join(' / ') || '-'
                  return (
                    <tr key={v.id} style={{ cursor: 'default' }}>
                      <td style={{ textAlign: 'center', color: '#94a3b8', fontWeight: '600' }}>{i + 1}</td>
                      <td style={{ fontWeight: '600', color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={v.paciente_nome}>{v.paciente_nome || '-'}</td>
                      <td style={{ color: '#64748b', fontSize: '11px' }}>{formatarCpf(v.paciente_cpf)}</td>
                      <td style={{ color: '#475569' }}>{acomps}</td>
                      <td style={{ color: '#64748b', whiteSpace: 'nowrap' }}>{formatarTelefone(v.telefone)}</td>
                      <td>{v.motivo || '-'}</td>
                      <td style={{ textAlign: 'center', fontWeight: '600', color: '#991b1b' }}>{v.hora || '-'}</td>
                      <td>{v.local_destino || '-'}</td>
                      <td style={{ color: '#64748b' }}>{v.tipo_viagem || '-'}</td>
                      <td></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    )
  }

  return (
    <Layout usuario={usuario}>
      <div style={{ padding: '28px' }}>

        {/* Header */}
        <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h1 style={{ fontFamily: 'Sora, sans-serif', fontSize: '22px', fontWeight: '700', color: '#0f172a', margin: '0 0 4px' }}>
              Relatório TFD
            </h1>
            <p style={{ color: '#000000', fontSize: '13px', margin: 0 }}>
              Tratamento Fora do Domicílio
            </p>
          </div>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <button type="button" onClick={() => router.push('/resumo')}
              style={{
                padding: '9px 18px', background: 'linear-gradient(135deg, #450a0a, #7f1d1d)',
                border: 'none', borderRadius: '10px', color: 'white',
                fontSize: '13px', cursor: 'pointer',
                fontFamily: 'Sora, sans-serif', fontWeight: '600',
                boxShadow: '0 4px 12px rgba(69,10,10,0.3)'
              }}>
              📈 Resumo Mensal
            </button>
            {gerado && (
              <button type="button" onClick={imprimirTFD}
                style={{
                  padding: '9px 18px', background: 'linear-gradient(135deg, #450a0a, #7f1d1d)',
                  border: 'none', borderRadius: '10px', color: 'white',
                  fontSize: '13px', cursor: 'pointer',
                  fontFamily: 'Sora, sans-serif', fontWeight: '600',
                  boxShadow: '0 4px 12px rgba(69,10,10,0.3)'
                }}>
                🖨️ Imprimir
              </button>
            )}
          </div>
        </div>

        {/* Controles */}
        <div className="card no-print" style={{ padding: '16px', marginBottom: '24px' }}>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <div>
              <label className="label-modern">Data</label>
              <input type="date" className="input-modern" value={data}
                onChange={e => setData(e.target.value)}
                style={{ width: '180px' }} />
            </div>
            <button type="button" onClick={gerar} disabled={carregando}
              className="btn-primary" style={{ background: 'linear-gradient(135deg, #450a0a, #7f1d1d)', padding: '10px 28px' }}>
              {carregando ? 'Buscando...' : '🔍 GERAR'}
            </button>
          </div>
        </div>

        {/* Conteúdo */}
        {gerado && (
          <>
            <TabelaTFD
              titulo="PORTO NACIONAL"
              lista={porto}
              cor="linear-gradient(135deg, #450a0a, #7f1d1d)" />

            <TabelaTFD
              titulo="PALMAS"
              lista={palmas}
              cor="linear-gradient(135deg, #450a0a, #7f1d1d)" />

            <div style={{
              background: 'linear-gradient(135deg, #450a0a, #7f1d1d)',
              color: 'white', padding: '12px 20px', borderRadius: '10px',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center'
            }}>
              <span style={{ fontFamily: 'Sora, sans-serif', fontWeight: '600', fontSize: '14px' }}>
                Total Geral
              </span>
              <span style={{ fontFamily: 'Sora, sans-serif', fontWeight: '700', fontSize: '18px', color: '#f0c030' }}>
                {contarPessoas([...porto, ...palmas])} pessoas
              </span>
            </div>
          </>
        )}

        {!gerado && !carregando && (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: '#94a3b8' }}>
            <div style={{ fontSize: '48px', marginBottom: '12px' }}>🚌</div>
            <p style={{ fontFamily: 'Sora, sans-serif', fontWeight: '600', fontSize: '16px', margin: '0 0 4px' }}>
              Selecione uma data e clique em GERAR
            </p>
            <p style={{ fontSize: '13px', margin: 0 }}>
              Os pacientes do TFD aparecerão aqui
            </p>
          </div>
        )}
      </div>
    </Layout>
  )
}