-- Adiciona coluna de confirmação à tabela de viagens
ALTER TABLE viagens ADD COLUMN IF NOT EXISTS confirmacao VARCHAR(50) DEFAULT NULL;
