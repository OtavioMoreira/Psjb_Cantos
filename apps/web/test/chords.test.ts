import { describe, expect, it } from "vitest";
import { isChordLine, isChordToken, keyLabel, lyricsOnly, parseSheet, transposeChord, transposeLine, wrapSemitones } from "@/lib/chords";

describe("Acordes", () => {
  it.each(["C", "Am", "F#m", "Bb", "C7", "G/B", "D9", "Dsus4", "E7(9)", "Cmaj7", "Bdim", "(A)"])("%s é acorde", (c) => {
    expect(isChordToken(c)).toBe(true);
  });
  it.each(["Senhor", "Amor", "Do", "Eu", "a", "Cristo"])("%s não é acorde", (w) => {
    expect(isChordToken(w)).toBe(false);
  });

  it("linha de acordes × linha de letra", () => {
    expect(isChordLine("   G        D/F#    Em   C")).toBe(true);
    expect(isChordLine("A  E  |  x2")).toBe(true);
    expect(isChordLine("A feliz espera do Senhor")).toBe(false);
    expect(isChordLine("E a luz brilhou")).toBe(false);
    expect(isChordLine("")).toBe(false);
  });
});

describe("Transposição", () => {
  it("sobe e desce semitons, com sustenido ou bemol", () => {
    expect(transposeChord("C", 2)).toBe("D");
    expect(transposeChord("Am", 3)).toBe("Cm");
    expect(transposeChord("G/B", 2)).toBe("A/C#");
    expect(transposeChord("G/B", 2, true)).toBe("A/Db");
    expect(transposeChord("Bb", 2)).toBe("C");
    expect(transposeChord("C", -1)).toBe("B");
    expect(transposeChord("F#m7", 0)).toBe("F#m7");
  });

  it("12 semitons voltam ao mesmo acorde (na grafia preferida: Bb7 com bemóis, F#m com sustenidos)", () => {
    for (const c of ["C", "F#m", "E/G#"]) expect(transposeChord(c, 12)).toBe(c);
    expect(transposeChord("Bb7", 12, true)).toBe("Bb7");
    expect(transposeChord("Bb7", 12)).toBe("A#7"); // mesmo acorde, escrito com sustenido
  });

  it("mantém a transposição entre −6 e +5 (dá a volta)", () => {
    expect([-7, -6, 0, 5, 6, 12, 18].map(wrapSemitones)).toEqual([5, -6, 0, 5, -6, 0, -6]);
  });

  it("transpor a linha mantém os acordes alinhados com a letra", () => {
    const line = "G       C       D";
    const out = transposeLine(line, 1);
    expect(out.trim().split(/\s+/)).toEqual(["G#", "C#", "D#"]);
    // Cada acorde começa na mesma coluna ou logo depois (o acorde maior "empurra" o seguinte).
    expect(out.indexOf("C#")).toBeGreaterThanOrEqual(line.indexOf("C"));
    expect(out.indexOf("C#") - line.indexOf("C")).toBeLessThanOrEqual(1);
  });

  it("nome do tom por extenso", () => {
    expect(keyLabel("D")).toBe("Ré (D)");
    expect(keyLabel("Bm")).toBe("Si menor (Bm)");
    expect(keyLabel("C", 1)).toBe("Dó♯ (C#)");
    expect(keyLabel("C", 1, true)).toBe("Ré♭ (Db)");
    expect(keyLabel("Bb", 2)).toBe("Dó (C)");
    expect(keyLabel(null)).toBe("—");
  });
});

describe("Refrão (**…**) e só letra", () => {
  const lyrics = ["   G        D", "**Vem, Senhor Jesus**", "", "   Em    C", "1. A feliz espera"].join("\n");

  it("parseSheet marca o refrão sem mostrar os **", () => {
    const lines = parseSheet(lyrics);
    expect(lines.map((l) => l.type)).toEqual(["chords", "lyric", "blank", "chords", "lyric"]);
    expect(lines[1]).toEqual({ type: "lyric", text: "Vem, Senhor Jesus", chorus: true });
    expect(JSON.stringify(lines)).not.toContain("**");
  });

  it("lyricsOnly tira os acordes e os ** (o que entra na busca)", () => {
    expect(lyricsOnly(lyrics)).toBe(["Vem, Senhor Jesus", "", "1. A feliz espera"].join("\n"));
  });
});
