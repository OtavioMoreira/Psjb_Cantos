import { describe, expect, it } from "vitest";
import { chordParts, findScoreChords, type TextBit } from "@/lib/scoreChords";

const t = (str: string, x: number, y: number, w: number, h = 12): TextBit => ({ str, x, y, w, h });

describe("Acordes na partitura em PDF", () => {
  // Trechos reais de um salmo da diocese: o "#" vem na fonte musical (mais alto) e o "7" sobrescrito.
  const page = [
    t("SALMO 79", 251, 749, 114, 24),
    t("7", 379, 695, 4, 9),
    t("A", 194, 692, 9),
    t("D", 308, 692, 9),
    t("E", 372, 692, 7),
    t("A", 502, 692, 9),
    t("I - lu-mi-nai a vos-sa", 144, 634, 91, 11),
    t("#", 298, 602, 4, 19),
    t("#", 483, 602, 4, 19),
    t("A", 131, 597, 9),
    t("F", 291, 597, 7),
    t("m", 302, 597, 9),
    t("C", 475, 597, 8),
    t("m", 487, 597, 9),
    t("6", 78, 590, 5, 9), // número do compasso: fica de fora
    t("#", 105, 585, 6, 24), // armadura de clave
    t("Ó", 129, 543, 9),
    t("Pastor", 159, 543, 30),
    t("E", 127, 393, 7),
    t("nunca", 149, 393, 29),
  ];

  it("junta os pedaços e acha só as linhas de acordes", () => {
    const found = findScoreChords(page, 595);
    expect(found.map((c) => c.chord)).toEqual(["A", "D", "E7", "A", "A", "F#m", "C#m"]);
    expect(found[2]).toMatchObject({ x: 372, y: 692, right: 383, limit: 499 });
  });

  it("baixo com acidente e sobrescrito numérico", () => {
    const found = findScoreChords([t("D", 151, 687, 9), t("A/C", 177, 687, 20), t("#", 197, 692, 4, 19), t("Bm", 213, 687, 17), t("4", 429, 690, 4, 9), t("A", 420, 687, 9)], 595);
    expect(found.map((c) => c.chord)).toEqual(["D", "A/C#", "Bm", "A4"]);
  });

  it("linha de letra com palavra que parece acorde não entra", () => {
    expect(findScoreChords([t("A", 146, 627, 9), t("-", 165, 627, 4), t("le", 180, 627, 9)], 595)).toEqual([]);
    expect(findScoreChords([], 595)).toEqual([]);
  });

  it("divide o acorde para desenhar", () => {
    expect(chordParts("F#m7")).toEqual({ root: "F", acc: "#", minor: "m", ext: "7", bass: null });
    expect(chordParts("Bb/D")).toEqual({ root: "B", acc: "b", minor: "", ext: "", bass: { root: "D", acc: "" } });
    expect(chordParts("Cmaj7")).toMatchObject({ minor: "", ext: "maj7" });
  });
});
