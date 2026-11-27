// Acordes dentro de partituras em PDF (Salmo e Aclamação da diocese), para trocar o tom só da cifra.
// No PDF, o acorde é texto na mesma fonte da letra, numa linha só de acordes, mas vem quebrado:
// "F#m" = "F" + "#" (fonte musical, mais alto) + "m"; "E7" = "E" + "7" (sobrescrito, menor).
import { isChordToken } from "@/lib/chords";

/** Item de texto do pdf.js, em coordenadas do PDF (y cresce para cima; x/y = início da linha de base). */
export type TextBit = { str: string; x: number; y: number; w: number; h: number };

export type ScoreChord = {
  chord: string;
  x: number;
  /** Linha de base e corpo do acorde. */
  y: number;
  size: number;
  /** Fim do acorde original (para cobri-lo). */
  right: number;
  /** Até onde o acorde novo pode ir sem encostar no próximo. */
  limit: number;
};

// Pedaços que grudam no acorde: acidente, número sobrescrito, qualidade.
const PIECE = /^([#b♯♭]|[0-9+°º()]+|m|maj|min|sus|dim|add|M)$/;
const GAP = 2.5;

/** Acha os acordes de uma página. Linha com qualquer palavra que não seja acorde é ignorada inteira. */
export function findScoreChords(items: TextBit[], pageWidth: number): ScoreChord[] {
  const bits = items.map((b) => ({ ...b, str: b.str.trim() })).filter((b) => b.str);
  const base = bits.filter((b) => b.h >= 10 && b.h <= 14);
  const rows: TextBit[][] = [];
  for (const b of [...base].sort((a, z) => z.y - a.y)) {
    const row = rows.find((r) => Math.abs(r[0].y - b.y) <= 1.5);
    if (row) row.push(b);
    else rows.push([b]);
  }
  const out: ScoreChord[] = [];
  for (const row of rows) {
    const y = row[0].y;
    const extras = bits.filter((b) => !base.includes(b) && b.y >= y - 1 && b.y <= y + 9 && PIECE.test(b.str));
    const pieces = [...row.map((b) => ({ ...b, base: true })), ...extras.map((b) => ({ ...b, base: false }))].sort((a, z) => a.x - z.x);
    const groups: (typeof pieces)[] = [];
    for (const p of pieces) {
      const last = groups.at(-1);
      const end = last ? Math.max(...last.map((q) => q.x + q.w)) : -Infinity;
      if (last && p.x <= end + GAP) last.push(p);
      else groups.push([p]);
    }
    const chords = groups
      .filter((g) => g.some((p) => p.base))
      .map((g) => ({
        chord: g.map((p) => p.str).join("").replace(/♯/g, "#").replace(/♭/g, "b"),
        x: g[0].x,
        right: Math.max(...g.map((p) => p.x + p.w)),
        size: Math.max(...g.filter((p) => p.base).map((p) => p.h)),
      }));
    if (!chords.length || !chords.every((c) => isChordToken(c.chord))) continue;
    chords.forEach((c, i) => out.push({ ...c, y, limit: (chords[i + 1]?.x ?? pageWidth - 20) - 3 }));
  }
  return out;
}

/** Divide o acorde para desenhar como no PDF: fundamental, acidente e qualidade normais; extensões sobrescritas. */
export function chordParts(chord: string) {
  const m = chord.match(/^([A-G])([#b]?)(m(?!aj))?(.*?)(?:\/([A-G])([#b]?))?$/);
  if (!m) return null;
  return { root: m[1], acc: m[2], minor: m[3] ?? "", ext: m[4], bass: m[5] ? { root: m[5], acc: m[6] } : null };
}
