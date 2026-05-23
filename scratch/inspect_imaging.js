const fs = require('fs');
const path = require('path');

const data = JSON.parse(fs.readFileSync(path.resolve(__dirname, 'imaging_dump.json'), 'utf8'));
const procCounts = {};
data.forEach(item => {
  const proc = item.procedimentos?.[0]?.descricao_interna || item.procedimentos?.[0]?.descricao_sigtap || 'N/A';
  procCounts[proc] = (procCounts[proc] || 0) + 1;
});
console.log('Procedure counts in dump:');
console.log(procCounts);
