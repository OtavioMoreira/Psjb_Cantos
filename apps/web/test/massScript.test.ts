import { describe, expect, it } from "vitest";
import { defaultScript, parseRich, plain, songRefs, weekendLabel } from "@/lib/massScript";
import type { Mass, Song } from "@/lib/types";

const song = (id: number, number: number | null, title: string) => ({ id, number, title }) as Song;
const byId = new Map([song(1, 6, "É tempo de advento"), song(2, 1, "A feliz espera"), song(3, null, "1º Domingo do Advento, Ano B - Salmo 79"), song(4, 117, "A nossa oferta")].map((s) => [s.id, s]));

const mass: Mass = {
  id: "m",
  name: "1º Domingo do Advento — Missa das 10h",
  date: "2026-11-29",
  time: "10:00",
  season: "advento",
  year: "B",
  updatedAt: "",
  slots: [
    { id: "e", moment: "entrada", label: "Entrada", items: [{ songId: 1, transpose: 0 }, { songId: 2, transpose: 0 }] },
    { id: "s", moment: "salmo", label: "Salmo", items: [{ songId: 3, transpose: 0 }] },
    { id: "o", moment: "ofertorio", label: "Ofertório", items: [{ songId: 4, transpose: 0 }] },
    { id: "c", moment: "cordeiro", label: "Cordeiro", items: [] },
  ],
};

describe("Roteiro da celebração", () => {
  it("domingo vira 'sábado e domingo' (a missa da véspera), virando o mês quando precisa", () => {
    expect(weekendLabel("2026-11-29")).toBe("28 e 29 de novembro de 2026");
    expect(weekendLabel("2026-11-01")).toBe("31 de outubro e 1 de novembro de 2026");
    expect(weekendLabel("2026-11-26")).toBe("26 de novembro de 2026"); // quinta: só a data
  });

  it("modelo padrão: título com as datas, cor litúrgica e só os momentos que a missa tem", () => {
    const s = defaultScript(mass);
    expect(s.title).toBe("1º DOMINGO DO ADVENTO – 28 E 29 DE NOVEMBRO DE 2026");
    expect(s.notes).toContain("Cor litúrgica: ROXA");
    const titles = s.items.map((i) => i.title);
    expect(titles).toContain("Canto de abertura");
    expect(titles).not.toContain("Glória"); // a missa não tem Glória (Advento)
    expect(titles.indexOf("Salmo")).toBeLessThan(titles.indexOf("Apresentação dos dons"));
    expect(s.items.find((i) => i.title === "Preces da Comunidade")?.boxed).toBe(true);
  });

  it("números dos cantos com 2 dígitos, na ordem do momento; sem número, entra o título", () => {
    const s = defaultScript(mass);
    const refs = (title: string) => songRefs(s.items.find((i) => i.title === title)!, mass, byId);
    expect(refs("Canto de abertura")).toBe("06, 01");
    expect(refs("Apresentação dos dons")).toBe("117");
    expect(refs("Salmo")).toBe("1º Domingo do Advento, Ano B - Salmo 79");
    expect(refs("Cordeiro de Deus")).toBe("");
  });

  it("marcação: **negrito**, *instrução*, Padre: em vermelho, R.: inteira em negrito", () => {
    expect(parseRich("Texto **forte** e *faça isto* fim")).toEqual([
      { text: "Texto ", bold: false },
      { text: "forte", bold: true },
      { text: " e ", bold: false },
      { text: "faça isto", cue: true },
      { text: " fim", bold: false },
    ]);
    expect(parseRich("Padre: Oremos")[0]).toEqual({ text: "Padre:", cue: true });
    expect(parseRich("R.: Vinde, Senhor Jesus!").every((r) => r.bold)).toBe(true);
    expect(plain("Por Cristo, nosso Senhor. **T.: Amém.**")).toBe("Por Cristo, nosso Senhor. T.: Amém.");
  });
});
