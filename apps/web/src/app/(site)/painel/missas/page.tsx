"use client";

import { useState } from "react";
import { Plus, Search } from "lucide-react";
import { useMasses } from "@/lib/store";
import { todayIso } from "@/lib/liturgy";
import { normalize } from "@/lib/search";
import { ButtonLink } from "@/components/ui/Button";
import { Cross } from "@/components/ui/Ornament";
import { MassCard } from "@/components/mass/MassCard";

type View = "proximas" | "passadas" | "todas";

export default function MissasPage() {
  const masses = useMasses();
  const [q, setQ] = useState("");
  const [view, setView] = useState<View>("todas");
  const today = todayIso();
  const list = masses
    .filter((m) => (view === "proximas" ? m.date >= today : view === "passadas" ? m.date < today : true))
    .filter((m) => normalize(m.name).includes(normalize(q)))
    .sort((a, b) => (b.date || "").localeCompare(a.date || ""));

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="font-serif text-[32px] font-semibold text-primary sm:text-[40px]">Minhas Missas</h1>
        <ButtonLink href="/painel/missas/nova">
          <Plus size={18} /> Nova missa
        </ButtonLink>
      </div>
      <div className="mt-6 flex flex-wrap gap-3">
        <label className="relative min-w-[200px] flex-1">
          <span className="sr-only">Buscar missa</span>
          <Search size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar missa" className="h-11 w-full rounded-[10px] border border-border bg-surface pl-10 pr-3 outline-none focus:border-primary" />
        </label>
        <div role="radiogroup" aria-label="Período" className="inline-flex rounded-[10px] border border-border bg-surface p-1 text-sm">
          {(
            [
              ["proximas", "Próximas"],
              ["passadas", "Passadas"],
              ["todas", "Todas"],
            ] as const
          ).map(([id, l]) => (
            <button key={id} role="radio" aria-checked={view === id} onClick={() => setView(id)} className="rounded-md px-3 py-1.5 text-ink-muted aria-checked:bg-primary-soft aria-checked:font-semibold aria-checked:text-primary">
              {l}
            </button>
          ))}
        </div>
      </div>
      {list.length === 0 ? (
        <div className="mt-10 flex flex-col items-center rounded-[16px] border border-dashed border-border py-14 text-center">
          <Cross size={20} className="text-gold" />
          <p className="mt-4 font-serif text-2xl font-semibold">
            {masses.length ? "Nenhuma missa neste filtro." : "Você ainda não montou nenhuma missa."}
          </p>
          <ButtonLink href="/painel/missas/nova" className="mt-6">
            Montar minha primeira missa
          </ButtonLink>
        </div>
      ) : (
        <div className="mt-6 grid gap-3">
          {list.map((m) => (
            <MassCard key={m.id} mass={m} />
          ))}
        </div>
      )}
    </div>
  );
}
