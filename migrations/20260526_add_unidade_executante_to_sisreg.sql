-- Adiciona colunas para armazenar informações da Unidade Executante nos agendamentos do SISREG
ALTER TABLE monitoramento_sisreg 
ADD COLUMN IF NOT EXISTS nome_unidade_executante TEXT,
ADD COLUMN IF NOT EXISTS logradouro_unidade_executante TEXT,
ADD COLUMN IF NOT EXISTS telefone_unidade_executante TEXT;
