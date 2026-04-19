-- Permite admin editar nome, telefone, email, perfil e status de qualquer usuário
CREATE OR REPLACE FUNCTION admin_editar_usuario(
  p_admin_cpf text,
  p_cpf_alvo  text,
  p_nome      text,
  p_telefone  text,
  p_email     text,
  p_perfil    text,
  p_ativo     boolean
)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_perfil text;
BEGIN
  SELECT perfil INTO v_perfil FROM usuarios WHERE usuario = p_admin_cpf AND ativo = true;
  IF v_perfil IS DISTINCT FROM 'admin' THEN
    RETURN json_build_object('ok', false, 'error', 'Acesso negado.');
  END IF;

  UPDATE usuarios
  SET nome     = p_nome,
      telefone = p_telefone,
      email    = p_email,
      perfil   = p_perfil,
      ativo    = p_ativo
  WHERE usuario = p_cpf_alvo;

  RETURN json_build_object('ok', true);
END; $$;
