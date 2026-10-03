import { describe, expect, it } from "vitest";
import { toSong, toTaxonomy, type ApiFlag, type ApiSong } from "@/lib/apiSongs";
import { slugify } from "@/lib/slug";

const flag = (id: number, group: ApiFlag["group"], slug: string, name: string, position = 0, color: string | null = null): ApiFlag => ({ id, group, slug, name, position, color });

describe("Flags da API → taxonomia do site", () => {
  const flags = [
    flag(1, "momento", "saida", "Saída", 12),
    flag(2, "momento", "entrada", "Entrada", 2),
    flag(3, "tempo", "advento", "Advento", 1, "#5B2C83"),
    flag(4, "ano", "B", "Ano B", 2),
    flag(5, "ano", "A", "Ano A", 1),
    flag(6, "tema", "paz", "Paz"),
    flag(7, "outro", "festa-junina", "Festa junina"),
  ];

  it("separa pelos 4 eixos, na ordem da posição; 'outro' entra nos temas", () => {
    const t = toTaxonomy(flags);
    expect(t.moments.map((c) => c.id)).toEqual(["entrada", "saida"]);
    expect(t.years.map((c) => c.id)).toEqual(["A", "B"]);
    expect(t.seasons).toEqual([{ id: "advento", label: "Advento", order: 1, color: "#5B2C83" }]);
    expect(t.themes.map((c) => c.label).sort()).toEqual(["Festa junina", "Paz"]);
  });

  it("canto: flags viram momentos, tempos, anos e temas; sem letra vira texto vazio", () => {
    const api: ApiSong = {
      id: 39,
      number: 1,
      slug: "001-a-feliz-espera",
      title: "A feliz espera",
      composer: null,
      key: "G",
      media: { audio: null, audiomack: null, cifraPdf: null, partituraPdf: null },
      flags: flags.filter((f) => [2, 3, 4, 5, 7].includes(f.id)),
      active: true,
    };
    expect(toSong(api)).toMatchObject({
      id: 39,
      moments: ["entrada"],
      seasons: ["advento"],
      years: ["B", "A"],
      themes: ["festa-junina"],
      lyrics: "",
    });
  });
});

describe("slugify", () => {
  it.each([
    ["Tempo Comum", false, "tempo-comum"],
    ["Ação de Graças!", false, "acao-de-gracas"],
    ["Ano A", true, "Ano-A"],
    ["  --  ", false, ""],
  ])("%s → %s", (text, keep, out) => {
    expect(slugify(text, keep)).toBe(out);
  });
});
