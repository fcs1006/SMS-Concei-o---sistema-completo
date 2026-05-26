-- ============================================================
-- Migração SQL - Tabela de Configurações Gerais (SaaS White-Label)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.configuracoes (
  id            BIGSERIAL PRIMARY KEY,
  chave         VARCHAR(50) UNIQUE NOT NULL, -- Ex: 'contatos_suporte', 'horario_atendimento', 'servicos_municipio', 'lista_ubs', 'lista_acs', 'tfd_destinos'
  valor         JSONB NOT NULL,              -- Estrutura flexível para cada tipo de configuração
  descricao     TEXT,
  atualizado_em TIMESTAMP WITH TIME ZONE DEFAULT (now() AT TIME ZONE 'America/Araguaina') NOT NULL
);

-- Habilitar RLS (Row Level Security)
ALTER TABLE public.configuracoes ENABLE ROW LEVEL SECURITY;

-- Políticas de acesso (Leitura pública/autenticada, escrita somente autenticada)
DROP POLICY IF EXISTS "Configuracoes - ler sempre" ON public.configuracoes;
CREATE POLICY "Configuracoes - ler sempre"
  ON public.configuracoes FOR SELECT
  TO authenticated, anon
  USING (true);

DROP POLICY IF EXISTS "Configuracoes - modificar autenticado" ON public.configuracoes;
CREATE POLICY "Configuracoes - modificar autenticado"
  ON public.configuracoes FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- ============================================================
-- VALORES PADRÃO (Semente de Fallback para Conceição do Tocantins)
-- ============================================================

INSERT INTO public.configuracoes (chave, valor, descricao) VALUES
('contatos_suporte', '{
  "urgencia": "(63) 99130-6916",
  "ubs_urbana": "(63) 99130-2450",
  "laboratorio": "(63) 99132-7974",
  "vigilancia": "(63) 99131-4490"
}', 'Contatos telefônicos de suporte para exibição e triagem do bot')
ON CONFLICT (chave) DO UPDATE SET valor = EXCLUDED.valor;

INSERT INTO public.configuracoes (chave, valor, descricao) VALUES
('horario_atendimento', '{
  "dias": [1, 2, 3, 4, 5],
  "mensagem_fechado": "Olá! 👋 Sou o {nome_assistente}, assistente virtual da SMS {nome_municipio}.\n\n⏰ No momento a secretaria está *fechada*.\n\n🕐 Horário de atendimento:\nSegunda a sexta: 7h–11h e 13h–17h\n\n🚨 Em caso de urgência ou emergência, entre em contato *imediatamente*:\n📞 {telefone_urgencia}",
  "periodos": [
    {"fim": "11:00", "inicio": "07:00"},
    {"fim": "17:00", "inicio": "13:00"}
  ]
}', 'Configuração de horários de funcionamento do bot e mensagem de fora de funcionamento')
ON CONFLICT (chave) DO UPDATE SET valor = EXCLUDED.valor;

INSERT INTO public.configuracoes (chave, valor, descricao) VALUES
('servicos_municipio', '{
  "tfd": true,
  "farmacia": true,
  "laboratorio": true,
  "vigilancia": true
}', 'Chaves para habilitar/desabilitar fluxos ou opções específicas do bot')
ON CONFLICT (chave) DO UPDATE SET valor = EXCLUDED.valor;

INSERT INTO public.configuracoes (chave, valor, descricao) VALUES
('lista_ubs', '[
  {
    "nome": "UBS Urbana",
    "descricao": "UBS Abilio Francisco de Azevedo (Postinho)",
    "telefone": "(63) 99130-2450",
    "servicos": ["Nutricionista", "Psicólogo", "Dentista (ACS urbano)", "Farmácia (retirada de medicamentos)", "Vacinas"]
  },
  {
    "nome": "UBS Rural",
    "descricao": "UBS Luiz Francisco de Miranda (Hospital)",
    "telefone": "(63) 99130-6916",
    "servicos": ["Eletrocardiograma (ECG)", "Dentista (ACS rural)", "Urgência e Emergência 24h", "Agendamento de viagens TFD"]
  }
]', 'Listagem de Unidades Básicas de Saúde locais para a IA orientar os cidadãos')
ON CONFLICT (chave) DO UPDATE SET valor = EXCLUDED.valor;

INSERT INTO public.configuracoes (chave, valor, descricao) VALUES
('lista_acs', '{
  "rural": ["02-Luzimaria", "05-Georgina", "06-Edilton", "07-Alaides", "08-Ramiro", "09-Greison", "10-Laurindo", "11-Kelisson", "12-Jurivan"],
  "urbana": ["01-Iva", "03-Maira", "04-Lindaura", "13-Dilma", "14-Delfino"]
}', 'Mapeamento de Agentes Comunitários de Saúde (ACS) por área')
ON CONFLICT (chave) DO UPDATE SET valor = EXCLUDED.valor;

INSERT INTO public.configuracoes (chave, valor, descricao) VALUES
('tfd_destinos', '[
  "CONCEIÇÃO/PALMAS",
  "CONCEIÇÃO/PALMAS - CARRO",
  "PALMAS/CONCEIÇÃO",
  "PALMAS/CONCEIÇÃO - CARRO",
  "CONCEIÇÃO/PORTO NACIONAL",
  "CONCEIÇÃO/PORTO NACIONAL - CARRO",
  "PORTO NACIONAL/CONCEIÇÃO",
  "PORTO NACIONAL/CONCEIÇÃO - CARRO",
  "CONCEIÇÃO/ARRAIAS",
  "ARRAIAS/CONCEIÇÃO",
  "CONCEIÇÃO/DIANÓPOLIS",
  "DIANÓPOLIS/CONCEIÇÃO",
  "CONCEIÇÃO/CAMPOS BELOS",
  "CONCEIÇÃO/GURUPI"
]', 'Lista de trajetos e rotas oficiais para viagens de TFD')
ON CONFLICT (chave) DO UPDATE SET valor = EXCLUDED.valor;
