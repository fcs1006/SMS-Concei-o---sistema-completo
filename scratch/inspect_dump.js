const fs = require('fs');
const path = require('path');

const filePath = path.resolve(__dirname, 'mastologia_dump.json');

try {
  const content = fs.readFileSync(filePath, 'utf8');
  const data = JSON.parse(content);
  
  console.log(`Parsed ${data.length} records:`);
  data.forEach((s, idx) => {
    console.log(`\nRecord ${idx + 1}:`);
    console.log({
      codigo_solicitacao: s.codigo_solicitacao || s.co_solicitacao,
      data_solicitacao: s.data_solicitacao,
      no_usuario: s.no_usuario,
      cpf_usuario: s.cpf_usuario,
      cns_usuario: s.cns_usuario,
      dt_nascimento_usuario: s.dt_nascimento_usuario,
      telefone: s.telefone,
      sexo_usuario: s.sexo_usuario,
      municipio_paciente_residencia: s.municipio_paciente_residencia,
      nome_unidade_solicitante: s.nome_unidade_solicitante,
      procedimento: s.procedimentos?.[0]?.descricao_interna || s.procedimentos?.[0]?.descricao_sigtap,
      codigo_classificacao_risco: s.codigo_classificacao_risco,
      status_solicitacao: s.status_solicitacao || s.no_situacao_solicitacao,
      laudos_count: s.laudo ? s.laudo.length : 0,
      data_marcacao: s.data_marcacao,
      data_confirmacao: s.data_confirmacao
    });
  });
} catch (error) {
  console.error('Error:', error.message);
}
