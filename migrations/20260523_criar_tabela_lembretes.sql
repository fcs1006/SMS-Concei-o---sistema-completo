-- ============================================================
-- Migração SQL - Tabela de Controle de Lembretes Enviados
-- ============================================================

CREATE TABLE IF NOT EXISTS public.lembretes_enviados (
  id            BIGSERIAL PRIMARY KEY,
  tipo          VARCHAR(20) NOT NULL, -- 'especialidade' | 'sisreg' | 'tfd'
  referencia_id VARCHAR(50) NOT NULL, -- UUID do agendamento, codigo_solicitacao ou ID da viagem
  data_evento   DATE NOT NULL,        -- A data em que o evento ocorre (para controle de remarcações)
  telefone      VARCHAR(20) NOT NULL, -- Telefone para o qual foi enviado
  mensagem      TEXT,                 -- Conteúdo do lembrete enviado
  criado_em     TIMESTAMP WITH TIME ZONE DEFAULT (now() AT TIME ZONE 'America/Araguaina') NOT NULL
);

-- Índice único composto para impedir duplicidades no mesmo evento/data
CREATE UNIQUE INDEX IF NOT EXISTS idx_lembretes_enviados_unico 
  ON public.lembretes_enviados (tipo, referencia_id, data_evento);

-- Habilitar RLS (Row Level Security)
ALTER TABLE public.lembretes_enviados ENABLE ROW LEVEL SECURITY;

-- Políticas de acesso
DROP POLICY IF EXISTS "Lembretes - ler sempre" ON public.lembretes_enviados;
CREATE POLICY "Lembretes - ler sempre"
  ON public.lembretes_enviados FOR SELECT
  TO authenticated, anon
  USING (true);

DROP POLICY IF EXISTS "Lembretes - tudo via service role" ON public.lembretes_enviados;
CREATE POLICY "Lembretes - tudo via service role"
  ON public.lembretes_enviados FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);


-- ============================================================
-- APÊNDICE: TABELA MONITORAMENTO_SISREG (CASO NÃO EXISTA)
-- ============================================================
-- Se você receber erros indicando que a tabela 'monitoramento_sisreg'
-- não existe, execute o bloco abaixo no painel do Supabase:
/*
CREATE TABLE IF NOT EXISTS public.monitoramento_sisreg (
  codigo_solicitacao BIGINT PRIMARY KEY,
  data_solicitacao TIMESTAMP,
  data_aprovacao TIMESTAMP,
  data_marcacao TIMESTAMP,
  data_confirmacao TIMESTAMP,
  no_usuario TEXT,
  cns_usuario TEXT,
  cpf_usuario TEXT,
  no_mae_usuario TEXT,
  dt_nascimento_usuario DATE,
  telefone TEXT,
  sexo_usuario TEXT,
  municipio_paciente_residencia TEXT,
  codigo_unidade_solicitante TEXT,
  nome_unidade_solicitante TEXT,
  nome_medico_solicitante TEXT,
  codigo_interno_procedimento TEXT,
  descricao_interna_procedimento TEXT,
  codigo_classificacao_risco TEXT,
  codigo_tipo_regulacao TEXT,
  status_solicitacao TEXT,
  atualizado_em TIMESTAMP DEFAULT NOW()
);

ALTER TABLE public.monitoramento_sisreg ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Leitura permitida para todos na tabela monitoramento_sisreg" 
ON public.monitoramento_sisreg 
FOR SELECT USING (true);
*/
