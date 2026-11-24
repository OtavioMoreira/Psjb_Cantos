import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage, PARISH_EMAIL } from "@/components/layout/LegalPage";

export const metadata: Metadata = { title: "Termos de uso", description: "Regras de uso do site de cantos da Paróquia Catedral São João Batista." };

export default function TermosPage() {
  return (
    <LegalPage
      title="Termos de uso"
      intro={
        <>
          O <strong>Cantos PSJB</strong> é o site de cantos litúrgicos da Paróquia Catedral São João Batista. Ao usar o site e, principalmente, ao
          criar uma conta, você concorda com estes termos.
        </>
      }
    >
      <section>
        <h2>1. Para que serve</h2>
        <p>
          O site existe para servir à liturgia: consultar letras, cifras, partituras e áudios, montar o repertório das missas e usá-lo no celular
          ou no tablet durante a celebração, evitando livros e impressões.
        </p>
      </section>

      <section>
        <h2>2. Quem pode usar</h2>
        <ul>
          <li>O repertório é aberto a todos, sem cadastro.</li>
          <li>
            A conta serve para montar e compartilhar missas. Toda conta nova passa pela <strong>aprovação da coordenação</strong> da paróquia antes
            do primeiro acesso.
          </li>
          <li>Cada conta é pessoal. Não compartilhe a sua senha; para trabalhar em equipe, use o compartilhamento de missas.</li>
        </ul>
      </section>

      <section>
        <h2>3. Cuidados com a conta</h2>
        <ul>
          <li>Mantenha o e-mail atualizado: é por ele que chegam o código de acesso, a recuperação de senha e os avisos.</li>
          <li>Use uma senha só sua, com letras e números. Se desconfiar que alguém a conhece, troque-a no perfil.</li>
          <li>
            A coordenação pode <strong>bloquear</strong> uma conta usada fora da finalidade do site, informando o motivo, ou excluí-la a pedido da
            pessoa.
          </li>
        </ul>
      </section>

      <section>
        <h2>4. Missas compartilhadas</h2>
        <p>
          Quem cria uma missa é o dono dela: só o dono exclui a missa e escolhe com quem compartilhar. Quem recebe pode ver, editar os cantos, abrir
          no Modo Missa e baixar o PDF. O link de convite dá acesso a quem o abrir, então envie-o só a quem deve participar.
        </p>
      </section>

      <section>
        <h2>5. Direitos dos cantos</h2>
        <p>
          Letras, melodias, cifras, partituras e gravações pertencem aos seus autores e editoras. O material é disponibilizado para uso litúrgico e
          de preparação das celebrações. Não o republique nem o use com fins comerciais.
        </p>
        <p>
          É autor ou detentor de direitos e quer corrigir um crédito ou retirar um material? Escreva para{" "}
          <a href={`mailto:${PARISH_EMAIL}`} className="text-primary underline underline-offset-2">
            {PARISH_EMAIL}
          </a>
          .
        </p>
      </section>

      <section>
        <h2>6. Disponibilidade</h2>
        <p>
          O site é mantido pela paróquia sem fins lucrativos e pode passar por manutenções ou ficar fora do ar. Para não depender da internet no
          altar, baixe o PDF da missa com antecedência.
        </p>
      </section>

      <section>
        <h2>7. Seus dados</h2>
        <p>
          O que guardamos, para quê e por quanto tempo está na{" "}
          <Link href="/privacidade" className="text-primary underline underline-offset-2">
            Política de privacidade
          </Link>
          .
        </p>
      </section>

      <section>
        <h2>8. Mudanças nestes termos</h2>
        <p>Se estes termos mudarem, a data da versão no topo da página muda junto e avisaremos no site.</p>
      </section>
    </LegalPage>
  );
}
