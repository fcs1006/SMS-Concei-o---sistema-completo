const enderecoCompleto = 'Rua PARÁ, S/N. SETOR BRASIL, Conceição do Tocantins - TO | 77305-000';
let cep = '';
let endereco = enderecoCompleto;
let bairro = '';
if (enderecoCompleto && enderecoCompleto !== '-' && enderecoCompleto.includes('|')) {
  const partes = enderecoCompleto.split('|');
  endereco = partes[0].trim();
  cep = partes[1].trim();
}
if (endereco && endereco !== '-') {
  const partesVirgula = endereco.split(',');
  if (partesVirgula.length >= 2) {
    let logradouro = partesVirgula[0].trim();
    let parteBairro = partesVirgula[partesVirgula.length - 2].trim();
    let numero = '';
    if (parteBairro.includes(' - ')) {
      const sub = parteBairro.split(' - ');
      bairro = sub.pop().trim();
      numero = sub.join(' - ').trim();
    } else if (parteBairro.includes('.')) {
      const sub = parteBairro.split('.');
      bairro = sub.pop().trim();
      numero = sub.join('.').trim();
    } else {
      bairro = parteBairro;
    }
    endereco = numero ? logradouro + ', ' + numero : logradouro;
  }
}
console.log('Bairro:', bairro);
console.log('Endereco:', endereco);
console.log('Cep:', cep);
