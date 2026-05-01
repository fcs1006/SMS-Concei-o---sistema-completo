CREATE TABLE IF NOT EXISTS public.especialidades_agendamentos (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  especialidade varchar(20) NOT NULL, -- ortopedia | ginecologia | oftalmologia | urologia | usg
  paciente_nome text NOT NULL,
  paciente_cns varchar(15),
  data_consulta date NOT NULL,
  status varchar(15) NOT NULL DEFAULT 'pendente', -- pendente | autorizado | negado
  observacao text,
  mes varchar(2) NOT NULL,
  ano varchar(4) NOT NULL,
  criado_por text,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS esp_ag_especialidade_idx ON public.especialidades_agendamentos (especialidade);
CREATE INDEX IF NOT EXISTS esp_ag_mes_ano_idx ON public.especialidades_agendamentos (mes, ano);
CREATE INDEX IF NOT EXISTS esp_ag_status_idx ON public.especialidades_agendamentos (status);

ALTER TABLE public.especialidades_agendamentos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Permitir tudo via service role"
ON public.especialidades_agendamentos FOR ALL
USING (true)
WITH CHECK (true);
