-- ============================================================
-- Migração SQL - Tabela de Lembretes Pendentes de Disparo Manual
-- ============================================================

CREATE TABLE IF NOT EXISTS public.lembretes_pendentes (
  id            BIGSERIAL PRIMARY KEY,
  tipo          VARCHAR(50) NOT NULL, -- 'esp_vesp' | 'sis_vesp' | 'tfd_vesp' | 'esp_auto' | 'sis_auto' | 'esp_5d' | 'sis_5d'
  referencia_id VARCHAR(100) NOT NULL,
  data_evento   DATE NOT NULL,
  paciente_nome VARCHAR(255) NOT NULL,
  telefone      VARCHAR(20) NOT NULL,
  mensagem      TEXT NOT NULL,
  botoes        JSONB, -- Botões interativos do WhatsApp (opcional)
  canal         VARCHAR(20) DEFAULT 'whatsapp' NOT NULL, -- 'whatsapp' | 'sms' etc
  criado_em     TIMESTAMP WITH TIME ZONE DEFAULT (now() AT TIME ZONE 'America/Araguaina') NOT NULL
);

-- Impedir duplicidades do mesmo lembrete no mesmo dia/evento
CREATE UNIQUE INDEX IF NOT EXISTS idx_lembretes_pendentes_unico 
  ON public.lembretes_pendentes (tipo, referencia_id, data_evento);

-- Habilitar Row Level Security (RLS)
ALTER TABLE public.lembretes_pendentes ENABLE ROW LEVEL SECURITY;

-- Políticas de acesso livre para leitura e modificação
DROP POLICY IF EXISTS "Lembretes pendentes - ler sempre" ON public.lembretes_pendentes;
CREATE POLICY "Lembretes pendentes - ler sempre"
  ON public.lembretes_pendentes FOR SELECT
  TO authenticated, anon
  USING (true);

DROP POLICY IF EXISTS "Lembretes pendentes - tudo" ON public.lembretes_pendentes;
CREATE POLICY "Lembretes pendentes - tudo"
  ON public.lembretes_pendentes FOR ALL
  TO authenticated, anon
  USING (true)
  WITH CHECK (true);
