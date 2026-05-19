CREATE TABLE monitoramento_sisreg (
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

-- Habilitar RLS
ALTER TABLE monitoramento_sisreg ENABLE ROW LEVEL SECURITY;

-- Criar política de acesso leitura para todos (opcional, dependendo de como você gerencia permissões)
CREATE POLICY "Leitura permitida para todos na tabela monitoramento_sisreg" 
ON monitoramento_sisreg 
FOR SELECT USING (true);
