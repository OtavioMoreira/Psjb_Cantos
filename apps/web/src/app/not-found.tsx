import Link from "next/link";
import { Cross } from "@/components/ui/Ornament";

export default function NotFound() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-4 py-24 text-center">
      <Cross size={24} className="text-gold" />
      <h1 className="mt-4 font-serif text-4xl font-semibold text-primary">Página não encontrada</h1>
      <p className="mt-2 text-ink-muted">Este endereço não existe ou o canto foi removido.</p>
      <Link href="/cantos" className="mt-6 font-semibold text-primary underline underline-offset-4">
        Ir para os cantos
      </Link>
    </div>
  );
}
