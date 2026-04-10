-- ============================================================
-- Migração SQL - Tabela de Pacientes
-- ============================================================

-- Renomeia coluna 'cpf' para 'cpf_cns' se a tabela já existir com nome errado
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'pacientes' AND column_name = 'cpf'
  ) THEN
    ALTER TABLE pacientes RENAME COLUMN cpf TO cpf_cns;
  END IF;
END $$;

-- Cria tabela se ainda não existir (com coluna correta)
CREATE TABLE IF NOT EXISTS pacientes (
  id        BIGSERIAL PRIMARY KEY,
  nome      TEXT NOT NULL,
  cpf_cns   TEXT NOT NULL UNIQUE,
  dt_nasc   DATE,
  sexo      CHAR(1),
  telefone  TEXT,
  endereco  TEXT,
  bairro    TEXT,
  cep       TEXT,
  criado_em TIMESTAMP WITH TIME ZONE DEFAULT (now() AT TIME ZONE 'America/Araguaina')
);

CREATE INDEX IF NOT EXISTS idx_pacientes_cpf_cns ON pacientes(cpf_cns);
CREATE INDEX IF NOT EXISTS idx_pacientes_nome    ON pacientes(nome);

-- RLS
ALTER TABLE pacientes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Pacientes - ler sempre" ON pacientes;
CREATE POLICY "Pacientes - ler sempre"
  ON pacientes FOR SELECT
  TO authenticated, anon
  USING (true);

DROP POLICY IF EXISTS "Pacientes - admin modifica" ON pacientes;
CREATE POLICY "Pacientes - admin modifica"
  ON pacientes FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);
