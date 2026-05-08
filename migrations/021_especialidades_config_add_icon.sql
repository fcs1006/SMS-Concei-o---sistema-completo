-- Adiciona coluna icon em especialidades_config caso não exista
ALTER TABLE public.especialidades_config
  ADD COLUMN IF NOT EXISTS icon text NOT NULL DEFAULT '🏥';

-- Atualiza os ícones das especialidades do seed original
UPDATE public.especialidades_config SET icon = '🦴' WHERE slug = 'ortopedia'   AND icon = '🏥';
UPDATE public.especialidades_config SET icon = '🩺' WHERE slug = 'ginecologia'  AND icon = '🏥';
UPDATE public.especialidades_config SET icon = '👁️' WHERE slug = 'oftalmologia' AND icon = '🏥';
UPDATE public.especialidades_config SET icon = '🔬' WHERE slug = 'urologia'     AND icon = '🏥';
UPDATE public.especialidades_config SET icon = '📡' WHERE slug = 'usg'          AND icon = '🏥';
UPDATE public.especialidades_config SET icon = '🧠' WHERE slug = 'psiquiatria'  AND icon = '🏥';
