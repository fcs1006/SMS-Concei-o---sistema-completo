-- Permite papel 'sistema' para mensagens de escalonamento
ALTER TABLE whatsapp_conversas
  DROP CONSTRAINT IF EXISTS whatsapp_conversas_papel_check;

ALTER TABLE whatsapp_conversas
  ADD CONSTRAINT whatsapp_conversas_papel_check
  CHECK (papel IN ('user', 'assistant', 'sistema'));
