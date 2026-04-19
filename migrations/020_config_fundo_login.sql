-- Configurações de fundo da tela de login (persistidas no banco)
INSERT INTO configuracoes_app (chave, valor, descricao) VALUES
  ('login_fundo_id',     'foto',   'Tipo de fundo: foto | gradient | cyan | roxo | custom'),
  ('login_fundo_bgSize', 'cover',  'backgroundSize da foto'),
  ('login_fundo_bgPos',  'center', 'backgroundPosition da foto'),
  ('login_fundo_ajX',    '50',     'Posição X ajuste manual (%)'),
  ('login_fundo_ajY',    '50',     'Posição Y ajuste manual (%)'),
  ('login_fundo_zoom',   '100',    'Zoom ajuste manual (%)'),
  ('login_fundo_url',    '',       'URL da imagem customizada'),
  ('login_fundo_modoAj', '0',      'Ajuste manual ativo: 1 | 0')
ON CONFLICT (chave) DO NOTHING;
