"use client";

import { useMemo, useState } from "react";
import { Check, Eye, Search, X } from "lucide-react";
import type { Mass, MassSlot, Song } from "@/lib/types";
import { SEASON_STYLE, formatNumber } from "@/lib/liturgy";
import { label } from "@/lib/labels";
import { normalize } from "@/lib/search";
import { lyricsOnly } from "@/lib/chords";

export function SlotPicker({
  slot,
  mass,
  songs,
  onPick,
  onPreview,
  onClose,
}: {
  slot: MassSlot;
  mass: Mass;
  songs: Song[];
  onPick: (song: Song) => void;
  onPreview: (song: Song) => void;
  onClose: () => void;
}) {
  const [q, setQ] = useState("");
  const [allMoments, setAllMoments] = useState(slot.moment === "extra");
  const [useSeason, setUseSeason] = useState(Boolean(mass.season));
  const yearMatters = slot.moment === "salmo" || slot.moment === "aclamacao";
  const [useYear, setUseYear] = useState(yearMatters && Boolean(mass.year));

  const text = useMemo(() => new Map(songs.map((s) => [s.id, normalize(`${s.number ?? ""} ${s.title} ${s.composer ?? ""} ${lyricsOnly(s.lyrics)}`)])), [songs]);

  const list = useMemo(() => {
    const terms = normalize(q.trim()).split(/\s+/).filter(Boolean);
    return songs
      .filter((s) => allMoments || slot.moment === "extra" || s.moments.includes(slot.moment))
      // Cantos sem tempo/ano definidos servem para qualquer tempo/ano.
      .filter((s) => !useSeason || !mass.season || s.seasons.length === 0 || s.seasons.includes(mass.season))
      .filter((s) => !useYear || !mass.year || s.years.length === 0 || s.years.includes(mass.year))
      .filter((s) => terms.every((t) => text.get(s.id)!.includes(t)))
      .sort((a, b) => {
        // Cantos do tempo aparecem primeiro
        const sa = mass.season && a.seasons.includes(mass.season) ? 0 : 1;
        const sb = mass.season && b.seasons.includes(mass.season) ? 0 : 1;
        return sa - sb || (a.number ?? 9999) - (b.number ?? 9999);
      });
  }, [songs, q, allMoments, useSeason, useYear, slot.moment, mass.season, mass.year, text]);

  const chosen = new Set(slot.items.map((i) => i.songId));

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-ink-muted">Escolher para</p>
          <p className="font-serif text-2xl font-semibold text-primary">{slot.label}</p>
        </div>
        <button aria-label="Fechar seletor" onClick={onClose} className="grid h-10 w-10 place-items-center rounded-full hover:bg-surface-2">
          <X size={22} />
        </button>
      </div>
      <div className="space-y-3 border-b border-border px-4 py-3">
        <label className="relative block">
          <span className="sr-only">Buscar canto</span>
          <Search size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" />
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={`Buscar em ${allMoments ? "todos os cantos" : slot.label}…`}
            className="h-11 w-full rounded-[10px] border border-border bg-surface pl-10 pr-3 outline-none focus:border-primary focus:ring-2 focus:ring-gold/40"
          />
        </label>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          {!allMoments && slot.moment !== "extra" && (
            <Chip onRemove={() => setAllMoments(true)} text={label(slot.moment)} />
          )}
          {useSeason && mass.season && (
            <Chip onRemove={() => setUseSeason(false)} color={SEASON_STYLE[mass.season].color} text={SEASON_STYLE[mass.season].label} />
          )}
          {useYear && mass.year && <Chip onRemove={() => setUseYear(false)} text={`Ano ${mass.year}`} />}
          {slot.moment !== "extra" && (
            <label className="ml-auto flex items-center gap-2 text-ink-muted">
              <input type="checkbox" checked={allMoments} onChange={(e) => setAllMoments(e.target.checked)} className="h-4 w-4 accent-[var(--primary-solid)]" />
              Todos os momentos
            </label>
          )}
        </div>
        <p className="text-xs text-ink-muted" aria-live="polite">
          {list.length} {list.length === 1 ? "canto" : "cantos"}
        </p>
      </div>
      <ul className="flex-1 space-y-2 overflow-y-auto p-3">
        {list.map((s) => {
          const on = chosen.has(s.id);
          return (
            <li key={s.id} className={`flex items-center gap-3 rounded-[10px] border p-3 ${on ? "border-primary bg-primary-soft" : "border-border bg-surface"}`}>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-gold-ink">
                  {formatNumber(s.number)}
                  {s.key && <span className="ml-2 font-normal text-ink-muted">Tom {s.key}</span>}
                </p>
                <p className="truncate font-serif text-lg font-semibold leading-tight">{s.title}</p>
                <p className="truncate text-xs text-ink-muted">
                  {[...s.moments.map(label), ...s.seasons.map(label)].join(" · ")}
                </p>
              </div>
              <button aria-label={`Ver letra de ${s.title}`} onClick={() => onPreview(s)} className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-ink-muted hover:bg-surface-2 hover:text-primary">
                <Eye size={18} />
              </button>
              <button
                onClick={() => onPick(s)}
                disabled={on}
                className="flex h-10 shrink-0 items-center gap-1.5 rounded-[10px] bg-primary-solid px-3 text-sm font-semibold text-[#FFFDF8] hover:bg-primary-hover disabled:bg-transparent disabled:text-primary"
              >
                {on ? (
                  <>
                    <Check size={16} /> Escolhido
                  </>
                ) : (
                  "Escolher"
                )}
              </button>
            </li>
          );
        })}
        {list.length === 0 && (
          <li className="px-2 py-10 text-center text-ink-muted">
            Nenhum canto com esses filtros. Remova um filtro ou marque “Todos os momentos”.
          </li>
        )}
      </ul>
    </div>
  );
}

function Chip({ text, onRemove, color }: { text: string; onRemove: () => void; color?: string }) {
  return (
    <button onClick={onRemove} className="flex h-8 items-center gap-1.5 rounded-full border border-primary bg-primary-soft pl-3 pr-2 text-primary" aria-label={`Remover filtro ${text}`}>
      {color && <span className="h-2 w-2 rounded-full" style={{ background: color }} />}
      {text} <X size={14} />
    </button>
  );
}
