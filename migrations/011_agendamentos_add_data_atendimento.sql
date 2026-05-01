-- Adiciona coluna data_atendimento em especialidades_agendamentos
-- para guardar a data real do médico na escala (diferente da data de solicitação)

ALTER TABLE especialidades_agendamentos
  ADD COLUMN IF NOT EXISTS data_atendimento DATE;
