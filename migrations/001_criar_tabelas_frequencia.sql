-- ============================================================
-- Migração SQL para Supabase - Sistema de Frequência
-- NOTA: Esta migração é IDEMPOTENTE e pode ser executada múltiplas vezes
-- ============================================================

-- Criar tabela de servidores (idempotente)
CREATE TABLE IF NOT EXISTS servidores (
  id BIGSERIAL PRIMARY KEY,
  nome TEXT NOT NULL,
  matricula TEXT NOT NULL UNIQUE,
  funcao TEXT,
  lotacao TEXT DEFAULT 'SECRETARIA MUNICIPAL DE SAÚDE',
  nivel TEXT, -- PRESTADOR | vazio
  status TEXT DEFAULT 'ATIVO', -- ATIVO | INATIVO
  tipoVinculo TEXT,
  dataAdmissao TEXT,
  situacao TEXT,
  obs TEXT,
  ativo BOOLEAN DEFAULT true,
  criadoEm TIMESTAMP WITH TIME ZONE DEFAULT (now() AT TIME ZONE 'America/Araguaina'),
  atualizadoEm TIMESTAMP WITH TIME ZONE DEFAULT (now() AT TIME ZONE 'America/Araguaina'),
  CONSTRAINT matricula_not_empty CHECK (matricula != '')
);

-- Adicionar colunas que podem estar faltando (se tabela já existe)
ALTER TABLE servidores ADD COLUMN IF NOT EXISTS lotacao TEXT DEFAULT 'SECRETARIA MUNICIPAL DE SAÚDE';
ALTER TABLE servidores ADD COLUMN IF NOT EXISTS nivel TEXT;
ALTER TABLE servidores ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'ATIVO';
ALTER TABLE servidores ADD COLUMN IF NOT EXISTS tipoVinculo TEXT;
ALTER TABLE servidores ADD COLUMN IF NOT EXISTS dataAdmissao TEXT;
ALTER TABLE servidores ADD COLUMN IF NOT EXISTS situacao TEXT;
ALTER TABLE servidores ADD COLUMN IF NOT EXISTS obs TEXT;
ALTER TABLE servidores ADD COLUMN IF NOT EXISTS ativo BOOLEAN DEFAULT true;
ALTER TABLE servidores ADD COLUMN IF NOT EXISTS criadoEm TIMESTAMP WITH TIME ZONE DEFAULT (now() AT TIME ZONE 'America/Araguaina');
ALTER TABLE servidores ADD COLUMN IF NOT EXISTS atualizadoEm TIMESTAMP WITH TIME ZONE DEFAULT (now() AT TIME ZONE 'America/Araguaina');

CREATE INDEX IF NOT EXISTS idx_servidores_matricula ON servidores(matricula);
CREATE INDEX IF NOT EXISTS idx_servidores_nome ON servidores(nome);
CREATE INDEX IF NOT EXISTS idx_servidores_ativo ON servidores(ativo);
CREATE INDEX IF NOT EXISTS idx_servidores_status ON servidores(status);

-- Criar tabela de escala (idempotente)
CREATE TABLE IF NOT EXISTS escala (
  id BIGSERIAL PRIMARY KEY,
  matricula TEXT NOT NULL,
  matricula_normalizada TEXT NOT NULL UNIQUE,
  nome TEXT NOT NULL,
  criadoEm TIMESTAMP WITH TIME ZONE DEFAULT (now() AT TIME ZONE 'America/Araguaina'),
  CONSTRAINT matricula_not_empty CHECK (matricula != '')
);

-- Adicionar colunas que podem estar faltando na escala
ALTER TABLE escala ADD COLUMN IF NOT EXISTS matricula_normalizada TEXT UNIQUE;
ALTER TABLE escala ADD COLUMN IF NOT EXISTS criadoEm TIMESTAMP WITH TIME ZONE DEFAULT (now() AT TIME ZONE 'America/Araguaina');

CREATE INDEX IF NOT EXISTS idx_escala_matricula ON escala(matricula);
CREATE INDEX IF NOT EXISTS idx_escala_matricula_norm ON escala(matricula_normalizada);
CREATE INDEX IF NOT EXISTS idx_escala_nome ON escala(nome);

-- Criar tabela de feriados personalizados (opcional, idempotente)
CREATE TABLE IF NOT EXISTS feriados_personalizados (
  id BIGSERIAL PRIMARY KEY,
  dia INT NOT NULL CHECK (dia >= 1 AND dia <= 31),
  mes INT NOT NULL CHECK (mes >= 1 AND mes <= 12),
  ano INT NOT NULL CHECK (ano >= 2000),
  descricao TEXT DEFAULT 'FERIADO',
  criadoEm TIMESTAMP WITH TIME ZONE DEFAULT (now() AT TIME ZONE 'America/Araguaina'),
  UNIQUE(dia, mes, ano)
);

CREATE INDEX IF NOT EXISTS idx_feriados_data ON feriados_personalizados(ano, mes, dia);

-- Criar tabela de dias facultativos por mês (opcional, idempotente)
CREATE TABLE IF NOT EXISTS dias_facultativos (
  id BIGSERIAL PRIMARY KEY,
  mes INT NOT NULL CHECK (mes >= 1 AND mes <= 12),
  ano INT NOT NULL CHECK (ano >= 2000),
  dia INT NOT NULL CHECK (dia >= 1 AND dia <= 31),
  descricao TEXT DEFAULT 'FACULTATIVO',
  criadoEm TIMESTAMP WITH TIME ZONE DEFAULT (now() AT TIME ZONE 'America/Araguaina'),
  UNIQUE(mes, ano, dia)
);

