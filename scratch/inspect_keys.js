const fs = require('fs');
const path = require('path');

const data = JSON.parse(fs.readFileSync(path.resolve(__dirname, 'mastologia_dump.json'), 'utf8'));
const keys = new Set();
data.forEach(item => {
  Object.keys(item).forEach(k => {
    if (k.toLowerCase().includes('data') || k.toLowerCase().includes('dt') || k.toLowerCase().includes('marc') || k.toLowerCase().includes('conf')) {
      keys.add(k);
    }
  });
});
console.log('Fields related to dates/marking/confirmation in the raw Elasticsearch schema:');
console.log(Array.from(keys));

// Also check the structure of procedures and laudos for any dates
if (data[0]) {
  console.log('\nKeys in first record:', Object.keys(data[0]));
}
