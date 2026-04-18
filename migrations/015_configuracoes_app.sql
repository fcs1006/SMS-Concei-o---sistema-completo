-- Tabela de configurações compartilhadas entre sistema web e app mobile
CREATE TABLE IF NOT EXISTS configuracoes_app (
  chave       TEXT PRIMARY KEY,
  valor       TEXT NOT NULL,
  descricao   TEXT,
  updated_at  TIMESTAMPTZ DEFAULT now()
);

-- Permissão de leitura pública (app usa service role, mas garante acesso anon também)
ALTER TABLE configuracoes_app ENABLE ROW LEVEL SECURITY;
CREATE POLICY "leitura_publica" ON configuracoes_app FOR SELECT USING (true);

-- =============================================
-- Configurações de login
-- =============================================
INSERT INTO configuracoes_app (chave, valor, descricao) VALUES
  ('login_campo',       'cpf',              'Campo usado no login: cpf | usuario'),
  ('login_label',       'CPF',              'Rótulo exibido no campo de login'),
  ('login_placeholder', '000.000.000-00',   'Placeholder do campo de login'),
  ('login_mascara',     'cpf',              'Tipo de máscara: cpf | nenhuma'),
  ('login_teclado',     'numeric',          'Tipo de teclado: numeric | default')
ON CONFLICT (chave) DO UPDATE
  SET valor      = EXCLUDED.valor,
      descricao  = EXCLUDED.descricao,
      updated_at = now();

-- =============================================
-- Função para o sistema web atualizar configs
-- =============================================
CREATE OR REPLACE FUNCTION atualizar_config_app(
  p_admin_cpf TEXT,
  p_chave     TEXT,
  p_valor     TEXT
) RETURNS json LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_perfil TEXT;
BEGIN
  SELECT perfil INTO v_perfil FROM usuarios
  WHERE regexp_replace(usuario, '\D', '', 'g') = regexp_replace(p_admin_cpf, '\D', '', 'g')
    AND ativo = true;

  IF v_perfil IS NULL OR v_perfil != 'admin' THEN
    RETURN json_build_object('ok', false, 'error', 'Acesso negado.');
  END IF;

  UPDATE configuracoes_app
    SET valor = p_valor, updated_at = now()
    WHERE chave = p_chave;

  RETURN json_build_object('ok', true);
END; $$;
