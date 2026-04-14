-- ============================================================
-- Tabela de conversas do agente Francisco (WhatsApp)
-- ============================================================

CREATE TABLE IF NOT EXISTS whatsapp_conversas (
  id          BIGSERIAL PRIMARY KEY,
  telefone    TEXT NOT NULL,
  nome        TEXT,
  papel       TEXT NOT NULL CHECK (papel IN ('user', 'assistant')),
  mensagem    TEXT NOT NULL,
  criado_em   TIMESTAMP WITH TIME ZONE DEFAULT (now() AT TIME ZONE 'America/Araguaina')
);

CREATE INDEX IF NOT EXISTS idx_wpp_telefone ON whatsapp_conversas(telefone, criado_em DESC);

ALTER TABLE whatsapp_conversas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "wpp_service_role" ON whatsapp_conversas;
CREATE POLICY "wpp_service_role"
  ON whatsapp_conversas FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);