CREATE INDEX IF NOT EXISTS idx_facultativos_periodo ON dias_facultativos(ano, mes);

-- Criar tabela de logs de sincronização (auditoría, idempotente)
CREATE TABLE IF NOT EXISTS logs_sincronizacao (
  id BIGSERIAL PRIMARY KEY,
  competencia TEXT NOT NULL, -- MM/YYYY
  origem TEXT, -- URL da API
  totalPortal INT DEFAULT 0,
  totalInseridos INT DEFAULT 0,
  totalAtualizados INT DEFAULT 0,
  totalIgnorados INT DEFAULT 0,
  totalInativos INT DEFAULT 0,
  status TEXT DEFAULT 'SUCESSO', -- SUCESSO | ERRO
  mensagem TEXT,
  criadoEm TIMESTAMP WITH TIME ZONE DEFAULT (now() AT TIME ZONE 'America/Araguaina')
);

CREATE INDEX IF NOT EXISTS idx_logs_competencia ON logs_sincronizacao(competencia);
CREATE INDEX IF NOT EXISTS idx_logs_data ON logs_sincronizacao(criadoEm DESC);

-- ============================================================
-- Políticas de Segurança (RLS - Row Level Security)
-- ============================================================

-- Habilitar RLS
ALTER TABLE IF EXISTS servidores ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS escala ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS feriados_personalizados ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS dias_facultativos ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS logs_sincronizacao ENABLE ROW LEVEL SECURITY;

-- Políticas de leitura (autenticado) - DROP anterior se existir
DROP POLICY IF EXISTS "Servidores - ler sempre" ON servidores;
CREATE POLICY "Servidores - ler sempre"
  ON servidores FOR SELECT
  TO authenticated, anon
  USING (true);
DROP POLICY IF EXISTS "Escala - ler sempre" ON escala;
CREATE POLICY "Escala - ler sempre"
  ON escala FOR SELECT
  TO authenticated, anon
  USING (true);

DROP POLICY IF EXISTS "Feriados - ler sempre" ON feriados_personalizados;
CREATE POLICY "Feriados - ler sempre"
  ON feriados_personalizados FOR SELECT
  TO authenticated, anon
  USING (true);

DROP POLICY IF EXISTS "Facultativos - ler sempre" ON dias_facultativos;
CREATE POLICY "Facultativos - ler sempre"
  ON dias_facultativos FOR SELECT
  TO authenticated, anon
  USING (true);

DROP POLICY IF EXISTS "Logs - ler sempre" ON logs_sincronizacao;
CREATE POLICY "Logs - ler sempre"
  ON logs_sincronizacao FOR SELECT
  TO authenticated, anon
  USING (true);

-- Políticas de escrita (apenas usuário autenticado com role admin)
-- Substitua 'admin' pelo seu claim/role no JWT
DROP POLICY IF EXISTS "Servidores - admin modifica" ON servidores;
CREATE POLICY "Servidores - admin modifica"
  ON servidores FOR ALL
  TO authenticated
  USING (auth.jwt() ->> 'role' = 'admin' OR auth.jwt() ->> 'user_role' = 'admin')
  WITH CHECK (auth.jwt() ->> 'role' = 'admin' OR auth.jwt() ->> 'user_role' = 'admin');

DROP POLICY IF EXISTS "Escala - admin modifica" ON escala;
CREATE POLICY "Escala - admin modifica"
  ON escala FOR ALL
  TO authenticated
  USING (auth.jwt() ->> 'role' = 'admin' OR auth.jwt() ->> 'user_role' = 'admin')
  WITH CHECK (auth.jwt() ->> 'role' = 'admin' OR auth.jwt() ->> 'user_role' = 'admin');

-- ============================================================
-- Dados de Exemplo
-- ============================================================

-- Inserir alguns feriados nacionais de 2024
INSERT INTO feriados_personalizados (dia, mes, ano, descricao) VALUES
(1, 1, 2024, 'Ano Novo'),
(21, 4, 2024, 'Tiradentes'),
(1, 5, 2024, 'Dia do Trabalho'),
(7, 9, 2024, 'Independência'),
(12, 10, 2024, 'Nossa Senhora Aparecida'),
(2, 11, 2024, 'Finados'),
(15, 11, 2024, 'Proclamação da República'),
(20, 11, 2024, 'Consciência Negra'),
(25, 12, 2024, 'Natal')
ON CONFLICT DO NOTHING;

-- Inserir alguns feriados nacionais de 2025
INSERT INTO feriados_personalizados (dia, mes, ano, descricao) VALUES
(1, 1, 2025, 'Ano Novo'),
(21, 4, 2025, 'Tiradentes'),
(1, 5, 2025, 'Dia do Trabalho'),
(7, 9, 2025, 'Independência'),
(12, 10, 2025, 'Nossa Senhora Aparecida'),
(2, 11, 2025, 'Finados'),
(15, 11, 2025, 'Proclamação da República'),
(20, 11, 2025, 'Consciência Negra'),
(25, 12, 2025, 'Natal')
ON CONFLICT DO NOTHING;

-- ============================================================
-- Fim da Migração
-- ============================================================
