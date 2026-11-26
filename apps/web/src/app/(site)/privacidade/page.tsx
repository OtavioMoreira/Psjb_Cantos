import type { Metadata } from "next";
import { LegalPage, PARISH_EMAIL } from "@/components/layout/LegalPage";

export const metadata: Metadata = {
  title: "Política de privacidade",
  description: "Quais dados o site de cantos da Paróquia Catedral São João Batista guarda, para quê e por quanto tempo (LGPD).",
};

export default function PrivacidadePage() {
  return (
    <LegalPage
      title="Política de privacidade"
      intro={
        <>
          Esta política explica, de acordo com a Lei Geral de Proteção de Dados (LGPD, Lei nº 13.709/2018), quais dados pessoais o{" "}
          <strong>Cantos PSJB</strong> guarda, para quê e por quanto tempo. A responsável pelos dados é a{" "}
          <strong>Paróquia Catedral São João Batista</strong>.
        </>
      }
    >
      <section>
        <h2>1. Sem conta, quase nada</h2>
        <p>
          Para ver os cantos não é preciso cadastro. O site não usa cookies de publicidade nem ferramentas de rastreamento. Suas preferências (tema,
          tamanho da letra, sustenidos ou bemóis) ficam guardadas só no seu aparelho.
        </p>
      </section>

      <section>
        <h2>2. O que guardamos de quem tem conta</h2>
        <ul>
          <li>
            <strong>Cadastro:</strong> nome, e-mail e senha. A senha é guardada de forma irreversível (hash argon2): ninguém, nem a coordenação,
            consegue vê-la.
          </li>
          <li>
            <strong>Opcionais:</strong> telefone ou WhatsApp, movimento ou pastoral, paróquia e instrumento ou voz. Você pode apagar cada um no
            perfil.
          </li>
          <li>
            <strong>Missas:</strong> as missas que você monta e com quem as compartilha.
          </li>
          <li>
            <strong>Segurança:</strong> data do último acesso, as sessões abertas (com o tipo de navegador), os aparelhos em que você marcou
            &quot;Confiar neste aparelho&quot; e, por pouco tempo, o endereço IP, para limitar tentativas de senha.
          </li>
          <li>
            <strong>Auditoria:</strong> as ações feitas pela coordenação na área de administração (por exemplo, quem ativou ou bloqueou uma conta).
          </li>
        </ul>
      </section>

      <section>
        <h2>3. Para que usamos</h2>
        <ul>
          <li>Dar acesso à sua conta e às missas que você criou ou recebeu (execução do serviço que você pediu).</li>
          <li>
            Enviar e-mails <strong>do próprio serviço</strong>: código de acesso, recuperação de senha, convite, conta liberada ou bloqueada e
            missa compartilhada. Não enviamos propaganda.
          </li>
          <li>Proteger as contas contra acessos indevidos (legítimo interesse).</li>
          <li>Mostrar o seu nome para as pessoas da equipe com quem você compartilha missas.</li>
        </ul>
        <p>Seus dados não são vendidos nem cedidos a ninguém.</p>
      </section>

      <section>
        <h2>4. Cookies</h2>
        <p>
          Usamos só dois cookies, ambos <strong>necessários</strong> e inacessíveis a scripts: um que mantém você conectado (até 30 dias com
          &quot;Manter conectado&quot;) e outro que lembra este aparelho como confiável para o código de acesso (30 dias). Por serem essenciais ao
          login, não pedem consentimento.
        </p>
      </section>

      <section>
        <h2>5. Onde os dados ficam</h2>
        <p>O site usa serviços de terceiros que tratam os dados em nome da paróquia, só para fazer o site funcionar:</p>
        <ul>
          <li>
            <strong>Vercel</strong>: hospedagem do site e dos arquivos (PDFs e áudios dos cantos).
          </li>
          <li>
            <strong>Neon</strong>: banco de dados, na região de São Paulo.
          </li>
          <li>
            <strong>Resend</strong>: envio dos e-mails do serviço.
          </li>
          <li>
            <strong>Cloudflare Turnstile</strong>: o desafio &quot;não sou um robô&quot; do cadastro, da recuperação de senha e do login depois de
            senhas erradas. Ele confere sinais do navegador para separar pessoas de robôs, sem cookies de publicidade.
          </li>
        </ul>
        <p>Parte desses serviços pode processar dados fora do Brasil, com as garantias previstas na LGPD.</p>
      </section>

      <section>
        <h2>6. Por quanto tempo</h2>
        <ul>
          <li>Conta, perfil e missas: enquanto a conta existir.</li>
          <li>Sessões, links enviados por e-mail e aparelhos confiáveis: apagados 7 dias depois de vencerem.</li>
          <li>Contadores de tentativas por IP: no máximo 1 dia.</li>
          <li>Registros de auditoria da administração: 2 anos.</li>
        </ul>
        <p>
          Quando uma conta é excluída, saem junto o perfil, as sessões e as missas criadas pela pessoa (quem as recebeu perde o acesso). Nos
          registros de auditoria, fica só o nome.
        </p>
      </section>

      <section>
        <h2>7. Seus direitos</h2>
        <p>Pela LGPD, você pode a qualquer momento:</p>
        <ul>
          <li>confirmar se tratamos seus dados e pedir uma cópia deles;</li>
          <li>corrigir dados (a maior parte você mesmo corrige no perfil);</li>
          <li>pedir a exclusão da conta e dos dados;</li>
          <li>revogar o consentimento e tirar dúvidas sobre o uso dos seus dados.</li>
        </ul>
        <p>
          Para isso, escreva para{" "}
          <a href={`mailto:${PARISH_EMAIL}`} className="text-primary underline underline-offset-2">
            {PARISH_EMAIL}
          </a>{" "}
          a partir do e-mail da sua conta. Você também pode procurar a Autoridade Nacional de Proteção de Dados (ANPD).
        </p>
      </section>

      <section>
        <h2>8. Mudanças nesta política</h2>
        <p>Se esta política mudar, a data da versão no topo da página muda junto e avisaremos no site.</p>
      </section>
    </LegalPage>
  );
}
