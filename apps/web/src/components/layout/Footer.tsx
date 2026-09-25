import Link from "next/link";
import Image from "next/image";
import logo from "../../../public/logo.png";
import { Divider } from "@/components/ui/Ornament";

export function Footer() {
  return (
    <footer className="mt-16 bg-surface-2 text-sm text-ink-muted">
      <div className="mx-auto max-w-[1440px] px-4 py-10 sm:px-6 lg:px-10">
        <Divider className="mb-8" />
        <div className="flex flex-col items-center gap-6 text-center md:flex-row md:items-start md:justify-between md:text-left">
          <div className="flex flex-col items-center gap-3 md:flex-row md:items-start">
            <Image src={logo} alt="" className="logo-img h-12 w-auto opacity-90" sizes="120px" />
            <div>
              <p className="font-serif text-lg font-semibold text-ink">Paróquia Catedral São João Batista</p>
              <p>Repertório litúrgico do Ministério de Música</p>
            </div>
          </div>
          <nav aria-label="Rodapé" className="flex flex-wrap justify-center gap-x-2">
            <Link href="/cantos" className="inline-flex min-h-11 items-center px-2 hover:text-primary">Cantos</Link>
            <Link href="/painel/missas/nova" className="inline-flex min-h-11 items-center px-2 hover:text-primary">Monte sua Missa</Link>
            <Link href="/sobre" className="inline-flex min-h-11 items-center px-2 hover:text-primary">Sobre</Link>
            <Link href="/entrar" className="inline-flex min-h-11 items-center px-2 hover:text-primary">Entrar</Link>
          </nav>
        </div>
        <div className="mt-8 flex flex-col items-center justify-between gap-2 border-t border-border pt-6 sm:flex-row">
          <p className="font-serif text-base italic">“Quem canta reza duas vezes.” — Sto. Agostinho</p>
          <p>© {new Date().getFullYear()} Paróquia Catedral São João Batista</p>
        </div>
      </div>
    </footer>
  );
}
