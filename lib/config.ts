import { createClient } from '@supabase/supabase-js'

// Inicializa cliente local com service role se estiver rodando no servidor, ou anon no cliente
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabaseConfig = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false }
})

// Configurações do lado do cliente (White-Label estático baseado em .env)
export const clientConfig = {
  municipalityName: process.env.NEXT_PUBLIC_MUNICIPALITY_NAME || 'Conceição do Tocantins',
  municipalityUF: process.env.NEXT_PUBLIC_MUNICIPALITY_UF || 'TO',
  defaultDDD: process.env.NEXT_PUBLIC_MUNICIPALITY_DDD || '63',
  assistantName: process.env.NEXT_PUBLIC_ASSISTANT_NAME || 'Francisco',
  supportEmail: process.env.NEXT_PUBLIC_SUPPORT_EMAIL || 'suporte.sms@gmail.com',
  cnpj: process.env.NEXT_PUBLIC_MUNICIPALITY_CNPJ || '11.419.212/0001-24',
  address: process.env.NEXT_PUBLIC_MUNICIPALITY_ADDRESS || 'Avenida Sebastião de Brito, Centro, 181',
  cep: process.env.NEXT_PUBLIC_MUNICIPALITY_CEP || '77.305-000',
  phone: process.env.NEXT_PUBLIC_MUNICIPALITY_PHONE || '(63) 99132-5537',
  email: process.env.NEXT_PUBLIC_MUNICIPALITY_EMAIL || 'conceicaodotocantins170560@gmail.com',
  modoLembrete: process.env.NEXT_PUBLIC_MODO_LEMBRETE || 'automatico', // 'automatico' ou 'manual'
  template_esp_auto: '',
  template_sis_auto: '',
  template_esp_vesp: '',
  template_sis_vesp: '',
  template_tfd_vesp: '',
  template_esp_5d: '',
  template_esp_5d_confirmado: '',
  template_sis_5d: '',
  template_sis_5d_confirmado: '',
  theme: {
    primaryColor: process.env.NEXT_PUBLIC_THEME_PRIMARY || '#0ea5e9', // default sky-500
    secondaryColor: process.env.NEXT_PUBLIC_THEME_SECONDARY || '#0369a1', // default sky-700
  }
}

// Configurações dinâmicas carregadas do banco de dados (Secretaria específica)
export interface SupportContacts {
  urgencia: string
  ubs_urbana: string
  laboratorio: string
  vigilancia: string
}

export interface HorarioPeriodo {
  inicio: string
  fim: string
}

export interface HorarioAtendimento {
  dias: number[]
  mensagem_fechado: string
  periodos: HorarioPeriodo[]
}

export interface ServicosMunicipio {
  tfd: boolean
  farmacia: boolean
  laboratorio: boolean
  vigilancia: boolean
}

export interface UbsUnidade {
  nome: string
  descricao: string
  telefone: string
  servicos: string[]
}

export interface ListaAcs {
  rural: string[]
  urbana: string[]
}

export async function getDbConfig(chave: string): Promise<any | null> {
  try {
    const { data, error } = await supabaseConfig
      .from('configuracoes')
      .select('valor')
      .eq('chave', chave)
      .maybeSingle()

    if (error) {
      console.warn(`[Config] Erro ao carregar chave ${chave} do banco de dados:`, error.message)
      return null
    }

    return data?.valor || null
  } catch (e: any) {
    console.warn(`[Config] Falha ao consultar tabela configuracoes para chave ${chave}:`, e.message)
    return null
  }
}

export async function getDbConfigsMulti(chaves: string[]): Promise<Record<string, any>> {
  const result: Record<string, any> = {}
  try {
    const { data, error } = await supabaseConfig
      .from('configuracoes')
      .select('chave, valor')
      .in('chave', chaves)

    if (!error && data) {
      data.forEach(item => {
        result[item.chave] = item.valor
      })
    }
  } catch (e: any) {
    console.warn('[Config] Falha ao consultar chaves múltiplas no banco de dados:', e.message)
  }
  return result
}

export async function getActiveClientConfig(): Promise<typeof clientConfig> {
  const dbConfig = await getDbConfig('client_config')
  return {
    ...clientConfig,
    ...(dbConfig || {})
  }
}
