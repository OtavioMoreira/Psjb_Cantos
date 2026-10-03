// Conversão do formato da API (cantos com flags) para o formato do site (4 eixos).
// Puro e sem dependências: usado no build (next.config, lib/data) e nos testes.

import type { Category, MomentId, SeasonId, Song, Taxonomy, YearId } from "./types";

export type FlagGroup = "momento" | "tempo" | "ano" | "tema" | "outro";

export interface ApiFlag {
  id: number;
  group: FlagGroup;
  slug: string;
  name: string;
  color: string | null;
  position: number;
}

export interface ApiSong {
  id: number;
  number: number | null;
  slug: string;
  title: string;
  composer: string | null;
  key: string | null;
  lyrics?: string;
  media: { audio: string | null; audiomack: string | null; cifraPdf: string | null; partituraPdf: string | null };
  flags: Pick<ApiFlag, "id" | "group" | "slug" | "name" | "color">[];
  active: boolean;
}

const byPosition = (a: ApiFlag, b: ApiFlag) => a.position - b.position || a.name.localeCompare(b.name, "pt-BR");
const toCategory = (f: ApiFlag, i: number): Category => ({ id: f.slug, label: f.name, order: f.position || i + 1, ...(f.color ? { color: f.color } : {}) });

/** Flags da API → taxonomia do site. "outro" entra junto com os temas (o site tem 4 eixos). */
export function toTaxonomy(flags: ApiFlag[]): Taxonomy {
  const of = (...groups: FlagGroup[]) => flags.filter((f) => groups.includes(f.group)).sort(byPosition).map(toCategory);
  return {
    moments: of("momento") as Taxonomy["moments"],
    seasons: of("tempo") as Taxonomy["seasons"],
    years: of("ano") as Taxonomy["years"],
    themes: of("tema", "outro"),
  };
}

/** Canto da API → canto do site (flags viram momentos, tempos, anos e temas). */
export function toSong(s: ApiSong): Song {
  const slugs = (...groups: FlagGroup[]) => s.flags.filter((f) => groups.includes(f.group)).map((f) => f.slug);
  return {
    id: s.id,
    number: s.number,
    slug: s.slug,
    title: s.title,
    composer: s.composer,
    key: s.key,
    moments: slugs("momento") as MomentId[],
    seasons: slugs("tempo") as SeasonId[],
    years: slugs("ano") as YearId[],
    themes: slugs("tema", "outro"),
    media: s.media,
    lyrics: s.lyrics ?? "",
  };
}
