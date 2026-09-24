"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Check, Search, SlidersHorizontal, X } from "lucide-react";
import type { SongSummary } from "@/lib/types";
import {
  FILTER_KEYS,
  type FilterKey,
  type Filters,
  countFor,
  filtersToQuery,
  matchesFilters,
  normalize,
  parseFilters,
  scoreSong,
} from "@/lib/search";
import { taxonomy, label } from "@/lib/labels";
import { SEASON_STYLE } from "@/lib/liturgy";
import { lyricsOnly } from "@/lib/chords";
import { useSongIndex } from "@/lib/useSongIndex";
import { SongCard } from "./SongCard";
import { Cross } from "@/components/ui/Ornament";
import { Button } from "@/components/ui/Button";

const GROUPS: { key: FilterKey; title: string; options: { id: string; label: string; color?: string }[] }[] = [
  { key: "momento", title: "Momento da Missa", options: taxonomy.moments },
  {
    key: "tempo",
    title: "Tempo litúrgico",
    options: taxonomy.seasons.map((s) => ({ ...s, color: SEASON_STYLE[s.id].color })),
  },
  { key: "ano", title: "Ano litúrgico", options: taxonomy.years },
  { key: "tema", title: "Tema", options: taxonomy.themes },
  {
    key: "tem",
    title: "Recursos",
    options: [
      { id: "cifra", label: "Com cifra" },
      { id: "partitura", label: "Com partitura" },
      { id: "audio", label: "Com áudio" },
    ],
  },
];

const chipLabel = (key: FilterKey, id: string) =>
  key === "tem" ? GROUPS[4].options.find((o) => o.id === id)?.label ?? id : key === "ano" ? `Ano ${id}` : label(id);

const PAGE = 30;

