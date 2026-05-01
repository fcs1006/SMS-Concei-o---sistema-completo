ALTER TABLE public.especialidades_escala
  ADD COLUMN IF NOT EXISTS data_atendimento date;

-- Remove constraint antiga (permitia só 1 entrada por médico/especialidade/mês)
ALTER TABLE public.especialidades_escala
  DROP CONSTRAINT IF EXISTS especialidades_escala_especialidade_profissional_id_mes_ano_key;

-- Nova constraint: mesmo médico pode ter várias datas no mesmo mês
ALTER TABLE public.especialidades_escala
  ADD CONSTRAINT especialidades_escala_unique
  UNIQUE (especialidade, profissional_id, mes, ano, data_atendimento);
