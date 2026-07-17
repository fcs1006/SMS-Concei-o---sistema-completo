import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseKey)

export function accentInsensitivePattern(search) {
  if (!search) return ''
  let pattern = String(search).toLowerCase().trim()
  
  // Escapa caracteres especiais de regex
  pattern = pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  
  const accentMap = {
    'a': '[aáàâãäåæ]',
    'e': '[eéèêë]',
    'i': '[iíìîï]',
    'o': '[oóòôõö]',
    'u': '[uúùûü]',
    'c': '[cç]',
    'á': '[aáàâãäåæ]',
    'à': '[aáàâãäåæ]',
    'â': '[aáàâãäåæ]',
    'ã': '[aáàâãäåæ]',
    'é': '[eéèêë]',
    'è': '[eéèêë]',
    'ê': '[eéèêë]',
    'í': '[iíìîï]',
    'ó': '[oóòôõö]',
    'ô': '[oóòôõö]',
    'õ': '[oóòôõö]',
    'ú': '[uúùûü]',
    'ç': '[cç]'
  }
  
  let regexStr = ''
  for (const char of pattern) {
    if (accentMap[char]) {
      regexStr += accentMap[char]
    } else {
      regexStr += char
    }
  }
  return regexStr
}