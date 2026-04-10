-- Profissionais por especialidade
CREATE TABLE IF NOT EXISTS public.especialidades_profissionais (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  especialidade varchar(20) NOT NULL,
  nome text NOT NULL,
  conselho_tipo varchar(10) DEFAULT 'CRM',
  conselho_numero varchar(20),
  ativo boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS esp_prof_especialidade_idx ON public.especialidades_profissionais (especialidade);
CREATE INDEX IF NOT EXISTS esp_prof_ativo_idx ON public.especialidades_profissionais (ativo);

ALTER TABLE public.especialidades_profissionais ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Permitir tudo profissionais"
ON public.especialidades_profissionais FOR ALL USING (true) WITH CHECK (true);

-- Escala mensal por especialidade
CREATE TABLE IF NOT EXISTS public.especialidades_escala (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  especialidade varchar(20) NOT NULL,
  profissional_id uuid REFERENCES public.especialidades_profissionais(id) ON DELETE CASCADE,
  profissional_nome text NOT NULL,
  mes varchar(2) NOT NULL,
  ano varchar(4) NOT NULL,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(especialidade, profissional_id, mes, ano)
);

CREATE INDEX IF NOT EXISTS esp_escala_periodo_idx ON public.especialidades_escala (especialidade, mes, ano);

ALTER TABLE public.especialidades_escala ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Permitir tudo escala"
ON public.especialidades_escala FOR ALL USING (true) WITH CHECK (true);

-- Alterar tabela de agendamentos para suportar cancelamento e profissional
ALTER TABLE public.especialidades_agendamentos
  ADD COLUMN IF NOT EXISTS motivo_cancelamento text,
  ADD COLUMN IF NOT EXISTS profissional_nome text;
