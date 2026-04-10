ALTER TABLE public.especialidades_agendamentos
  ADD COLUMN IF NOT EXISTS telefone varchar(15),
  ADD COLUMN IF NOT EXISTS tipo_exame text;
