import Link from "next/link";
import { Divider } from "@/components/ui/Ornament";

/** Data da versão em vigor dos termos e da política (mudou → atualizar aqui e avisar no site). */
export const LEGAL_VERSION = "26 de novembro de 2026";
export const PARISH_EMAIL = "secretaria@psjb.org.br";

/** Moldura das páginas de termos e privacidade: título, data da versão, seções e o contato. */
export function LegalPage({ title, intro, children }: { title: string; intro: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-[72ch] px-4 py-12 sm:px-6">
      <h1 className="text-center font-serif text-[36px] font-semibold leading-tight text-primary sm:text-[40px]">{title}</h1>
      <p className="mt-2 text-center text-sm text-ink-muted">Versão de {LEGAL_VERSION}</p>
      <Divider className="my-5" />
      <div className="text-lg leading-relaxed">
        <p>{intro}</p>
        <div className="mt-6 space-y-8 [&_h2]:font-serif [&_h2]:text-2xl [&_h2]:font-semibold [&_h2]:text-primary [&_li]:mt-1.5 [&_p]:mt-3 [&_ul]:mt-3 [&_ul]:list-disc [&_ul]:pl-6">
          {children}
        </div>
        <p className="mt-10 rounded-[10px] border border-border bg-surface-2 p-4 text-base">
          Dúvidas ou pedidos sobre os seus dados: escreva para{" "}
          <a href={`mailto:${PARISH_EMAIL}`} className="font-medium text-primary underline underline-offset-2">
            {PARISH_EMAIL}
          </a>
          . Veja também os <Link href="/termos" className="text-primary underline underline-offset-2">Termos de uso</Link> e a{" "}
          <Link href="/privacidade" className="text-primary underline underline-offset-2">Política de privacidade</Link>.
        </p>
      </div>
    </div>
  );
}
