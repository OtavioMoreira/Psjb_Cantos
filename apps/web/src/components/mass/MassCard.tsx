"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Copy, MoreHorizontal, Pencil, Tablet, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { Mass } from "@/lib/types";
import { SEASON_STYLE, formatDateShort } from "@/lib/liturgy";
import { deleteMass, duplicateMass, saveMass } from "@/lib/store";
import { toast } from "@/components/ui/Toast";
import { MassPdfButton } from "./MassPdfButton";
import { massEditUrl, massModeUrl } from "@/lib/routes";

export function massProgress(m: Mass) {
  const filled = m.slots.filter((s) => s.items.length > 0).length;
  const songs = m.slots.reduce((n, s) => n + s.items.length, 0);
  return { filled, total: m.slots.length, songs };
}

export function MassCard({ mass }: { mass: Mass }) {
  const router = useRouter();
  const [menu, setMenu] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { filled, total, songs } = massProgress(mass);
  const color = mass.season ? SEASON_STYLE[mass.season].color : "var(--border)";

  useEffect(() => {
    const close = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setMenu(false);
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, []);

  return (
    <article className="relative flex rounded-[10px] border border-border bg-surface shadow-card">
      <span aria-hidden className="w-1 shrink-0 rounded-l-[10px]" style={{ background: color }} />
      <div className="flex-1 p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="font-serif text-xl font-semibold leading-tight">
              <Link href={massEditUrl(mass.id)} className="hover:text-primary">
                {mass.name || "Missa sem nome"}
              </Link>
            </h3>
            <p className="mt-1 text-sm text-ink-muted">
              {formatDateShort(mass.date)}
              {mass.time && ` · ${mass.time.replace(":00", "h").replace(":", "h")}`}
              {mass.season && ` · ${SEASON_STYLE[mass.season].label}`}
              {mass.year && ` · Ano ${mass.year}`}
            </p>
          </div>
          <div className="relative" ref={ref}>
            <button aria-label="Mais ações" aria-expanded={menu} onClick={() => setMenu((v) => !v)} className="grid h-10 w-10 place-items-center rounded-full text-ink-muted hover:bg-surface-2">
              <MoreHorizontal size={20} />
            </button>
            {menu && (
              <div role="menu" className="animate-fade-in absolute right-0 top-11 z-20 w-48 rounded-[10px] border border-border bg-surface p-1.5 shadow-overlay">
                <button
                  role="menuitem"
                  onClick={() => {
                    const c = duplicateMass(mass.id);
                    if (c) router.push(massEditUrl(c.id));
                  }}
                  className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-primary-soft"
                >
                  <Copy size={16} /> Duplicar
                </button>
                <button
                  role="menuitem"
                  onClick={() => {
                    setMenu(false);
                    const removed = deleteMass(mass.id);
                    toast(`“${mass.name || "Missa"}” excluída.`, {
                      label: "Desfazer",
                      onClick: () => removed && saveMass(removed),
                    });
                  }}
                  className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-danger hover:bg-danger/10"
                >
                  <Trash2 size={16} /> Excluir
                </button>
              </div>
            )}
          </div>
        </div>
        <div className="mt-3 flex items-center gap-3">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-2">
            <div className="h-full rounded-full bg-primary-solid" style={{ width: `${(filled / total) * 100}%` }} />
          </div>
          <span className="shrink-0 text-xs text-ink-muted">
            {filled} de {total} momentos · {songs} {songs === 1 ? "canto" : "cantos"}
          </span>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link href={massModeUrl(mass.id)} className="inline-flex items-center gap-2 rounded-[10px] bg-primary-solid px-4 py-2 text-sm font-semibold text-[#FFFDF8] hover:bg-primary-hover">
            <Tablet size={16} /> Modo Missa
          </Link>
          <Link href={massEditUrl(mass.id)} className="inline-flex items-center gap-2 rounded-[10px] border border-primary px-4 py-2 text-sm font-semibold text-primary hover:bg-primary-soft">
            <Pencil size={16} /> Editar
          </Link>
          <MassPdfButton mass={mass} compact className="min-h-0 py-2" />
        </div>
      </div>
    </article>
  );
}