export function SongBrowser({ songs }: { songs: SongSummary[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [, startTransition] = useTransition();
  const [filters, setFilters] = useState<Filters>(() => parseFilters(new URLSearchParams(params.toString())));
  const [drawer, setDrawer] = useState(false);
  const [limit, setLimit] = useState(PAGE);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (params.get("foco")) inputRef.current?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sincroniza o estado com a URL (compartilhável), sem rolar a página.
  const written = useRef(filtersToQuery(filters));
  useEffect(() => {
    const qs = filtersToQuery(filters);
    if (qs === written.current) return;
    const t = setTimeout(() => {
      written.current = qs;
      startTransition(() => router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false }));
    }, 150);
    return () => clearTimeout(t);
  }, [filters, pathname, router]);

  // Navegação externa (ex.: link do menu "/cantos?tempo=advento") redefine os filtros.
  const paramsKey = params.toString();
  useEffect(() => {
    const incoming = parseFilters(new URLSearchParams(paramsKey));
    const qs = filtersToQuery(incoming);
    if (qs !== written.current) {
      written.current = qs;
      setFilters(incoming);
      setLimit(PAGE);
    }
  }, [paramsKey]);

  // Busca na letra: o índice completo só é baixado quando a pessoa digita.
  const wantsFullText = filters.q.trim().length >= 3 && !/^\d+$/.test(filters.q.trim());
  const { songs: full } = useSongIndex(wantsFullText);
  const fullText = useMemo(
    () => (full ? new Map(full.map((s) => [s.id, lyricsOnly(s.lyrics).replace(/\s+/g, " ")])) : null),
    [full],
  );

  const terms = useMemo(() => normalize(filters.q.trim()).split(/\s+/).filter((t) => t.length > 1), [filters.q]);

  const results = useMemo(() => {
    const out: { song: SongSummary; score: number; snippet?: string }[] = [];
    for (const s of songs) {
      if (!matchesFilters(s, filters)) continue;
      const hit = scoreSong(s, filters.q, fullText?.get(s.id));
      if (hit) out.push({ song: s, ...hit });
    }
    const byNumber = (a: SongSummary, b: SongSummary) =>
      (a.number ?? 9999) - (b.number ?? 9999) || a.title.localeCompare(b.title, "pt-BR");
    out.sort((a, b) =>
      filters.q.trim()
        ? b.score - a.score || byNumber(a.song, b.song)
        : filters.ordem === "titulo"
          ? a.song.title.localeCompare(b.song.title, "pt-BR")
          : byNumber(a.song, b.song),
    );
    return out;
  }, [songs, filters, fullText]);

  const activeChips = FILTER_KEYS.flatMap((k) => filters[k].map((id) => ({ key: k, id })));
  const activeCount = activeChips.length;

  const update = (patch: Partial<Filters>) => {
    setLimit(PAGE);
    setFilters((f) => ({ ...f, ...patch }));
  };
  const toggle = (key: FilterKey, id: string) =>
    update({ [key]: filters[key].includes(id) ? filters[key].filter((v) => v !== id) : [...filters[key], id] });
  const clearAll = () => update({ momento: [], tempo: [], ano: [], tema: [], tem: [] });

  const filterPanel = (
    <div className="space-y-6">
      {GROUPS.map((g) => (
        <fieldset key={g.key}>
          <legend className="mb-2 text-xs font-semibold uppercase tracking-[0.08em] text-ink-muted">{g.title}</legend>
          {g.key === "ano" ? (
            <div className="flex gap-2">
              {g.options.map((o) => {
                const on = filters.ano.includes(o.id);
                return (
                  <button
                    key={o.id}
                    aria-pressed={on}
                    onClick={() => toggle("ano", o.id)}
                    className="h-10 flex-1 rounded-[10px] border border-border bg-surface font-serif text-lg font-semibold aria-pressed:border-primary aria-pressed:bg-primary-soft aria-pressed:text-primary"
                  >
                    {o.id}
                  </button>
                );
              })}
            </div>
          ) : (
            <ul className="space-y-0.5">
              {g.options.map((o) => {
                const on = filters[g.key].includes(o.id);
                const n = countFor(songs, filters, g.key, o.id);
                return (
                  <li key={o.id}>
                    <label className={`flex min-h-10 cursor-pointer items-center gap-3 rounded-md px-2 text-[15px] hover:bg-surface-2 ${n === 0 && !on ? "text-ink-muted" : ""}`}>
                      <input type="checkbox" checked={on} onChange={() => toggle(g.key, o.id)} className="peer sr-only" />
                      <span className="grid h-5 w-5 shrink-0 place-items-center rounded-[5px] border border-border bg-surface text-[#FFFDF8] peer-checked:border-primary-solid peer-checked:bg-primary-solid peer-focus-visible:outline-2 peer-focus-visible:outline-gold">
                        {on && <Check size={14} strokeWidth={3} />}
                      </span>
                      {o.color && <span className="h-2.5 w-2.5 rounded-full" style={{ background: o.color }} />}
                      <span className="flex-1">{o.label}</span>
                      <span className="text-xs tabular-nums text-ink-muted">{n}</span>
                    </label>
                  </li>
                );
              })}
            </ul>
          )}
        </fieldset>
      ))}
    </div>
  );

  return (
    <div className="lg:grid lg:grid-cols-[260px_1fr] lg:gap-10">
      <aside aria-label="Filtros" className="hidden lg:block">
        <div className="sticky top-[96px] max-h-[calc(100vh-110px)] overflow-y-auto pb-8 pr-2">{filterPanel}</div>
      </aside>

      <div className="min-w-0">
        <div className="sticky top-14 z-20 -mx-4 bg-bg/95 px-4 pb-3 pt-2 backdrop-blur sm:top-[72px] sm:mx-0 sm:px-0">
          <div role="search" className="flex gap-2">
            <label className="relative flex-1">
              <span className="sr-only">Buscar cantos</span>
              <Search size={20} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink-muted" />
              <input
                ref={inputRef}
                id="busca-cantos"
                type="search"
                autoComplete="off"
                value={filters.q}
                onChange={(e) => update({ q: e.target.value })}
                placeholder="Busque por título, número ou trecho da letra"
                className="h-12 w-full rounded-[10px] border border-border bg-surface pl-12 pr-10 text-base shadow-card outline-none transition placeholder:text-ink-muted focus:border-primary focus:ring-2 focus:ring-gold/50 [&::-webkit-search-cancel-button]:hidden"
              />
              {filters.q && (
                <button aria-label="Limpar busca" onClick={() => update({ q: "" })} className="absolute right-2 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-full text-ink-muted hover:bg-surface-2">
                  <X size={18} />
                </button>
              )}
            </label>
            <button
              onClick={() => setDrawer(true)}
              className="flex h-12 items-center gap-2 rounded-[10px] border border-border bg-surface px-4 text-sm font-semibold lg:hidden"
            >
              <SlidersHorizontal size={18} /> Filtros
              {activeCount > 0 && <span className="grid h-5 min-w-5 place-items-center rounded-full bg-primary-solid px-1 text-xs text-[#FFFDF8]">{activeCount}</span>}
            </button>
          </div>

          <div className="mt-3 flex items-center gap-2">
            <div className="scrollbar-none flex flex-1 items-center gap-2 overflow-x-auto">
              <p aria-live="polite" className="shrink-0 text-sm font-semibold text-ink">
                {results.length === 0 ? "Nenhum canto" : results.length === 1 ? "1 canto" : `${results.length} cantos`}
              </p>
              {activeChips.map(({ key, id }) => (
                <button
                  key={key + id}
                  onClick={() => toggle(key, id)}
                  aria-label={`Remover filtro ${chipLabel(key, id)}`}
                  className="animate-fade-in flex h-8 shrink-0 items-center gap-1.5 rounded-full border border-primary bg-primary-soft pl-3 pr-2 text-sm text-primary"
                >
                  {key === "tempo" && <span className="h-2 w-2 rounded-full" style={{ background: SEASON_STYLE[id as keyof typeof SEASON_STYLE]?.color }} />}
                  {chipLabel(key, id)} <X size={14} />
                </button>
              ))}
              {activeCount >= 2 && (
                <button onClick={clearAll} className="shrink-0 px-2 text-sm font-medium text-primary underline underline-offset-2">
                  Limpar tudo
                </button>
              )}
            </div>
            {!filters.q && (
              <label className="flex shrink-0 items-center gap-2 text-sm text-ink-muted">
                <span className="hidden sm:inline">Ordenar:</span>
                <select
                  value={filters.ordem}
                  onChange={(e) => update({ ordem: e.target.value as Filters["ordem"] })}
                  className="h-8 rounded-md border border-border bg-surface px-2 text-sm text-ink"
                >
                  <option value="numero">Número</option>
                  <option value="titulo">Título A–Z</option>
                </select>
              </label>
            )}
          </div>
        </div>

        {results.length === 0 ? (
          <div className="flex flex-col items-center py-16 text-center">
            <Cross size={20} className="text-gold" />
            <p className="mt-4 font-serif text-2xl font-semibold">
              Nenhum canto encontrado{filters.q ? ` para “${filters.q}”` : ""}.
            </p>
            <p className="mt-2 text-ink-muted">Tente sem acentos, com menos palavras ou remova algum filtro.</p>
            <div className="mt-6 flex flex-wrap justify-center gap-2">
              {activeChips.map(({ key, id }) => (
                <Button key={key + id} variant="secondary" onClick={() => toggle(key, id)}>
                  Remover “{chipLabel(key, id)}”
                </Button>
              ))}
              {(filters.q || activeCount > 0) && (
                <Button variant="ghost" onClick={() => update({ q: "", momento: [], tempo: [], ano: [], tema: [], tem: [] })}>
                  Limpar tudo
                </Button>
              )}
            </div>
          </div>
        ) : (
          <>
            <ul className="mt-2 grid grid-cols-1 gap-3 xl:grid-cols-2">
              {results.slice(0, limit).map(({ song, snippet }) => (
                <li key={song.id}>
                  <SongCard song={song} terms={terms} snippet={snippet} />
                </li>
              ))}
            </ul>
            {results.length > limit && (
              <div className="mt-8 flex justify-center">
                <Button variant="secondary" onClick={() => setLimit((l) => l + PAGE)}>
                  Carregar mais ({results.length - limit} restantes)
                </Button>
              </div>
            )}
          </>
        )}
      </div>

      {drawer && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Filtros">
          <div className="absolute inset-0 bg-black/40" onClick={() => setDrawer(false)} />
          <div className="animate-fade-in absolute inset-x-0 bottom-0 flex max-h-[90vh] flex-col rounded-t-[16px] bg-bg shadow-overlay sm:inset-y-0 sm:left-auto sm:right-0 sm:max-h-none sm:w-[380px] sm:rounded-none">
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <h2 className="font-serif text-2xl font-semibold">Filtros</h2>
              <button aria-label="Fechar filtros" onClick={() => setDrawer(false)} className="grid h-10 w-10 place-items-center rounded-full hover:bg-surface-2">
                <X size={22} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-4">{filterPanel}</div>
            <div className="flex gap-3 border-t border-border p-4">
              <Button variant="ghost" onClick={clearAll} className="flex-1">
                Limpar
              </Button>
              <Button onClick={() => setDrawer(false)} className="flex-[2]">
                Ver {results.length} {results.length === 1 ? "canto" : "cantos"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
