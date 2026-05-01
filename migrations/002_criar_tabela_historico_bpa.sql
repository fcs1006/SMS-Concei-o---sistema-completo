-- Dropa a tabela se necessário (descomente em testes)
-- DROP TABLE IF EXISTS historico_bpa;

CREATE TABLE IF NOT EXISTS public.historico_bpa (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  competencia varchar(6) NOT NULL,
  perfil varchar(20) NOT NULL,
  procedimento varchar(10),
  nome_paciente text,
  cpf_cns varchar(15),
  data_atendimento date,
  quantidade integer DEFAULT 1,
  data_criacao timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Índices para melhorar a performance das buscas do relatório
CREATE INDEX IF NOT EXISTS historico_bpa_competencia_idx ON public.historico_bpa (competencia);
CREATE INDEX IF NOT EXISTS historico_bpa_nome_idx ON public.historico_bpa (nome_paciente);
CREATE INDEX IF NOT EXISTS historico_bpa_cpf_idx ON public.historico_bpa (cpf_cns);
CREATE INDEX IF NOT EXISTS historico_bpa_perfil_idx ON public.historico_bpa (perfil);

-- Criação de RLS (Row Level Security) opcional, caso esteja habilitado
ALTER TABLE public.historico_bpa ENABLE ROW LEVEL SECURITY;

-- Policy genérica para permissão total do service role e authenticated users
CREATE POLICY "Permitir leitura para autenticados" 
ON public.historico_bpa FOR SELECT 
TO authenticated 
USING (true);

CREATE POLICY "Permitir insercao e delecao via service role/app" 
ON public.historico_bpa FOR ALL 
USING (true)
WITH CHECK (true);
