import type { Metadata } from "next";
import { Divider } from "@/components/ui/Ornament";
import { ButtonLink } from "@/components/ui/Button";

export const metadata: Metadata = { title: "Sobre" };

export default function SobrePage() {
  return (
    <div className="mx-auto max-w-[72ch] px-4 py-12 sm:px-6">
      <h1 className="text-center font-serif text-[40px] font-semibold text-primary">Sobre o projeto</h1>
      <Divider className="my-5" />
      <div className="space-y-4 text-lg leading-relaxed">
        <p>
          O <strong>Cantos PSJB</strong> reúne o repertório litúrgico da Paróquia Catedral São João Batista: letras, cifras,
          partituras e áudios, organizados pelos momentos da Missa, pelos tempos e pelo ano litúrgico.
        </p>
        <p>
          Com o <strong>Monte sua Missa</strong>, o ministério de música prepara a celebração com antecedência e, no altar, usa o
          <strong> Modo Missa</strong> no tablet: letra grande, troca de tom e navegação por toque ou pedal. Menos papel, mais
          oração.
        </p>
        <p className="font-serif text-2xl italic text-gold-ink">“Cantai ao Senhor um canto novo.” — Sl 96,1</p>
        <p className="text-base text-ink-muted">
          Esta é uma versão de demonstração (Fase 1): os dados vêm de arquivos de exemplo e o login é ilustrativo.
        </p>
      </div>
      <div className="mt-8 flex justify-center gap-3">
        <ButtonLink href="/cantos">Ver cantos</ButtonLink>
        <ButtonLink href="/painel/missas/nova" variant="secondary">
          Monte sua Missa
        </ButtonLink>
      </div>
    </div>
  );
}
