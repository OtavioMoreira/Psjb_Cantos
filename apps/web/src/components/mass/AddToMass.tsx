"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Check, ListPlus, Plus } from "lucide-react";
import type { MomentId } from "@/lib/types";
import { DEFAULT_SLOTS, addSongToMass, newMass, saveMass, useMasses, useSession } from "@/lib/store";
import { useHydrated } from "@/lib/hooks";
import { formatDateShort } from "@/lib/liturgy";
import { taxonomy } from "@/lib/labels";
import { toast } from "@/components/ui/Toast";
import { buttonClass } from "@/components/ui/Button";
import { massEditUrl } from "@/lib/routes";

export function AddToMass({ songId, moments, title }: { songId: number; moments: MomentId[]; title: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const session = useSession();
  const hydrated = useHydrated();
  const masses = useMasses();
  const [open, setOpen] = useState(false);
  const [done, setDone] = useState(false);
  const suggested = moments.find((m) => DEFAULT_SLOTS.some((s) => s.moment === m)) ?? moments[0] ?? "entrada";
  const [moment, setMoment] = useState<MomentId>(suggested);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const close = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, []);

  const add = (massId: string, name: string) => {
    addSongToMass(massId, moment, songId);
    setOpen(false);
    setDone(true);
    setTimeout(() => setDone(false), 1200);
    const label = taxonomy.moments.find((m) => m.id === moment)?.label;
    toast(`Adicionado a “${name}” · ${label}`, { label: "Abrir", onClick: () => router.push(massEditUrl(massId)) });
  };

  const onClick = () => {
    if (!hydrated || !session.loggedIn) {
      router.push(`/entrar?volta=${encodeURIComponent(pathname)}`);
      return;
    }
    setOpen((v) => !v);
  };

  return (
    <div className="relative" ref={ref}>
      <button onClick={onClick} aria-expanded={open} className={buttonClass("primary")}>
        {done ? <Check size={18} /> : <ListPlus size={18} />} Adicionar à minha missa
      </button>
      {open && (
        <div className="animate-fade-in absolute left-0 top-full z-30 mt-2 w-[min(90vw,340px)] rounded-[16px] border border-border bg-surface p-4 shadow-overlay">
          <p className="text-sm font-semibold">Adicionar “{title}”</p>
          <label className="mt-3 block text-xs font-semibold uppercase tracking-[0.08em] text-ink-muted">
            Momento
            <select
              value={moment}
              onChange={(e) => setMoment(e.target.value as MomentId)}
              className="mt-1 h-10 w-full rounded-md border border-border bg-surface px-2 text-sm normal-case tracking-normal text-ink"
            >
              {taxonomy.moments.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                  {moments.includes(m.id) ? " (sugerido)" : ""}
                </option>
              ))}
            </select>
          </label>
          <p className="mb-1 mt-4 text-xs font-semibold uppercase tracking-[0.08em] text-ink-muted">Em qual missa?</p>
          <ul className="max-h-56 space-y-1 overflow-y-auto">
            {masses.map((m) => (
              <li key={m.id}>
                <button onClick={() => add(m.id, m.name || "Missa")} className="flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm hover:bg-primary-soft">
                  <span className="truncate font-medium">{m.name || "Missa sem nome"}</span>
                  <span className="shrink-0 text-xs text-ink-muted">{formatDateShort(m.date)}</span>
                </button>
              </li>
            ))}
          </ul>
          <button
            onClick={() => {
              const m = saveMass({ ...newMass(), name: "Nova missa" });
              add(m.id, m.name);
            }}
            className="mt-2 flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm font-semibold text-primary hover:bg-primary-soft"
          >
            <Plus size={16} /> Nova missa…
          </button>
        </div>
      )}
    </div>
  );
}
