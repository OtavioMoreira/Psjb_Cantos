import { describe, expect, it } from "vitest";
import { celebrationKey, joinSyllables, liturgicalYear, parseListingTitle, sheetToLyrics, songTitleFor } from "../../src/domain/psalmImport.js";
import { parseDioceseListing } from "../../src/services/DioceseMontenegroSource.js";

describe("celebrationKey: os dois jeitos de escrever caem na mesma chave", () => {
  it.each([
    ["4º Domingo do Advento, Ano B", "advento-4"],
    ["Advento 4º Dom - Salmo 088", "advento-4"],
    ["Aclamação Tempo Comum 2º Dom.", "tempo-comum-2"],
    ["2º Domingo do Tempo Comum, Ano B", "tempo-comum-2"],
    ["Tempo Comum 6º - Salmo 001", "tempo-comum-6"],
    ["Tempo Pascal 2º Dom. - Salmo 117", "pascoa-2"],
    ["Aclamação 2º Dom. da Páscoa", "pascoa-2"],
    ["Domingo de Páscoa - Salmo 117", "pascoa"],
    ["Vigília Pascal - Salmo 41 (Opção 1)", "vigilia-pascal"],
    ["Noite de Natal", "natal-noite"],
    ["Natal noite - Salmo 095", "natal-noite"],
    ["Dia de Natal", "natal-dia"],
    ["Salmo 28 | Batismo do Senhor", "batismo"],
    ["Nosso Senhor Jesus Cristo, Rei do Universo", "cristo-rei"],
    ["Quaresma 3º Dom. - Salmo 018", "quaresma-3"],
  ])("%s → %s", (text, key) => expect(celebrationKey(text)?.key).toBe(key));

  it("canto genérico não tem celebração", () => {
    expect(celebrationKey("A palavra de Deus vai chegando")).toBeNull();
    expect(celebrationKey("Salmo 79")).toBeNull();
  });
});

describe("liturgicalYear", () => {
  it.each([
    ["2026-11-22", "A"], // Cristo Rei: último domingo do Ano A (2025-26)
    ["2026-11-29", "B"], // 1º Domingo do Advento começa o Ano B
    ["2025-11-30", "A"],
    ["2027-11-28", "C"],
  ])("%s → Ano %s", (date, year) => expect(liturgicalYear(date)).toBe(year));
});

describe("parseListingTitle", () => {
  it("salmo com número, ano escrito e título do canto novo", () => {
    const i = parseListingTitle("1º Domingo do Advento, Ano B | Salmo 79", "2026-11-29");
    expect(i).toMatchObject({ kind: "salmo", key: "advento-1", season: "advento", year: "B", psalmNumber: 79 });
    expect(songTitleFor(i)).toBe("1º Domingo do Advento, Ano B - Salmo 79");
  });
  it("partes em outra ordem e ano pela data", () => {
    expect(parseListingTitle("Salmo 28 | Batismo do Senhor", "2027-01-10")).toMatchObject({ key: "batismo", season: "natal", year: "B", psalmNumber: 28 });
  });
  it("cântico não tem número de salmo; aclamação ganha o título 'Aclamação …'", () => {
    expect(parseListingTitle("3º Domingo do Advento, Ano B | Salmo Lc 1,46", "2026-12-13").psalmNumber).toBeNull();
    const a = parseListingTitle("33º Domingo do Tempo Comum | Aclamação ao Evangelho", "2026-11-15");
    expect(a).toMatchObject({ kind: "aclamacao", key: "tempo-comum-33", year: "A" });
    expect(songTitleFor(a)).toBe("Aclamação 33º Domingo do Tempo Comum");
  });
});

describe("joinSyllables", () => {
  it("junta as sílabas da partitura e mantém o hífen dos pronomes", () => {
    expect(joinSyllables("I - lu-mi-nai a vos-sa fa-ce so-bre nós, con-ver-tei-nos, pa-ra que se-ja-mos sal-vos!")).toBe(
      "Iluminai a vossa face sobre nós, convertei-nos, para que sejamos salvos!",
    );
    expect(joinSyllables("Voltai - vos para nós")).toBe("Voltai-vos para nós");
    expect(joinSyllables("Visitai a vossa vinha e prote - gei - a!")).toBe("Visitai a vossa vinha e protegei-a!");
    expect(joinSyllables("Dai - nos vida, e louva - remos")).toBe("Dai-nos vida, e louvaremos");
    expect(joinSyllables("A - le - lu - ia")).toBe("Aleluia");
  });
});

describe("sheetToLyrics", () => {
  it("salmo: intercala as partes da melodia de cada estrofe e tira o tom do 1º acorde", () => {
    const r = sheetToLyrics(
      [
        "SALMO 79",
        "A D E A",
        "« « «",
        "Refrão: Ilu-mi-nai a vos-sa fa-ce",
        "1. a) Ó Pastor de Israel, +",
        "b) Despertai vosso po - der,",
        "2. a) Voltai - vos para nós,",
        "b) Foi a vossa mão direita",
        "1. a) aparecei cheio de glória!",
        "b) e vinde logo nos salvar!",
        "2. a) Visitai a vossa vinha",
        "b) protegei o vosso rebento!",
      ],
      "salmo",
    );
    expect(r.key).toBe("A");
    expect(r.lyrics).toBe(
      "**Iluminai a vossa face**\n\n1. Ó Pastor de Israel,\naparecei cheio de glória!\nDespertai vosso poder,\ne vinde logo nos salvar!\n\n" +
        "2. Voltai-vos para nós,\nVisitai a vossa vinha\nFoi a vossa mão direita\nprotegei o vosso rebento!",
    );
  });
  it("aclamação: refrão (aleluia), compositor e o versículo de cada domingo", () => {
    const r = sheetToLyrics(["M.: Fulano", "A - le - lu - ia!", "1° dom.", "Mos-trai-nos,ó Se - nhor,", "Adv.", "1° dom.", "Adv. e a vos - sa sal - va - ção!"], "aclamacao");
    expect(r).toMatchObject({ composer: "Fulano", lyrics: "**Aleluia!**\n\n1º Dom.: Mostrai-nos, ó Senhor, e a vossa salvação!" });
  });
});

describe("parseDioceseListing", () => {
  it("lê título, data, PDF e áudio de cada item; o id é o código do arquivo + a data", () => {
    const html = `
      <h3 class="x">1º Domingo do Advento, Ano B | Salmo 79</h3><p class="y">29/11/2026</p>
      <audio controls src="https://storage.unitas.app.br/1/DocumentAssets/358/documents/original/a.mp3"></audio>
      <a href="https://storage.unitas.app.br/1/DocumentAssets/359/documents/original/b.pdf">Download 1</a>
      <h3>Noite de Natal | Salmo 95</h3><p>24/12/2026</p>`;
    expect(parseDioceseListing(html)).toEqual([
      {
        externalId: "359@2026-11-29",
        title: "1º Domingo do Advento, Ano B | Salmo 79",
        date: "2026-11-29",
        pdfUrl: "https://storage.unitas.app.br/1/DocumentAssets/359/documents/original/b.pdf",
        audioUrl: "https://storage.unitas.app.br/1/DocumentAssets/358/documents/original/a.mp3",
      },
      { externalId: "Noite de Natal | Salmo 95@2026-12-24", title: "Noite de Natal | Salmo 95", date: "2026-12-24", pdfUrl: null, audioUrl: null },
    ]);
  });
});
