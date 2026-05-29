import { getSupabaseServer } from './supabaseServer'

const supabase = getSupabaseServer()

const EVOLUTION_URL = process.env.EVOLUTION_API_URL!
const EVOLUTION_KEY = process.env.EVOLUTION_API_KEY!
const EVOLUTION_INSTANCE = process.env.EVOLUTION_INSTANCE!

// Normaliza e formata o telefone para o formato internacional do WhatsApp (ex: 5563991234567)
export function formatarNumeroWhatsapp(tel: string | null, defaultDDD: string = '63'): string | null {
  if (!tel) return null
  
  // Divide a string por delimitadores comuns de telefone (vírgula, ponto e vírgula, barra, barra vertical ou " e ")
  const parts = tel.split(/[,;\/|]|\s+e\s+/i)
  
  let fallbackNumber: string | null = null
  
  for (const part of parts) {
    const clean = part.replace(/\D/g, '')
    if (clean.length === 0) continue
    
    let isMobile = false
    let formatted: string | null = null
    
    if (clean.startsWith('55') && (clean.length === 12 || clean.length === 13)) {
      // 55 + DDD (2 dígitos) + número (8 ou 9 dígitos)
      const numWithoutCC = clean.substring(2)
      isMobile = numWithoutCC.length === 9 && numWithoutCC[0] === '9'
      formatted = clean
    } else if (clean.length === 11) {
      // DDD (2 dígitos) + número (9 dígitos)
      isMobile = clean[2] === '9'
      formatted = `55${clean}`
    } else if (clean.length === 10) {
      // DDD (2 dígitos) + número (8 dígitos - geralmente fixo)
      isMobile = false
      formatted = `55${clean}`
    } else if (clean.length === 9) {
      // Número sem DDD (9 dígitos)
      isMobile = clean[0] === '9'
      formatted = `55${defaultDDD}${clean}`
    } else if (clean.length === 8) {
      // Número sem DDD (8 dígitos)
      isMobile = false
      formatted = `55${defaultDDD}${clean}`
    }
    
    if (formatted) {
      if (isMobile) {
        // Se for número móvel, retorna imediatamente como melhor opção
        return formatted
      }
      if (!fallbackNumber) {
        fallbackNumber = formatted
      }
    }
  }
  
  // Retorna o fallback (primeiro número válido encontrado) se nenhum celular foi detectado
  return fallbackNumber
}

// Envia mensagem de texto via Evolution API e registra na conversa do WhatsApp do sistema
export async function enviarMensagemLembrete(numero: string, texto: string) {
  const isEvolutionConfigured = EVOLUTION_URL && EVOLUTION_KEY && EVOLUTION_INSTANCE

  if (isEvolutionConfigured) {
    const resp = await fetch(`${EVOLUTION_URL}/message/sendText/${EVOLUTION_INSTANCE}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': EVOLUTION_KEY },
      body: JSON.stringify({ number: numero, text: texto })
    })

    if (!resp.ok) {
      const err = await resp.text()
      throw new Error(`Evolution API HTTP ${resp.status}: ${err}`)
    }
  } else {
    console.warn(`[Evolution API MOCK] Lembrete enviado para ${numero}: ${texto}`)
  }

  // Grava no histórico do chat como mensagem do 'assistant' para visualização da secretaria
  const { error: chatErr } = await supabase.from('whatsapp_conversas').insert([{
    telefone: numero,
    papel: 'assistant',
    mensagem: `[LEMBRETE AUTOMÁTICO] ${texto}`
  }])
  if (chatErr) {
    console.error(`[Lembretes] Erro ao salvar histórico da conversa para ${numero}:`, chatErr.message)
  }
}

// Envia botões via Evolution API com fallback para texto
export async function enviarBotoesLembrete(
  numero: string, 
  title: string, 
  description: string, 
  buttons: Array<{ id: string, label: string }>,
  assistantName: string
) {
  const fallbackText = `*${title}*\n\n${description}\n\n` + buttons.map((b, idx) => `${idx + 1}️⃣ *${b.label}*`).join('\n')

  const isEvolutionConfigured = EVOLUTION_URL && EVOLUTION_KEY && EVOLUTION_INSTANCE

  if (isEvolutionConfigured) {
    try {
      const formattedButtons = buttons.map(b => ({
        type: 'reply',
        displayText: b.label,
        id: b.id
      }))

      const resp = await fetch(`${EVOLUTION_URL}/message/sendButtons/${EVOLUTION_INSTANCE}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'apikey': EVOLUTION_KEY },
        body: JSON.stringify({
          number: numero,
          title,
          description,
          footer: assistantName,
          buttons: formattedButtons
        })
      })

      if (!resp.ok) {
        const err = await resp.text()
        throw new Error(`Evolution API HTTP ${resp.status}: ${err}`)
      }
    } catch (err: any) {
      console.warn('[Evolution API sendButtons] Falhou no lembrete, enviando fallback em texto:', err.message)
      await enviarMensagemLembrete(numero, fallbackText)
      return
    }
  } else {
    console.warn(`[Evolution API MOCK sendButtons] para ${numero}: ${fallbackText}`)
  }

  // Grava no histórico do chat como mensagem do 'assistant' para visualização da secretaria
  const { error: chatErr } = await supabase.from('whatsapp_conversas').insert([{
    telefone: numero,
    papel: 'assistant',
    mensagem: `[LEMBRETE AUTOMÁTICO] ${fallbackText}`
  }])
  if (chatErr) {
    console.error(`[Lembretes] Erro ao salvar histórico da conversa para ${numero}:`, chatErr.message)
  }
}

// Helper para obter variações do CPF (com e sem máscara)
export function obterCpfVariacoes(cpf: string): string[] {
  const clean = cpf.replace(/\D/g, '')
  if (clean.length !== 11) return [cpf]
  const formatted = `${clean.substring(0, 3)}.${clean.substring(3, 6)}.${clean.substring(6, 9)}-${clean.substring(9)}`
  return [clean, formatted]
}

// Substitui variáveis do tipo {nome_da_variavel} no template de texto fornecido
export function substituirVariaveis(template: string, dados: Record<string, string | number | null | undefined>): string {
  if (!template) return ''
  let resultado = template
  Object.entries(dados).forEach(([chave, valor]) => {
    const reg = new RegExp(`\\{${chave}\\}`, 'gi')
    resultado = resultado.replace(reg, String(valor ?? ''))
  })
  return resultado
}

