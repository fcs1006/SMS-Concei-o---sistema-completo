-- Adiciona telefone e email à tabela usuarios
-- e atualiza funções de cadastro e recuperação de senha

ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS telefone text;
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS email    text;

-- Atualiza criar_usuario para receber telefone e email (opcionais por ora)
CREATE OR REPLACE FUNCTION criar_usuario(
  p_nome     text,
  p_cpf      text,
  p_senha    text,
  p_telefone text DEFAULT NULL,
  p_email    text DEFAULT NULL
)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_existe int;
BEGIN
  SELECT count(*) INTO v_existe FROM usuarios WHERE usuario = p_cpf;
  IF v_existe > 0 THEN
    RETURN json_build_object('ok', false, 'error', 'CPF já cadastrado.');
  END IF;

  INSERT INTO usuarios (nome, usuario, senha_hash, ativo, perfil, telefone, email)
  VALUES (p_nome, p_cpf, crypt(p_senha, gen_salt('bf')), false, 'usuario', p_telefone, p_email);

  RETURN json_build_object('ok', true);
END; $$;

-- Recuperação de senha: valida CPF + telefone ou email cadastrado
CREATE OR REPLACE FUNCTION recuperar_senha(
  p_cpf       text,
  p_contato   text,
  p_nova_senha text
)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_row usuarios%ROWTYPE;
  v_contato_limpo text;
BEGIN
  SELECT * INTO v_row FROM usuarios WHERE usuario = p_cpf;
  IF NOT FOUND THEN
    RETURN json_build_object('ok', false, 'error', 'CPF não encontrado.');
  END IF;

  IF length(p_nova_senha) < 6 THEN
    RETURN json_build_object('ok', false, 'error', 'Senha deve ter pelo menos 6 caracteres.');
  END IF;

  v_contato_limpo := regexp_replace(p_contato, '\D', '', 'g');

  -- Verifica se contato bate com telefone (só dígitos) ou email (case-insensitive)
  IF NOT (
    (v_row.telefone IS NOT NULL AND regexp_replace(v_row.telefone, '\D', '', 'g') = v_contato_limpo)
    OR
    (v_row.email IS NOT NULL AND lower(v_row.email) = lower(p_contato))
  ) THEN
    RETURN json_build_object('ok', false, 'error', 'Telefone ou e-mail não confere com o cadastro.');
  END IF;

  UPDATE usuarios
  SET senha_hash = crypt(p_nova_senha, gen_salt('bf'))
  WHERE usuario = p_cpf;

  RETURN json_build_object('ok', true);
END; $$;

-- Atualiza listar_usuarios para incluir telefone e email
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
        'id',        id,
        'nome',      nome,
        'usuario',   usuario,
        'ativo',     ativo,
        'perfil',    perfil,
        'telefone',  telefone,
        'email',     email,
        'criado_em', criado_em
      ) ORDER BY criado_em DESC
    ))
    FROM usuarios
  );
END; $$;
