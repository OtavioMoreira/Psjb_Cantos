import { describe, expect, it } from "vitest";
import { countFor, filtersToQuery, matchesFilters, normalize, parseFilters, scoreSong, type Filters } from "@/lib/search";
import type { SongSummary } from "@/lib/types";

const song = (over: Partial<SongSummary>): SongSummary => ({
  id: 1,
  number: null,
  slug: "x",
  title: "Sem título",
  composer: null,
  key: null,
  moments: [],
  seasons: [],
  years: [],
  themes: [],
  has: { cifra: false, partitura: false, audio: false },
  excerpt: "",
  ...over,
});

const noFilters: Filters = { q: "", momento: [], tempo: [], ano: [], tema: [], tem: [], ordem: "numero" };

describe("Busca sem acento (regra §4)", () => {
  it("normalize tira acento e caixa", () => {
    expect(normalize("São JOSÉ, Coração")).toBe("sao jose, coracao");
  });

  const feliz = song({ number: 1, title: "A feliz espera", composer: "Fr. Luiz Turra", excerpt: "Vem, Senhor" });

  it("número exato vai para o topo (45, 045 e Nº 45)", () => {
    const s45 = song({ number: 45, title: "Outro" });
    for (const q of ["45", "045", "nº 45", "n 45"]) expect(scoreSong(s45, q)?.score).toBe(100);
    expect(scoreSong(s45, "4")).toBeNull();
  });

  it("título vale mais que autor, que vale mais que letra; começo do título vale mais", () => {
    expect(scoreSong(feliz, "feliz")?.score).toBe(5);
    expect(scoreSong(feliz, "a feliz")?.score).toBe(11); // "a" no começo (6) + "feliz" (5)
    expect(scoreSong(feliz, "turra")?.score).toBe(2);
    expect(scoreSong(feliz, "senhor")?.score).toBe(1);
  });

  it("todos os termos precisam aparecer", () => {
    expect(scoreSong(feliz, "feliz natal")).toBeNull();
    expect(scoreSong(feliz, "FELIZ espéra")?.score).toBeGreaterThan(0);
  });

  it("achado na letra completa traz um trecho", () => {
    const hit = scoreSong(feliz, "aleluia", "Primeira estrofe com muitas palavras antes de chegar ao aleluia final do canto");
    expect(hit?.snippet).toMatch(/aleluia/);
  });

  it("busca vazia não filtra nada", () => {
    expect(scoreSong(feliz, "   ")).toEqual({ score: 0 });
  });
});

describe("Filtros (OU no mesmo eixo, E entre eixos) e URL", () => {
  const songs = [
    song({ id: 1, moments: ["entrada"], seasons: ["advento"] }),
    song({ id: 2, moments: ["comunhao"], seasons: ["natal"] }),
    song({ id: 3, moments: ["entrada"], seasons: ["natal"], has: { cifra: true, partitura: false, audio: true } }),
  ];
  const ids = (f: Partial<Filters>) => songs.filter((s) => matchesFilters(s, { ...noFilters, ...f })).map((s) => s.id);

  it("combina como no site e na API", () => {
    expect(ids({ tempo: ["advento", "natal"] })).toEqual([1, 2, 3]);
    expect(ids({ tempo: ["natal"], momento: ["entrada"] })).toEqual([3]);
    expect(ids({ tem: ["audio"] })).toEqual([3]);
    expect(ids({})).toEqual([1, 2, 3]);
  });

  it("contagem ao vivo de cada opção ignora o próprio eixo", () => {
    const f = { ...noFilters, tempo: ["natal"] };
    expect(countFor(songs, f, "tempo", "advento")).toBe(1);
    expect(countFor(songs, f, "momento", "entrada")).toBe(1);
  });

  it("estado vai e volta da URL", () => {
    const f: Filters = { ...noFilters, q: "são", momento: ["entrada", "saida"], ano: ["A"], ordem: "titulo" };
    const qs = filtersToQuery(f);
    expect(qs).toBe("q=s%C3%A3o&momento=entrada%2Csaida&ano=A&ordem=titulo");
    expect(parseFilters(new URLSearchParams(qs))).toEqual(f);
    expect(parseFilters(new URLSearchParams("ordem=hack&tempo=,,"))).toEqual(noFilters);
  });
});
