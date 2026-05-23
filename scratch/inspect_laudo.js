const fs = require('fs');
const path = require('path');

const data = JSON.parse(fs.readFileSync(path.resolve(__dirname, 'mastologia_dump.json'), 'utf8'));
data.forEach((s, idx) => {
  console.log(`\nRecord ${idx + 1}: ${s.no_usuario} | Status: ${s.status_solicitacao}`);
  if (s.laudo && s.laudo.length > 0) {
    console.log('Laudos:');
    s.laudo.forEach((l, lIdx) => {
      console.log(`  Laudo ${lIdx + 1}: [${l.data_observacao}] (${l.tipo_perfil} - ${l.situacao}) - Obs: ${l.observacao ? l.observacao.replace(/\r?\n/g, ' ') : 'N/A'}`);
    });
  } else {
    console.log('No laudos');
  }
});
