const TELEFONE_TESTE = '5500000000000';

async function testarWebhook() {
  console.log('--- SIMULANDO INTERAÇÃO COM O FRANCISCO NO WEBHOOK ---');
  
  const localUrl = 'http://localhost:3000/api/whatsapp/webhook';

  try {
    // 0. Limpa o estado e as mensagens anteriores para iniciar do zero
    console.log('Limpando estado e histórico de teste...');
    const clearRes = await fetch(`http://localhost:3000/api/whatsapp/teste?telefone=${TELEFONE_TESTE}`, {
      method: 'DELETE'
    });
    const clearJson = await clearRes.json();
    console.log('Limpeza concluída:', clearJson);

    // 1. Enviar mensagem 'Olá'
    console.log('\nEnviando mensagem: "Olá" (Iniciando conversa)...');
    const resGreeting = await fetch(localUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event: 'messages.upsert',
        data: {
          key: { fromMe: false, remoteJid: `${TELEFONE_TESTE}@s.whatsapp.net` },
          message: { conversation: 'Olá' }
        }
      })
    });
    await resGreeting.json();
    await new Promise(r => setTimeout(r, 2000));

    // 2. Enviar opção '3' (SISREG)
    console.log('\nEnviando mensagem: "3" (Selecionando SISREG)...');
    const res1 = await fetch(localUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event: 'messages.upsert',
        data: {
          key: { fromMe: false, remoteJid: `${TELEFONE_TESTE}@s.whatsapp.net` },
          message: { conversation: '3' }
        }
      })
    });
    await res1.json();
    await new Promise(r => setTimeout(r, 2000));

    // 3. Enviar opção '2' (Exame)
    console.log('\nEnviando mensagem: "2" (Selecionando Exames)...');
    const resOption = await fetch(localUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event: 'messages.upsert',
        data: {
          key: { fromMe: false, remoteJid: `${TELEFONE_TESTE}@s.whatsapp.net` },
          message: { conversation: '2' }
        }
      })
    });
    await resOption.json();
    await new Promise(r => setTimeout(r, 2000));

    // 4. Enviar CPF '13732504700'
    console.log('\nEnviando CPF: "13732504700" (Realizando a busca direta no SISREG)...');
    const res2 = await fetch(localUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event: 'messages.upsert',
        data: {
          key: { fromMe: false, remoteJid: `${TELEFONE_TESTE}@s.whatsapp.net` },
          message: { conversation: '13732504700' }
        }
      })
    });
    await res2.json();

    // Aguardar o processamento ao vivo da API do SISREG pelo robô
    console.log('\nAguardando resposta da busca ao vivo no SISREG...');
    await new Promise(r => setTimeout(r, 8000));

    // 5. Buscar histórico final
    const checkRes = await fetch(`http://localhost:3000/api/whatsapp/teste?telefone=${TELEFONE_TESTE}`);
    const checkJson = await checkRes.json();
    const novasMensagens = checkJson.mensagens || [];

    console.log('\n--- DIÁLOGO COMPLETO DO CHATBOT ---');
    novasMensagens.forEach(m => {
      console.log(`[${m.papel.toUpperCase()}]: ${m.mensagem}`);
      console.log('----------------------------------------------------');
    });

  } catch (error) {
    console.error('❌ Erro durante o teste de integração:', error.message);
  }
}

testarWebhook();
