-- Tabela de configuração de especialidades (lista dinâmica)
CREATE TABLE IF NOT EXISTS public.especialidades_config (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  slug text UNIQUE NOT NULL,
  label text NOT NULL,
  icon text NOT NULL DEFAULT '🏥',
  cota integer NOT NULL DEFAULT 30,
  ativo boolean NOT NULL DEFAULT true,
  criado_em timestamptz DEFAULT now()
);

ALTER TABLE public.especialidades_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Permitir tudo via service role" ON public.especialidades_config FOR ALL USING (true) WITH CHECK (true);

-- Seed com as especialidades existentes
INSERT INTO public.especialidades_config (slug, label, icon, cota) VALUES
  ('ortopedia',    'Ortopedia',    '🦴', 30),
  ('ginecologia',  'Ginecologia',  '🩺', 30),
  ('oftalmologia', 'Oftalmologia', '👁️', 30),
  ('urologia',     'Urologia',     '🔬', 30),
  ('usg',          'USG',          '📡', 60),
  ('psiquiatria',  'Psiquiatria',  '🧠', 30)
ON CONFLICT (slug) DO NOTHING;

-- Tabela de preparos por tipo de exame
CREATE TABLE IF NOT EXISTS public.preparos_exame (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  especialidade_slug text NOT NULL,
  tipo_exame text NOT NULL,
  instrucoes text NOT NULL,
  ativo boolean NOT NULL DEFAULT true,
  criado_em timestamptz DEFAULT now(),
  UNIQUE(especialidade_slug, tipo_exame)
);

ALTER TABLE public.preparos_exame ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Permitir tudo via service role" ON public.preparos_exame FOR ALL USING (true) WITH CHECK (true);

-- Seed com os preparos de USG
INSERT INTO public.preparos_exame (especialidade_slug, tipo_exame, instrucoes) VALUES
  ('usg', 'ABDOMEN TOTAL',      'JEJUM DE 8 HORAS. 40 GOTAS DIMETICONA ANTES DE DORMIR NO DIA ANTERIOR.'),
  ('usg', 'ABDOMEN SUPERIOR',   'JEJUM DE 8 HORAS. 40 GOTAS DIMETICONA ANTES DE DORMIR NO DIA ANTERIOR.'),
  ('usg', 'VIAS URINÁRIAS',     'BEXIGA CHEIA (BEBER 1 LITRO DE ÁGUA 1 HORA ANTES E NÃO URINAR).'),
  ('usg', 'PÉLVICA',            'BEXIGA CHEIA (BEBER 1 LITRO DE ÁGUA 1 HORA ANTES E NÃO URINAR).'),
  ('usg', 'PRÓSTATA ABDOMINAL', 'JEJUM DE 8 HORAS. 40 GOTAS DIMETICONA ANTES DE DORMIR NO DIA ANTERIOR. BEXIGA CHEIA.'),
  ('usg', 'PRÓSTATA TRANSRETAL','JEJUM DE 8 HORAS. 40 GOTAS DIMETICONA ANTES DE DORMIR NO DIA ANTERIOR. BEXIGA CHEIA.')
ON CONFLICT (especialidade_slug, tipo_exame) DO NOTHING;
