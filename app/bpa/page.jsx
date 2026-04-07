'use client'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Layout from '@/components/Layout'

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

  const corPerfil = perfil === 'laboratorio' ? '#065f46' : '#064e3b'
  const gradPerfil = perfil === 'laboratorio'
    ? 'linear-gradient(135deg, #065f46, #059669)'
    : 'linear-gradient(135deg, #064e3b, #047857)'

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
            style={{ padding: '9px 18px', background: 'linear-gradient(135deg, #475569, #64748b)', border: 'none', borderRadius: '10px', color: 'white', fontSize: '13px', cursor: 'pointer', fontFamily: 'Sora, sans-serif', fontWeight: '600' }}
            onClick={() => setMostrarConfig(v => !v)}>
            ⚙️ Configurar
          </button>
        </div>

        {msg.txt && (
          <div className={msg.ok ? 'status-ok' : 'status-err'} style={{ marginBottom: '16px' }}>
            {msg.txt}
          </div>
        )}

        {/* Config */}
        {mostrarConfig && (
          <div className="card" style={{ padding: '20px', marginBottom: '20px', border: '1px solid #d1fae5' }}>
            <h3 style={{ fontFamily: 'Sora, sans-serif', fontSize: '13px', fontWeight: '700', color: corPerfil, margin: '0 0 16px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              ⚙️ Configuração do Profissional — {perfil === 'laboratorio' ? 'Laboratório' : 'Urgência'}
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
            📋 Parâmetros
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
                📥 Importar arquivo do laboratório
              </p>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                <label style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', cursor: 'pointer', background: 'white', border: '1.5px solid #34d399', borderRadius: '8px', padding: '9px 16px', fontSize: '13px', fontWeight: '600', color: '#065f46' }}>
                  📂 Escolher arquivo (.xls / .xlsx / .tsv)
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
              {etapa === 'consolidando' ? '⏳ Consolidando...' : '🔄 Consolidar'}
            </button>
            <button className="btn-primary" style={{ background: gradPerfil }}
              onClick={gerarTxt} disabled={!consolidados.length || etapa === 'gerando' || etapa === 'consolidando'}>
              {etapa === 'gerando' ? '⏳ Gerando...' : '⬇️ Gerar TXT'}
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
                ✅ {consolidados.length} registros consolidados — {labelCompetencia()}
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
                ⚠️ {erros.length} registro(s) com erro
              </h3>
              <button 
                onClick={() => window.print()}
                style={{ padding: '6px 12px', background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: '6px', color: '#991b1b', fontSize: '11px', cursor: 'pointer', fontWeight: '600', fontFamily: 'Sora, sans-serif' }}>
                🖨️ Imprimir Erros
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
            .print-title { display: block !important; }
          }
        `}} />
      </div>
    </Layout>
  )
}
