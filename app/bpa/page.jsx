'use client'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Layout from '@/components/Layout'
import { Settings, BarChart2, Upload, ClipboardList, RefreshCw, Download, Search, Printer, CheckCircle, AlertTriangle } from 'lucide-react'

const FIXOS_PADRAO = {
  urgencia: {
    CNES_UNIDADE: '5193273',
    CNS_PROFISSIONAL: '707400015196273',
    CBO: '225142',
    PROCEDIMENTO: '0803010125',
    IBGE: '170560',
    ORIGEM: 'BPA',
    RACA: '03',
    NACIONALIDADE: '010',
    CEP_PADRAO: '77305000'
  },
  laboratorio: {
    CNES_UNIDADE: '5193273',
    CNS_PROFISSIONAL: '707400015196273',
    CBO: '225142',
    PROCEDIMENTO: '0202010339',
    IBGE: '170560',
    ORIGEM: 'BPA',
    RACA: '03',
    NACIONALIDADE: '010',
    CEP_PADRAO: '77305000'
  }
}

const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']

export default function BPA() {
  const router = useRouter()
  const [usuario, setUsuario] = useState(null)
  const [perfil, setPerfil] = useState('urgencia')
  const [mes, setMes] = useState(() => String(new Date().getMonth() + 1).padStart(2, '0'))
  const [ano, setAno] = useState(() => String(new Date().getFullYear()))
  const [config, setConfig] = useState({ urgencia: { ...FIXOS_PADRAO.urgencia }, laboratorio: { ...FIXOS_PADRAO.laboratorio } })
  const [mostrarConfig, setMostrarConfig] = useState(false)
  const [consolidados, setConsolidados] = useState([])
  const [erros, setErros] = useState([])
  const [etapa, setEtapa] = useState('idle') // idle | consolidando | consolidado | gerando | pronto
  const [msg, setMsg] = useState({ txt: '', ok: true })
  const [linhasLab, setLinhasLab] = useState([])
  const [nomeArquivoLab, setNomeArquivoLab] = useState('')
  const fileRef = useRef(null)

  // Estados Histórico
  const [aba, setAba] = useState('importacao') // importacao | historico
  const [historicoDados, setHistoricoDados] = useState([])
  const [historicoLoading, setHistoricoLoading] = useState(false)
  const [pesquisaHist, setPesquisaHist] = useState('')
  const [compHist, setCompHist] = useState('')

  useEffect(() => {
    const u = localStorage.getItem('sms_user')
    if (!u) { router.push('/'); return }
    setUsuario(JSON.parse(u))
    // Carregar config salva
    const cfgSalva = localStorage.getItem('bpa_config')
    if (cfgSalva) {
      try { setConfig(JSON.parse(cfgSalva)) } catch { }
    }
  }, [])

  function mostrarMsg(txt, ok = true) {
    setMsg({ txt, ok })
    setTimeout(() => setMsg({ txt: '', ok: true }), 5000)
  }

  function salvarConfig() {
    localStorage.setItem('bpa_config', JSON.stringify(config))
    mostrarMsg('✅ Configuração salva com sucesso')
    setMostrarConfig(false)
  }

  function competencia() {
    return ano + mes
  }

  function labelCompetencia() {
    return `${MESES[Number(mes) - 1]}/${ano}`
  }

  // Leitura do XLS via FileReader + parse manual (CSV/TSV simples)
  function lerArquivoLab(e) {
    const file = e.target.files[0]
    if (!file) return
    setNomeArquivoLab(file.name)
    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const texto = ev.target.result
        const primeiraLinha = texto.split('\n')[0] || ''
        const separador = primeiraLinha.includes(';') ? ';' : (primeiraLinha.includes('\t') ? '\t' : ',')
        const linhas = texto.split('\n').map(l => l.split(separador).map(c => c.trim().replace(/^"|"$/g, '')))
        const cabecalho = linhas[0].map(c => c.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ''))
        const idxNome = cabecalho.findIndex(c => c.includes('nome') && c.includes('cliente') || c === 'nome' || c.includes('paciente'))
        const idxNasc = cabecalho.findIndex(c => c.includes('nasc') || c.includes('nascimento'))
        const idxCpf = cabecalho.findIndex(c => c === 'cpf' || c.includes('cpfcliente') || c.includes('documento'))
        const idxExame = cabecalho.findIndex(c => c.includes('exame') || (c.includes('codigo') && !c.includes('procedencia')) || c.includes('procedimento'))
        const idxData = cabecalho.findIndex(c => c.includes('inclusao') || c.includes('dataatend') || (c.includes('data') && !c.includes('nasc')))
        const idxSexo = cabecalho.findIndex(c => c === 'sexo' || c.includes('genero'))
        const idxEndereco = cabecalho.findIndex(c => c.includes('endereco') || c.includes('logradouro'))
        const idxBairro = cabecalho.findIndex(c => c === 'bairro')
        const idxCep = cabecalho.findIndex(c => c === 'cep')
        const idxTel = cabecalho.findIndex(c => c.includes('tel') || c.includes('fone') || c.includes('celular'))

        const dados = linhas.slice(1).filter(l => l.length > 1 && l[idxNome] && l[idxNome] !== '')
          .map(l => ({
            nome: idxNome >= 0 ? l[idxNome] : '',
            dtNasc: idxNasc >= 0 ? l[idxNasc] : '',
            cpf: idxCpf >= 0 ? l[idxCpf] : '',
            procedimento: idxExame >= 0 ? l[idxExame] : '',
            dataAtendimento: idxData >= 0 ? l[idxData] : '',
            sexo: idxSexo >= 0 ? l[idxSexo] : '',
            endereco: idxEndereco >= 0 ? l[idxEndereco] : '',
            bairro: idxBairro >= 0 ? l[idxBairro] : '',
            cep: idxCep >= 0 ? l[idxCep] : '',
            telefone: idxTel >= 0 ? l[idxTel] : '',
          }))

        setLinhasLab(dados)
        mostrarMsg(`✅ ${dados.length} registros lidos de "${file.name}"`)
      } catch {
        mostrarMsg('❌ Erro ao ler o arquivo. Use formato TSV/CSV com tabulação.', false)
      }
    }
    reader.readAsText(file, 'utf-8')
    e.target.value = ''
  }

  async function consolidar() {
    const comp = competencia()
    if (!/^\d{6}$/.test(comp)) { mostrarMsg('Competência inválida', false); return }
    if (perfil === 'laboratorio' && !linhasLab.length) {
      mostrarMsg('Importe o arquivo do laboratório antes de consolidar', false); return
    }

    setEtapa('consolidando')
    setConsolidados([])
    setErros([])

    try {
      const resp = await fetch('/api/bpa/consolidar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          perfil,
          competencia: comp,
          fixos: config[perfil],
          linhasLab: perfil === 'laboratorio' ? linhasLab : []
        })
      })
      const json = await resp.json()
      if (!resp.ok || !json.ok) throw new Error(json.error || 'Erro ao consolidar')
      setConsolidados(json.consolidados || [])
      setErros(json.erros || [])
      setEtapa('consolidado')
      mostrarMsg(`✅ ${json.consolidados?.length || 0} registros consolidados${json.erros?.length ? ` | ⚠️ ${json.erros.length} erros` : ''}`)
    } catch (err) {
      mostrarMsg('❌ ' + err.message, false)
      setEtapa('idle')
    }
  }

  async function gerarTxt() {
    if (!consolidados.length) { mostrarMsg('Consolide os dados primeiro', false); return }
    setEtapa('gerando')
    try {
      const resp = await fetch('/api/bpa/gerar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          competencia: competencia(),
          consolidados,
          prefixoArquivo: perfil === 'laboratorio' ? 'BPA_LABORATORIO' : 'BPA'
        })
      })
      const json = await resp.json()
      if (!resp.ok || !json.ok) throw new Error(json.error || 'Erro ao gerar TXT')

      // Download
      const bytes = Uint8Array.from(atob(json.conteudo), c => c.charCodeAt(0))
      const blob = new Blob([bytes], { type: 'text/plain;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = json.nomeArquivo
      a.click()
      URL.revokeObjectURL(url)

      setEtapa('pronto')
      mostrarMsg(`✅ Arquivo "${json.nomeArquivo}" gerado e baixado`)
    } catch (err) {
      mostrarMsg('❌ ' + err.message, false)
      setEtapa('consolidado')
    }
  }

  async function buscarHistorico() {
    setHistoricoLoading(true)
    setHistoricoDados([])
    try {
      const p = new URLSearchParams()
      p.append('perfil', perfil)
      if (compHist) p.append('competencia', compHist)
      if (pesquisaHist) p.append('pesquisa', pesquisaHist)
      
      const res = await fetch('/api/bpa/historico?' + p.toString())
      const json = await res.json()
      if (json.ok) {
        setHistoricoDados(json.data || [])
      } else {
        mostrarMsg('Erro: ' + json.error, false)
      }
    } catch (e) {
      mostrarMsg('Erro ao buscar histórico', false)
    }
    setHistoricoLoading(false)
  }

  useEffect(() => {
    if (aba === 'historico') buscarHistorico()
  }, [aba])

  function imprimirHistorico() {
    const titulo = `Relatório BPA-Histórico: ${perfil}${compHist ? ' — ' + compHist : ''}`
    const linhas = historicoDados.map((r, i) => `
      <tr style="background:${i % 2 === 0 ? '#fff' : '#f8fafc'}">
        <td>${r.data_atendimento ? r.data_atendimento.split('-').reverse().join('/') : '-'}</td>
        <td>${r.competencia || '-'}</td>
        <td style="font-family:monospace">${r.procedimento || '-'}</td>
        <td style="font-weight:600">${r.nome_paciente || '-'}</td>
        <td>${r.cpf_cns || '-'}</td>
      </tr>`).join('')
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
      <title>${titulo}</title>
      <style>
        body { font-family: Arial, sans-serif; font-size: 11px; margin: 12mm; color: #000; }
        h2 { font-size: 14px; margin: 0 0 12px; }
        p { margin: 0 0 10px; font-size: 11px; color: #444; }
        table { width: 100%; border-collapse: collapse; }
        th { background: #1e293b; color: #fff; padding: 7px 8px; text-align: left; font-size: 10px; letter-spacing: 0.05em; }
        td { padding: 6px 8px; border-bottom: 1px solid #e2e8f0; }
      </style>
    </head><body>
      <h2>${titulo}</h2>
      <p>Total de registros: ${historicoDados.length}</p>
      <table>
        <thead><tr>
          <th>Atendimento</th><th>Competência</th><th>Procedimento</th><th>Paciente</th><th>CPF/CNS</th>
        </tr></thead>
        <tbody>${linhas}</tbody>
      </table>
    </body></html>`
    const w = window.open('', '_blank')
    w.document.write(html)
    w.document.close()
    w.focus()
    setTimeout(() => { w.print(); w.close() }, 400)
  }

  const corPerfil = '#059669'
  const gradPerfil = 'linear-gradient(135deg, #059669, #34d399)'

  return (
    <Layout usuario={usuario}>
      <div style={{ padding: '28px', maxWidth: '900px', margin: '0 auto' }}>

        {/* Header */}
        <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h1 style={{ fontFamily: 'Sora, sans-serif', fontSize: '22px', fontWeight: '700', color: '#0f172a', margin: '0 0 4px' }}>
              BPA — Boletim de Produção Ambulatorial
            </h1>
            <p style={{ color: '#000000', fontSize: '13px', margin: 0 }}>
              Consolidação e geração do arquivo TXT para o DATASUS
            </p>
          </div>
          <button
            onClick={() => setMostrarConfig(v => !v)}
            style={{ padding: '9px 18px', background: 'linear-gradient(135deg, #475569, #64748b)', border: 'none', borderRadius: '10px', color: 'white', fontSize: '13px', cursor: 'pointer', fontFamily: 'Sora, sans-serif', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Settings size={14} /> Configurar
          </button>
        </div>

        {/* Abas */}
        <div style={{ display: 'flex', gap: '20px', marginBottom: '24px', borderBottom: '2px solid #e2e8f0', paddingBottom: '8px' }}>
          <button 
            style={{ background: 'none', border: 'none', fontSize: '15px', fontWeight: '700', cursor: 'pointer', color: aba === 'importacao' ? corPerfil : '#64748b', borderBottom: aba === 'importacao' ? `3px solid ${corPerfil}` : 'none', paddingBottom: '10px', marginBottom: '-10px', fontFamily: 'Sora, sans-serif' }}
            onClick={() => setAba('importacao')}
          >
            <Upload size={14} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '6px' }} />Nova Importação
          </button>
          <button
            style={{ background: 'none', border: 'none', fontSize: '15px', fontWeight: '700', cursor: 'pointer', color: aba === 'historico' ? corPerfil : '#64748b', borderBottom: aba === 'historico' ? `3px solid ${corPerfil}` : 'none', paddingBottom: '10px', marginBottom: '-10px', fontFamily: 'Sora, sans-serif', display: 'flex', alignItems: 'center', gap: '6px' }}
            onClick={() => setAba('historico')}
          >
            <BarChart2 size={14} /> Relatório Histórico
          </button>
        </div>

        {msg.txt && (
          <div className={msg.ok ? 'status-ok' : 'status-err'} style={{ marginBottom: '16px' }}>
            {msg.txt}
          </div>
        )}

        {aba === 'importacao' && (
          <>
        {/* Config */}
        {mostrarConfig && (
          <div className="card" style={{ padding: '20px', marginBottom: '20px', border: '1px solid #d1fae5' }}>
            <h3 style={{ fontFamily: 'Sora, sans-serif', fontSize: '13px', fontWeight: '700', color: corPerfil, margin: '0 0 16px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              <Settings size={13} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '6px' }} />Configuração do Profissional — {perfil === 'laboratorio' ? 'Laboratório' : 'Urgência'}
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', marginBottom: '16px' }}>
              {[
                { key: 'CNES_UNIDADE', label: 'CNES', max: 7 },
                { key: 'CNS_PROFISSIONAL', label: 'CNS Profissional', max: 15 },
                { key: 'CBO', label: 'CBO', max: 6 },
                { key: 'IBGE', label: 'Código IBGE', max: 7 },
                { key: 'CEP_PADRAO', label: 'CEP Padrão', max: 8 },
              ].map(({ key, label, max }) => (
                <div key={key}>
                  <label className="label-modern">{label}</label>
                  <input className="input-modern" type="text" inputMode="numeric" maxLength={max}
                    value={config[perfil][key]}
                    onChange={e => setConfig(c => ({ ...c, [perfil]: { ...c[perfil], [key]: e.target.value.replace(/\D/g, '') } }))} />
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button className="btn-primary" style={{ background: gradPerfil }} onClick={salvarConfig}>Salvar</button>
              <button className="btn-secondary" onClick={() => setMostrarConfig(false)}>Cancelar</button>
            </div>
          </div>
        )}

        {/* Controles */}
        <div className="card" style={{ padding: '20px', marginBottom: '20px' }}>
          <h3 style={{ fontFamily: 'Sora, sans-serif', fontSize: '13px', fontWeight: '700', color: corPerfil, margin: '0 0 16px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            <ClipboardList size={13} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '6px' }} />Parâmetros
          </h3>
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div>
              <label className="label-modern">Setor</label>
              <select className="input-modern" value={perfil} onChange={e => { setPerfil(e.target.value); setConsolidados([]); setErros([]); setEtapa('idle') }} style={{ width: '180px' }}>
                <option value="urgencia">Viagens (TFD)</option>
                <option value="laboratorio">Laboratório</option>
              </select>
            </div>
            <div>
              <label className="label-modern">Mês</label>
              <select className="input-modern" value={mes} onChange={e => { setMes(e.target.value); setConsolidados([]); setErros([]); setEtapa('idle') }} style={{ width: '160px' }}>
                {MESES.map((n, i) => (
                  <option key={i} value={String(i + 1).padStart(2, '0')}>{String(i + 1).padStart(2, '0')} — {n}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label-modern">Ano</label>
              <input className="input-modern" type="number" value={ano} onChange={e => { setAno(e.target.value); setConsolidados([]); setErros([]); setEtapa('idle') }} min="2020" max="2099" style={{ width: '100px' }} />
            </div>
          </div>

          {/* Import XLS - só laboratório */}
          {perfil === 'laboratorio' && (
            <div style={{ marginTop: '16px', padding: '16px', background: '#f0fdf4', border: '1.5px dashed #34d399', borderRadius: '10px' }}>
              <p style={{ fontFamily: 'Sora, sans-serif', fontWeight: '600', fontSize: '13px', color: '#065f46', margin: '0 0 10px' }}>
                <Upload size={13} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '6px' }} />Importar arquivo do laboratório
              </p>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                <label style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', cursor: 'pointer', background: 'white', border: '1.5px solid #34d399', borderRadius: '8px', padding: '9px 16px', fontSize: '13px', fontWeight: '600', color: '#065f46' }}>
                  <Upload size={13} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '6px' }} />Escolher arquivo (.xls / .xlsx / .tsv)
                  <input ref={fileRef} type="file" accept=".xls,.xlsx,.tsv,.csv,.txt" style={{ display: 'none' }} onChange={lerArquivoLab} />
                </label>
                {nomeArquivoLab && (
                  <span style={{ fontSize: '12px', color: '#064e3b', fontWeight: '600' }}>
                    ✅ {nomeArquivoLab} — {linhasLab.length} registros
                  </span>
                )}
              </div>
              {linhasLab.length > 0 && (
                <div style={{ marginTop: '12px', maxHeight: '160px', overflowY: 'auto', border: '1px solid #bbf7d0', borderRadius: '8px', background: 'white' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
                    <thead>
                      <tr style={{ background: '#dcfce7' }}>
                        {['Nome', 'Dt Nasc', 'CPF', 'Procedimento', 'Dt Atend'].map(h => (
                          <th key={h} style={{ padding: '5px 8px', textAlign: 'left', fontFamily: 'Sora, sans-serif', fontSize: '10px', color: '#065f46' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {linhasLab.slice(0, 10).map((l, i) => (
                        <tr key={i} style={{ borderBottom: '1px solid #f0fdf4' }}>
                          <td style={{ padding: '4px 8px' }}>{l.nome}</td>
                          <td style={{ padding: '4px 8px' }}>{l.dtNasc}</td>
                          <td style={{ padding: '4px 8px' }}>{l.cpf}</td>
                          <td style={{ padding: '4px 8px' }}>{l.procedimento}</td>
                          <td style={{ padding: '4px 8px' }}>{l.dataAtendimento}</td>
                        </tr>
                      ))}
                      {linhasLab.length > 10 && (
                        <tr><td colSpan={5} style={{ padding: '4px 8px', color: '#94a3b8', fontSize: '11px' }}>... e mais {linhasLab.length - 10} registros</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Botões de ação */}
          <div style={{ display: 'flex', gap: '10px', marginTop: '16px', flexWrap: 'wrap' }}>
            <button className="btn-primary" style={{ background: gradPerfil }}
              onClick={consolidar} disabled={etapa === 'consolidando' || etapa === 'gerando'}>
              {etapa === 'consolidando' ? 'Consolidando...' : <><RefreshCw size={14} /> Consolidar</>}
            </button>
            <button className="btn-primary" style={{ background: gradPerfil }}
              onClick={gerarTxt} disabled={!consolidados.length || etapa === 'gerando' || etapa === 'consolidando'}>
              {etapa === 'gerando' ? 'Gerando...' : <><Download size={14} /> Gerar TXT</>}
            </button>
            {(consolidados.length > 0 || erros.length > 0) && (
              <button className="btn-secondary" onClick={() => { setConsolidados([]); setErros([]); setEtapa('idle') }}>
                Limpar
              </button>
            )}
          </div>
        </div>

        {/* Resultado */}
        {consolidados.length > 0 && (
          <div className="card" style={{ padding: '20px', marginBottom: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <h3 style={{ fontFamily: 'Sora, sans-serif', fontSize: '13px', fontWeight: '700', color: corPerfil, margin: 0, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                <CheckCircle size={14} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '6px' }} />{consolidados.length} registros consolidados — {labelCompetencia()}
              </h3>
            </div>
            <div style={{ maxHeight: '300px', overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                <thead>
                  <tr style={{ background: gradPerfil }}>
                    {['#', 'Nome', 'CPF/CNS', 'Dt Atend', 'Dt Nasc', 'Sexo', 'Idade', 'Procedimento'].map(h => (
                      <th key={h} style={{ padding: '8px', color: 'white', textAlign: 'left', fontFamily: 'Sora, sans-serif', fontSize: '10px', fontWeight: '600', letterSpacing: '0.06em' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {consolidados.map((r, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '7px 8px', color: '#94a3b8' }}>{i + 1}</td>
                      <td style={{ padding: '7px 8px', fontWeight: '600', color: '#0f172a' }}>{r.nomePaciente}</td>
                      <td style={{ padding: '7px 8px', fontSize: '11px', color: '#64748b' }}>{r.cpf || r.cnsPaciente}</td>
                      <td style={{ padding: '7px 8px', whiteSpace: 'nowrap' }}>{r.dataAtendimento}</td>
                      <td style={{ padding: '7px 8px', whiteSpace: 'nowrap' }}>{r.dtNascimento}</td>
                      <td style={{ padding: '7px 8px' }}>{r.sexo}</td>
                      <td style={{ padding: '7px 8px', textAlign: 'center' }}>{parseInt(r.idade)}</td>
                      <td style={{ padding: '7px 8px', fontFamily: 'monospace', fontSize: '11px' }}>{r.procedimento}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Erros */}
        {erros.length > 0 && (
          <div className="card print-area" style={{ padding: '20px', border: '1px solid #fecaca' }}>
            <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <h3 style={{ fontFamily: 'Sora, sans-serif', fontSize: '13px', fontWeight: '700', color: '#991b1b', margin: 0, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                <AlertTriangle size={14} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '6px' }} />{erros.length} registro(s) com erro
              </h3>
              <button 
                onClick={() => window.print()}
                style={{ padding: '6px 12px', background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: '6px', color: '#991b1b', fontSize: '11px', cursor: 'pointer', fontWeight: '600', fontFamily: 'Sora, sans-serif' }}>
                <Printer size={13} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '4px' }} />Imprimir Erros
              </button>
            </div>
            
            <h3 style={{ display: 'none', color: '#000', fontSize: '16px', marginBottom: '15px', fontFamily: 'Sora, sans-serif' }} className="print-title">
               Relatório de Cuidados Cadastrais - BPA ({labelCompetencia()})
            </h3>

            <div className="print-container" style={{ maxHeight: '220px', overflowY: 'auto', border: '1px solid #fee2e2', borderRadius: '8px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                <thead>
                  <tr style={{ background: 'linear-gradient(135deg, #991b1b, #ef4444)', WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}>
                    {['Nome', 'Data', 'Motivo do Erro', 'Valor encontrado'].map(h => (
                      <th key={h} style={{ padding: '8px', color: 'white', textAlign: 'left', fontFamily: 'Sora, sans-serif', fontSize: '10px', fontWeight: '600', letterSpacing: '0.06em' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {erros.map((e, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid #fee2e2', background: i % 2 === 0 ? '#fff' : '#fff5f5', WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}>
                      <td style={{ padding: '7px 8px', fontWeight: '600', color: '#0f172a' }}>{e.nome}</td>
                      <td style={{ padding: '7px 8px', whiteSpace: 'nowrap', color: '#64748b' }}>{e.data}</td>
                      <td style={{ padding: '7px 8px', color: '#991b1b', fontWeight: '500' }}>{e.motivo}</td>
                      <td style={{ padding: '7px 8px', color: '#475569', fontFamily: 'monospace', fontSize: '11px' }}>{e.valor}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
        
        <style dangerouslySetInnerHTML={{__html: `
          @media print {
            body * { visibility: hidden; }
            .print-area, .print-area * { visibility: visible; }
            .print-area { position: absolute; left: 0; top: 0; width: 100%; border: none !important; box-shadow: none !important; padding: 0 !important; }
            .print-container { max-height: none !important; overflow: visible !important; border: none !important; }
            .no-print { display: none !important; }
            .print-title { display: block !important; margin-bottom: 20px !important; }
          }
        `}} />
        </>
        )}

        {aba === 'historico' && (
          <div className="card" style={{ padding: '20px' }}>
            <h3 style={{ fontFamily: 'Sora, sans-serif', fontSize: '15px', fontWeight: '700', color: corPerfil, margin: '0 0 16px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Base de Registros Processados ({perfil})
            </h3>
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: '20px' }}>
              <div>
                <label className="label-modern">Período/Competência</label>
                <input className="input-modern" type="text" placeholder="Ex: 202603 ou vazio" value={compHist} onChange={e => setCompHist(e.target.value)} style={{ width: '160px' }} />
              </div>
              <div style={{ flex: 1, minWidth: '200px' }}>
                <label className="label-modern">Pesquisar Paciente, CPF ou Procedimento</label>
                <input className="input-modern" type="text" placeholder="Digite para filtrar..." value={pesquisaHist} onChange={e => setPesquisaHist(e.target.value)} style={{ width: '100%' }} onKeyDown={e => e.key === 'Enter' && buscarHistorico()} />
              </div>
              <div>
                <button className="btn-primary" style={{ background: gradPerfil }} onClick={buscarHistorico}>
                  <Search size={14} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '4px' }} />Buscar
                </button>
              </div>
            </div>

            {historicoLoading ? (
              <p style={{ color: '#64748b', fontSize: '13px' }}>Carregando registros...</p>
            ) : historicoDados.length === 0 ? (
              <p style={{ color: '#64748b', fontSize: '13px' }}>Nenhum registro encontrado para estes filtros.</p>
            ) : (
              <div className="print-area">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  <span style={{ fontSize: '13px', fontWeight: '600', color: '#0f172a' }}>
                    Encontrados: {historicoDados.length}
                  </span>
                  <button onClick={imprimirHistorico} style={{ padding: '6px 14px', background: 'linear-gradient(135deg, #059669, #34d399)', border: 'none', borderRadius: '8px', color: 'white', fontSize: '12px', cursor: 'pointer', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <Printer size={13} /> Imprimir
                  </button>
                </div>
                
                <div style={{ maxHeight: '400px', overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                    <thead>
                      <tr style={{ background: '#f8fafc' }}>
                        <th style={{ padding: '8px', color: '#475569', textAlign: 'left', fontWeight: '600' }}>Atendimento</th>
                        <th style={{ padding: '8px', color: '#475569', textAlign: 'left', fontWeight: '600' }}>Competência</th>
                        <th style={{ padding: '8px', color: '#475569', textAlign: 'left', fontWeight: '600' }}>Procedimento</th>
                        <th style={{ padding: '8px', color: '#475569', textAlign: 'left', fontWeight: '600' }}>Paciente</th>
                        <th style={{ padding: '8px', color: '#475569', textAlign: 'left', fontWeight: '600' }}>CPF/CNS</th>
                      </tr>
                    </thead>
                    <tbody>
                      {historicoDados.map((r) => (
                        <tr key={r.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '8px', whiteSpace: 'nowrap', color: '#64748b' }}>
                            {r.data_atendimento ? r.data_atendimento.split('-').reverse().join('/') : '-'}
                          </td>
                          <td style={{ padding: '8px', color: '#64748b', fontWeight: '600' }}>{r.competencia}</td>
                          <td style={{ padding: '8px', fontFamily: 'monospace' }}>{r.procedimento}</td>
                          <td style={{ padding: '8px', fontWeight: '500', color: '#0f172a' }}>{r.nome_paciente}</td>
                          <td style={{ padding: '8px', color: '#64748b' }}>{r.cpf_cns}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

      </div>
    </Layout>
  )
}
