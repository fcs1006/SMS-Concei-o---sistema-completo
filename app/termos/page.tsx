'use client'
import React from 'react';
import { useRouter } from 'next/navigation';

export default function TermosPage() {
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
          <h1 className="text-2xl font-bold text-slate-800 font-['Plus_Jakarta_Sans']">Termos de Uso</h1>
        </div>

        <div className="card p-8 space-y-6 text-slate-700 text-sm leading-relaxed">
          <p>
            Bem-vindo ao Sistema de Gestão da Secretaria Municipal de Saúde de Conceição do Tocantins (SMS Conceição). Ao utilizar este sistema, você concorda com as condições descritas nestes Termos de Uso.
          </p>

          <h2 className="text-lg font-bold text-slate-800 mt-6 border-b pb-2 font-['Sora']">1. Aceitação dos Termos</h2>
          <p>
            O acesso e uso deste sistema são condicionados à aceitação e ao cumprimento destes Termos. Estas condições aplicam-se a todos os usuários: profissionais de saúde, servidores administrativos, pacientes e cidadãos.
          </p>

          <h2 className="text-lg font-bold text-slate-800 mt-6 border-b pb-2 font-['Sora']">2. Uso do Sistema por Profissionais e Servidores</h2>
          <p>Para servidores e profissionais de saúde com acesso restrito, aplicam-se as seguintes regras:</p>
          <ul className="list-disc pl-6 space-y-2">
            <li><strong>Sigilo e Confidencialidade:</strong> É terminantemente proibido compartilhar informações de prontuários médicos, diagnósticos, laudos ou dados pessoais de pacientes com terceiros não envolvidos diretamente no cuidado, sob pena de sanções administrativas, civis e criminais.</li>
            <li><strong>Uso Pessoal da Conta:</strong> As credenciais de acesso (login e senha) são de uso pessoal e intransferível. O titular da conta é responsável por todas as ações registradas sob seu login.</li>
            <li><strong>Finalidade Estrita:</strong> O sistema deve ser utilizado exclusivamente para fins de prestação de serviço público de saúde e gestão administrativa da SMS. Consultas a dados de pacientes por mera curiosidade são infrações graves.</li>
          </ul>

          <h2 className="text-lg font-bold text-slate-800 mt-6 border-b pb-2 font-['Sora']">3. Uso do Sistema por Pacientes e Cidadãos</h2>
          <p>Ao fornecer dados para agendamentos, cadastros no SUS ou solicitações de TFD através da secretaria, o cidadão se compromete a:</p>
          <ul className="list-disc pl-6 space-y-2">
            <li>Fornecer informações verdadeiras, exatas e atualizadas (incluindo número do cartão SUS, CPF e endereço).</li>
            <li>Comunicar a unidade de saúde sobre mudanças de contato (telefone/endereço) para viabilizar avisos de agendamento de cirurgias e consultas.</li>
          </ul>

          <h2 className="text-lg font-bold text-slate-800 mt-6 border-b pb-2 font-['Sora']">4. Disponibilidade do Sistema</h2>
          <p>A SMS Conceição envida todos os esforços para manter o sistema disponível continuamente. Contudo, podem ocorrer interrupções temporárias para manutenção preventiva, atualizações de segurança ou por motivos de força maior.</p>

          <h2 className="text-lg font-bold text-slate-800 mt-6 border-b pb-2 font-['Sora']">5. Propriedade Intelectual</h2>
          <p>O software, suas interfaces, logotipos e toda a documentação técnica são de propriedade do Município de Conceição do Tocantins ou de seus licenciadores, sendo proibida a cópia, modificação, distribuição ou engenharia reversa sem autorização.</p>

          <h2 className="text-lg font-bold text-slate-800 mt-6 border-b pb-2 font-['Sora']">6. Alterações nos Termos</h2>
          <p>A Secretaria Municipal de Saúde reserva-se o direito de modificar estes termos a qualquer momento. Os usuários serão notificados sobre alterações significativas.</p>

          <div className="mt-8 pt-6 border-t text-xs text-slate-500">
            Última atualização: {new Date().toLocaleDateString('pt-BR')}
          </div>
        </div>
      </div>
    </div>
  );
}
