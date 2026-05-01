-- ============================================================
-- Autenticação corrigida + controle de acesso por perfil
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Colunas de controle na tabela usuarios
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS ativo  boolean NOT NULL DEFAULT false;
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS perfil text    NOT NULL DEFAULT 'usuario';

-- ── criar_usuario ────────────────────────────────────────────
CREATE OR REPLACE FUNCTION criar_usuario(p_nome text, p_cpf text, p_senha text)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_existe int;
BEGIN
  SELECT count(*) INTO v_existe FROM usuarios WHERE usuario = p_cpf;
  IF v_existe > 0 THEN
    RETURN json_build_object('ok', false, 'error', 'CPF já cadastrado.');
  END IF;

  INSERT INTO usuarios (nome, usuario, senha_hash, ativo, perfil)
  VALUES (p_nome, p_cpf, crypt(p_senha, gen_salt('bf')), false, 'usuario');

  RETURN json_build_object('ok', true);
END; $$;

-- ── redefinir_senha ──────────────────────────────────────────
CREATE OR REPLACE FUNCTION redefinir_senha(p_cpf text, p_nova_senha text)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_existe int;
BEGIN
  SELECT count(*) INTO v_existe FROM usuarios WHERE usuario = p_cpf;
  IF v_existe = 0 THEN
    RETURN json_build_object('ok', false, 'error', 'CPF não encontrado.');
  END IF;

  UPDATE usuarios
  SET senha_hash = crypt(p_nova_senha, gen_salt('bf'))
  WHERE usuario = p_cpf;

  RETURN json_build_object('ok', true);
END; $$;

-- ── fazer_login ──────────────────────────────────────────────
CREATE OR REPLACE FUNCTION fazer_login(p_usuario text, p_senha text)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_row usuarios%ROWTYPE;
DECLARE v_cpf text;
BEGIN
  v_cpf := regexp_replace(p_usuario, '\D', '', 'g');
  SELECT * INTO v_row FROM usuarios WHERE regexp_replace(usuario, '\D', '', 'g') = v_cpf;
  IF NOT FOUND THEN
    RETURN json_build_object('ok', false, 'error', 'Usuário ou senha incorretos.');
  END IF;

  IF v_row.senha_hash != crypt(p_senha, v_row.senha_hash) THEN
    RETURN json_build_object('ok', false, 'error', 'Usuário ou senha incorretos.');
  END IF;

  IF NOT v_row.ativo THEN
    RETURN json_build_object('ok', false, 'error', 'Acesso pendente de aprovação pelo administrador.');
  END IF;

  RETURN json_build_object(
    'ok',      true,
    'id',      v_row.id,
    'nome',    v_row.nome,
    'usuario', v_row.usuario,
    'perfil',  v_row.perfil
  );
END; $$;

-- ── listar_usuarios (admin) ───────────────────────────────────
CREATE OR REPLACE FUNCTION listar_usuarios(p_admin_cpf text)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_perfil text;
BEGIN
  SELECT perfil INTO v_perfil FROM usuarios WHERE usuario = p_admin_cpf AND ativo = true;
  IF v_perfil IS DISTINCT FROM 'admin' THEN
    RETURN json_build_object('ok', false, 'error', 'Acesso negado.');
  END IF;

  RETURN (
    SELECT json_build_object('ok', true, 'data', json_agg(
      json_build_object(
        'id',      id,
        'nome',    nome,
        'usuario', usuario,
        'ativo',   ativo,
        'perfil',  perfil,
        'criado_em', criado_em
      ) ORDER BY criado_em DESC
    ))
    FROM usuarios
  );
END; $$;

-- ── atualizar_usuario (admin) ─────────────────────────────────
CREATE OR REPLACE FUNCTION atualizar_usuario(
  p_admin_cpf text,
  p_cpf_alvo  text,
  p_ativo     boolean,
  p_perfil    text
)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_perfil text;
BEGIN
  SELECT perfil INTO v_perfil FROM usuarios WHERE usuario = p_admin_cpf AND ativo = true;
  IF v_perfil IS DISTINCT FROM 'admin' THEN
    RETURN json_build_object('ok', false, 'error', 'Acesso negado.');
  END IF;

  UPDATE usuarios SET ativo = p_ativo, perfil = p_perfil WHERE usuario = p_cpf_alvo;
  RETURN json_build_object('ok', true);
END; $$;

-- ============================================================
-- DEFINA VOCÊ COMO ADMIN (substitua pelo seu CPF sem pontos):
-- UPDATE usuarios SET ativo = true, perfil = 'admin' WHERE usuario = '00000000000';
-- ============================================================
