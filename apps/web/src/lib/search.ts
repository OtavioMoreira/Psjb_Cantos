import type { SongSummary } from "./types";

export function normalize(s: string) {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

export interface Filters {
  q: string;
  momento: string[];
  tempo: string[];
  ano: string[];
  tema: string[];
  tem: string[];
  ordem: "numero" | "titulo";
}

export const FILTER_KEYS = ["momento", "tempo", "ano", "tema", "tem"] as const;
export type FilterKey = (typeof FILTER_KEYS)[number];

export function parseFilters(sp: URLSearchParams): Filters {
  const list = (k: string) => (sp.get(k) ?? "").split(",").filter(Boolean);
  return {
    q: sp.get("q") ?? "",
    momento: list("momento"),
    tempo: list("tempo"),
    ano: list("ano"),
    tema: list("tema"),
    tem: list("tem"),
    ordem: sp.get("ordem") === "titulo" ? "titulo" : "numero",
  };
}

export function filtersToQuery(f: Filters) {
  const sp = new URLSearchParams();
  if (f.q) sp.set("q", f.q);
  for (const k of FILTER_KEYS) if (f[k].length) sp.set(k, f[k].join(","));
  if (f.ordem !== "numero") sp.set("ordem", f.ordem);
  return sp.toString();
}

const FIELD: Record<FilterKey, (s: SongSummary) => string[]> = {
  momento: (s) => s.moments,
  tempo: (s) => s.seasons,
  ano: (s) => s.years,
  tema: (s) => s.themes,
  tem: (s) => Object.entries(s.has).filter(([, v]) => v).map(([k]) => k),
};

/** OR dentro do mesmo eixo, AND entre eixos. `skip` ignora um eixo (para contagens). */
export function matchesFilters(s: SongSummary, f: Filters, skip?: FilterKey) {
  return FILTER_KEYS.every((k) => {
    if (k === skip || f[k].length === 0) return true;
    const values = FIELD[k](s);
    return f[k].some((v) => values.includes(v));
  });
}

export function countFor(songs: SongSummary[], f: Filters, key: FilterKey, value: string) {
  let n = 0;
  for (const s of songs) if (matchesFilters(s, f, key) && FIELD[key](s).includes(value)) n++;
  return n;
}

export interface SearchHit {
  score: number;
  snippet?: string;
}

/** Busca sem acentos: número (peso 10) > título (5) > compositor (2) > letra (1). */
export function scoreSong(s: SongSummary, q: string, fullText?: string): SearchHit | null {
  const nq = normalize(q.trim());
  if (!nq) return { score: 0 };
  const num = nq.replace(/^(n[ºo°]?\s*)/, "");
  if (/^\d+$/.test(num) && s.number === Number(num)) return { score: 100 };
  const terms = nq.split(/\s+/);
  const title = normalize(s.title);
  const composer = normalize(s.composer ?? "");
  const text = normalize(fullText ?? s.excerpt);
  let score = 0;
  for (const t of terms) {
    if (title.includes(t)) score += title.startsWith(t) ? 6 : 5;
    else if (composer.includes(t)) score += 2;
    else if (text.includes(t)) score += 1;
    else return null;
  }
  let snippet: string | undefined;
  if (!terms.every((t) => title.includes(t)) && fullText) {
    const i = text.indexOf(terms[0]);
    if (i >= 0) {
      const start = Math.max(0, i - 35);
      snippet = (start > 0 ? "…" : "") + fullText.slice(start, start + 90).trim() + "…";
    }
  }
  return { score, snippet };
}
