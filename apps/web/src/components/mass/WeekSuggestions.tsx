"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronDown, CopyPlus, FileDown, Loader2, Pencil, Sparkles } from "lucide-react";
import type { Mass } from "@/lib/types";
import { massFromSuggestion, useSession, useWeekSuggestions } from "@/lib/store";
import { useSongMap } from "@/lib/useSongIndex";
import { SEASON_STYLE, formatDateLong, formatNumber } from "@/lib/liturgy";
import { massEditUrl } from "@/lib/routes";
import { toast } from "@/components/ui/Toast";

const hour = (t: string) => (t ? t.replace(":00", "h").replace(":", "h") : "");

/**
 * "Sugestões da semana": as missas que a coordenação (admin) sugeriu para todos, de hoje até
 * domingo. Cada pessoa cria a própria missa com base nelas e ajusta como quiser.
 * Some quando não há sugestão nesta semana.
 */
export function WeekSuggestions({ compact = false }: { compact?: boolean }) {
  const { list } = useWeekSuggestions();
  if (!list.length) return null;
  return (
    <section aria-labelledby="sugestoes-titulo" className="rounded-[16px] border border-gold/50 bg-gold-soft/60 p-4 sm:p-5">
      <h2 id="sugestoes-titulo" className="flex items-center gap-2 font-serif text-2xl font-semibold text-primary">
        <Sparkles size={20} className="shrink-0 text-gold-ink" /> Sugestões da semana
      </h2>
      <p className="mt-1 text-sm text-ink-muted">
        {compact
          ? "Comece pela missa sugerida pela coordenação e ajuste o que quiser."
          : "Missas sugeridas pela coordenação para esta semana. Crie a sua com base nelas e ajuste o que quiser."}
      </p>
      <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-2">
        {list.map((m) => (
          <SuggestionCard key={m.id} mass={m} />
        ))}
      </div>
    </section>
  );
}

function SuggestionCard({ mass }: { mass: Mass & { ownerName: string } }) {
  const router = useRouter();
  const { userId } = useSession();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const ids = useMemo(() => mass.slots.flatMap((s) => s.items.map((i) => i.songId)), [mass.slots]);
  const { songs, byId, pending } = useSongMap(ids, open);
  const color = mass.season ? SEASON_STYLE[mass.season].color : "var(--border)";
  const count = mass.slots.reduce((n, s) => n + s.items.length, 0);
  const mine = mass.ownerId === userId;

  const useAsBase = () => {
    const copy = massFromSuggestion(mass);
    toast("Missa criada com base na sugestão. Agora é só ajustar.");
    router.push(massEditUrl(copy.id));
  };

  // O roteiro da equipe de liturgia (folheto de 1 página), quando o admin montou.
  const downloadScript = async () => {
    if (!mass.script) return;
    setBusy(true);
    try {
      const { downloadScriptPdf, scriptSongMap } = await import("@/lib/scriptPdf");
      await downloadScriptPdf(mass, mass.script, await scriptSongMap(mass));
    } catch {
      toast("Não foi possível gerar o roteiro agora.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <article className="flex rounded-[10px] border border-border bg-surface shadow-card">
      <span aria-hidden className="w-1 shrink-0 rounded-l-[10px]" style={{ background: color }} />
      <div className="min-w-0 flex-1 p-4">
        <h3 className="font-serif text-xl font-semibold leading-tight">{mass.name || "Missa sugerida"}</h3>
        <p className="mt-1 text-sm text-ink-muted">
          <span className="first-letter:uppercase">{formatDateLong(mass.date)}</span>
          {mass.time && ` · ${hour(mass.time)}`}
          {mass.season && ` · ${SEASON_STYLE[mass.season].label}`}
          {mass.year && ` · Ano ${mass.year}`}
        </p>
        <p className="mt-1 text-sm text-ink-muted">
          Sugerida por <strong className="font-medium text-ink">{mine ? "você" : mass.ownerName}</strong> · {count} {count === 1 ? "canto" : "cantos"}
        </p>

        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          className="mt-2 inline-flex min-h-11 items-center gap-1 text-sm font-medium text-primary hover:underline"
        >
          <ChevronDown size={16} className={`transition-transform ${open ? "rotate-180" : ""}`} /> {open ? "Esconder os cantos" : "Ver os cantos"}
        </button>
        {open && (
          <ol className="mt-1 space-y-1.5 text-sm">
            {mass.slots
              .filter((s) => s.items.length)
              .map((s) => (
                <li key={s.id} className="grid grid-cols-[minmax(0,7.5rem)_1fr] gap-2">
                  <span className="text-ink-muted">{s.label}</span>
                  <span className="min-w-0">
                    {s.items.map((i) => {
                      const song = byId.get(i.songId);
                      return (
                        <span key={i.songId} className="block">
                          {song ? (
                            <>
                              {song.number != null && <span className="mr-1 text-gold-ink [font-variant-numeric:lining-nums]">{formatNumber(song.number)}</span>}
                              {song.title}
                            </>
                          ) : !songs || pending(i.songId) ? (
                            "Carregando…"
                          ) : (
                            "Canto ainda não publicado no repertório"
                          )}
                        </span>
                      );
                    })}
                  </span>
                </li>
              ))}
            {count === 0 && <li className="text-ink-muted">Ainda sem cantos.</li>}
          </ol>
        )}

        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={useAsBase}
            className="inline-flex min-h-11 items-center gap-2 rounded-[10px] bg-primary-solid px-4 text-sm font-semibold text-[#FFFDF8] hover:bg-primary-hover"
          >
            <CopyPlus size={16} /> Usar como base
          </button>
          {mass.script && (
            <button
              type="button"
              onClick={downloadScript}
              disabled={busy}
              className="inline-flex min-h-11 items-center gap-2 rounded-[10px] border border-primary px-4 text-sm font-semibold text-primary hover:bg-primary-soft disabled:opacity-60"
            >
              {busy ? <Loader2 size={16} className="animate-spin" /> : <FileDown size={16} />} Roteiro (PDF)
            </button>
          )}
          {mine && (
            <Link
              href={massEditUrl(mass.id)}
              className="inline-flex min-h-11 items-center gap-2 rounded-[10px] border border-primary px-4 text-sm font-semibold text-primary hover:bg-primary-soft"
            >
              <Pencil size={16} /> Editar sugestão
            </Link>
          )}
        </div>
      </div>
    </article>
  );
}
