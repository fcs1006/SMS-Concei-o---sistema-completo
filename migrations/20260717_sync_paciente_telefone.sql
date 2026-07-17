-- trigger para atualizar especialidades_agendamentos quando o telefone do paciente mudar no cadastro
CREATE OR REPLACE FUNCTION sync_paciente_telefone_to_agendamentos()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.telefone IS DISTINCT FROM OLD.telefone THEN
    UPDATE especialidades_agendamentos
    SET telefone = NEW.telefone
    WHERE paciente_cns = NEW.cpf_cns;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_paciente_telefone_to_agendamentos ON pacientes;
CREATE TRIGGER trg_sync_paciente_telefone_to_agendamentos
AFTER UPDATE OF telefone ON pacientes
FOR EACH ROW
EXECUTE FUNCTION sync_paciente_telefone_to_agendamentos();

-- trigger para atualizar o cadastro de pacientes (e outros agendamentos via cascata) quando o telefone mudar em um agendamento
CREATE OR REPLACE FUNCTION sync_agendamento_telefone_to_pacientes()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.paciente_cns IS NOT NULL AND (TG_OP = 'INSERT' OR NEW.telefone IS DISTINCT FROM OLD.telefone) THEN
    UPDATE pacientes
    SET telefone = NEW.telefone
    WHERE cpf_cns = NEW.paciente_cns;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_agendamento_telefone_to_pacientes ON especialidades_agendamentos;
CREATE TRIGGER trg_sync_agendamento_telefone_to_pacientes
AFTER INSERT OR UPDATE OF telefone ON especialidades_agendamentos
FOR EACH ROW
EXECUTE FUNCTION sync_agendamento_telefone_to_pacientes();
