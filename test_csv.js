const fs = require('fs');
const texto = `e-SUS - Atenção Primária
MINISTÉRIO DA SAÚDE
ESTADO DE TOCANTINS
MUNICÍPIO DE CONCEIÇÃO DO TOCANTINS
Nome equipe;INE equipe;Microárea;Endereço;CPF/CNS;Nome;Idade;Sexo;Identidade de gênero;Data de nascimento;Telefone celular;Telefone residencial;Telefone de contato;Última atualização cadastral;Origem;
RURAL;"0000037257";"01";Rua PARÁ, S/N. SETOR BRASIL, Conceição do Tocantins - TO | 77305-000;"434.538.801-53";LUCY DE SENA DA SILVA;61 anos e 11 meses;Feminino;-;30/05/1964;(63) 9296-3592;(62) 99547-3012;-;02/07/2025;CDS;`;

const separador = ';';
const linhasRaw = texto.split('\n');

let idxCabecalho = 0;
for (let i = 0; i < linhasRaw.length; i++) {
  if (linhasRaw[i].toLowerCase().includes('cpf/cns') && linhasRaw[i].toLowerCase().includes('nome')) {
    idxCabecalho = i;
    break;
  }
}

const cabecalho = linhasRaw[idxCabecalho].toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').split(separador).map(c => c.trim().replace(/^"|"$/g, ''));

const idxNome = cabecalho.findIndex(c => c === 'nome');
const idxCpfCns = cabecalho.findIndex(c => c === 'cpf/cns');
const idxLogradouro = cabecalho.findIndex(c => c.includes('endereco') || c.includes('logradouro'));

console.log('Cabecalho encontrado na linha:', idxCabecalho);
console.log('idxNome:', idxNome, 'idxCpfCns:', idxCpfCns, 'idxLogradouro:', idxLogradouro);

const dados = [];
for (let i = idxCabecalho + 1; i < linhasRaw.length; i++) {
  if (!linhasRaw[i].trim()) continue;
  const l = linhasRaw[i].split(separador).map(c => c.trim().replace(/^"|"$/g, ''));
  
  if (l.length > 1 && l[idxNome] && l[idxNome] !== '-' && idxNome >= 0) {
    let enderecoCompleto = idxLogradouro >= 0 ? l[idxLogradouro] : '';
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

    dados.push({
      nome: l[idxNome],
      endereco: endereco !== '-' ? endereco : '',
      bairro: bairro !== '-' ? bairro : '',
      cep: cep !== '-' ? cep : ''
    });
  }
}
console.log('Dados extraidos:', dados);
