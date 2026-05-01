-- Tabela de estado da conversa do Francisco por número de telefone
CREATE TABLE IF NOT EXISTS public.whatsapp_estados (
  telefone    text PRIMARY KEY,
  estado      text NOT NULL DEFAULT 'menu',
  atualizado_em timestamptz DEFAULT now()
);

ALTER TABLE public.whatsapp_estados ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access" ON public.whatsapp_estados FOR ALL USING (true) WITH CHECK (true);
