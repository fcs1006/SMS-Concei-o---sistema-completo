'use client'
import React from 'react';
import { useRouter } from 'next/navigation';

export default function PrivacidadePage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-[#f1f5f9] p-6 pb-20 fade-in">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center gap-4 mb-8">
          <button 
            onClick={() => router.back()}
            className="nav-btn flex items-center gap-2"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
              <path fillRule="evenodd" d="M11.354 1.646a.5.5 0 0 1 0 .708L5.707 8l5.647 5.646a.5.5 0 0 1-.708.708l-6-6a.5.5 0 0 1 0-.708l6-6a.5.5 0 0 1 .708 0z"/>
            </svg>
            Voltar
          </button>
          <h1 className="text-2xl font-bold text-slate-800 font-['Plus_Jakarta_Sans']">Política de Privacidade</h1>
        </div>

        <div className="card p-8 space-y-6 text-slate-700 text-sm leading-relaxed">
          <p>
            A Secretaria Municipal de Saúde de Conceição do Tocantins (SMS Conceição) está comprometida em proteger a privacidade e os dados pessoais de seus pacientes, servidores e cidadãos, em total conformidade com a <strong>Lei Geral de Proteção de Dados Pessoais (LGPD) - Lei nº 13.709/2018</strong>.
          </p>
          <p>
            Por se tratar de uma instituição de saúde, a maioria dos dados tratados pelo nosso sistema são classificados pela LGPD como <strong>Dados Pessoais Sensíveis</strong>. O tratamento desses dados é realizado com os mais altos padrões de segurança, visando unicamente a proteção da vida, a tutela da saúde e a execução de políticas públicas de saúde.
          </p>

          <h2 className="text-lg font-bold text-slate-800 mt-6 border-b pb-2 font-['Sora']">1. Coleta de Dados Pessoais e Sensíveis</h2>
          <p>Coletamos e armazenamos os seguintes dados durante seu atendimento e uso do sistema:</p>
          <ul className="list-disc pl-6 space-y-2">
            <li><strong>Dados de Identificação:</strong> Nome completo, CPF, RG, CNS (Cartão Nacional de Saúde), data de nascimento, filiação.</li>
            <li><strong>Dados de Contato:</strong> Endereço, telefone, e-mail.</li>
            <li><strong>Dados Sensíveis de Saúde:</strong> Prontuários médicos, histórico clínico, receituários, exames, encaminhamentos (TFD), agendamentos de especialidades e dispensação de medicamentos no almoxarifado.</li>
          </ul>

          <h2 className="text-lg font-bold text-slate-800 mt-6 border-b pb-2 font-['Sora']">2. Finalidade do Tratamento (Por que coletamos?)</h2>
          <p>O tratamento de dados é realizado estritamente para as seguintes finalidades:</p>
          <ul className="list-disc pl-6 space-y-2">
            <li>Prestação de assistência à saúde, diagnóstico e tratamento médico.</li>
            <li>Agendamento de consultas, exames e transportes (Tratamento Fora de Domicílio - TFD).</li>
            <li>Controle e entrega de medicamentos (Farmácia Básica/Almoxarifado).</li>
            <li>Cumprimento de obrigações legais e regulatórias do SUS e Ministério da Saúde (ex: BPA, SIGTAP, e-SUS).</li>
            <li>Geração de relatórios epidemiológicos e estatísticos (de forma anonimizada, sempre que possível).</li>
          </ul>

          <h2 className="text-lg font-bold text-slate-800 mt-6 border-b pb-2 font-['Sora']">3. Compartilhamento de Dados</h2>
          <p>Seus dados são de uso interno da SMS Conceição e de profissionais de saúde diretamente envolvidos no seu atendimento. Poderemos compartilhar seus dados apenas nos seguintes casos:</p>
          <ul className="list-disc pl-6 space-y-2">
            <li>Com o Ministério da Saúde e Secretaria de Estado da Saúde, para cumprimento de obrigações legais do SUS.</li>
            <li>Com outras unidades de saúde, clínicas conveniadas e hospitais, exclusivamente para continuidade do seu tratamento médico.</li>
            <li>Por ordem judicial ou obrigação legal.</li>
          </ul>

          <h2 className="text-lg font-bold text-slate-800 mt-6 border-b pb-2 font-['Sora']">4. Segurança dos Dados</h2>
          <p>Implementamos medidas técnicas e administrativas para proteger seus dados contra acessos não autorizados, perdas ou alterações. Todos os acessos ao sistema são registrados (logs) para auditoria, garantindo que apenas profissionais autorizados acessem os prontuários e agendamentos.</p>

          <h2 className="text-lg font-bold text-slate-800 mt-6 border-b pb-2 font-['Sora']">5. Seus Direitos como Titular</h2>
          <p>De acordo com a LGPD, você tem o direito de:</p>
          <ul className="list-disc pl-6 space-y-2">
            <li>Confirmar a existência de tratamento de seus dados.</li>
            <li>Acessar seus dados e prontuários.</li>
            <li>Solicitar a correção de dados incompletos ou desatualizados.</li>
            <li>Solicitar a anonimização, bloqueio ou eliminação de dados desnecessários (observados os prazos legais de guarda de prontuário médico de, no mínimo, 20 anos, conforme CFM).</li>
            <li>Saber com quais entidades públicas ou privadas seus dados foram compartilhados.</li>
          </ul>

          <h2 className="text-lg font-bold text-slate-800 mt-6 border-b pb-2 font-['Sora']">6. Contato do Encarregado (DPO)</h2>
          <p>Para exercer seus direitos ou esclarecer dúvidas sobre esta Política, entre em contato através da Secretaria de Saúde ou com o setor de TI da Prefeitura.</p>

          <div className="mt-8 pt-6 border-t text-xs text-slate-500">
            Última atualização: {new Date().toLocaleDateString('pt-BR')}
          </div>
        </div>
      </div>
    </div>
  );
}
