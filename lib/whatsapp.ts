import { getSupabaseServer } from './supabaseServer'

const supabase = getSupabaseServer()

const EVOLUTION_URL = process.env.EVOLUTION_API_URL!
const EVOLUTION_KEY = process.env.EVOLUTION_API_KEY!
const EVOLUTION_INSTANCE = process.env.EVOLUTION_INSTANCE!

// Normaliza e formata o telefone para o formato internacional do WhatsApp (ex: 5563991234567)
export function formatarNumeroWhatsapp(tel: string | null, defaultDDD: string = '63'): string | null {
  if (!tel) return null
  const clean = tel.replace(/\D/g, '')
  if (clean.length === 0) return null
  
  if (clean.startsWith('55') && (clean.length === 12 || clean.length === 13)) {
    return clean
  }
  
  if (clean.length === 10 || clean.length === 11) {
    return `55${clean}`
  }
  
  if (clean.length === 8 || clean.length === 9) {
    return `55${defaultDDD}${clean}`
  }
  
  return clean
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

