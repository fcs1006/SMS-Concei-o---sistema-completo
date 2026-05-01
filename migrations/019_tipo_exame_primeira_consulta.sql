-- Renomeia "Primeira Consulta" → "1º vez" em agendamentos já salvos
UPDATE especialidades_agendamentos
SET tipo_exame = '1º vez'
WHERE tipo_exame = 'Primeira Consulta';
