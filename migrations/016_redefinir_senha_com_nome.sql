-- Atualiza redefinir_senha para aceitar verificação por nome
-- e adiciona função para admin redefinir senha de qualquer usuário

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

-- Nova função: admin redefine senha de qualquer usuário
CREATE OR REPLACE FUNCTION admin_redefinir_senha(
  p_admin_cpf  text,
  p_cpf_alvo   text,
  p_nova_senha text
)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_perfil text;
BEGIN
  SELECT perfil INTO v_perfil FROM usuarios WHERE usuario = p_admin_cpf AND ativo = true;
  IF v_perfil IS DISTINCT FROM 'admin' THEN
    RETURN json_build_object('ok', false, 'error', 'Acesso negado.');
  END IF;
  IF length(p_nova_senha) < 6 THEN
    RETURN json_build_object('ok', false, 'error', 'Senha deve ter pelo menos 6 caracteres.');
  END IF;
  UPDATE usuarios
  SET senha_hash = crypt(p_nova_senha, gen_salt('bf'))
  WHERE usuario = p_cpf_alvo;
  RETURN json_build_object('ok', true);
END; $$;
