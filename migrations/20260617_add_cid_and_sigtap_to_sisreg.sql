-- ============================================================
-- Migração SQL - Adiciona colunas de CID, SIGTAP, Observações e CRM
-- ============================================================

ALTER TABLE public.monitoramento_sisreg 
ADD COLUMN IF NOT EXISTS codigo_sigtap_procedimento TEXT,
ADD COLUMN IF NOT EXISTS codigo_cid TEXT,
ADD COLUMN IF NOT EXISTS descricao_cid TEXT,
ADD COLUMN IF NOT EXISTS justificativa_clinica TEXT,
ADD COLUMN IF NOT EXISTS numero_crm TEXT;
