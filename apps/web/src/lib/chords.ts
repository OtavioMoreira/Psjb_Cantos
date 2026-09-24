// Parser de cifras no formato "acordes na linha de cima" + transposição.

const SHARPS = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const FLATS = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"];
const SOLFEGE: Record<string, string> = {
  C: "Dó",
  D: "Ré",
  E: "Mi",
  F: "Fá",
  G: "Sol",
  A: "Lá",
  B: "Si",
};

const CHORD_RE =
  /^\(?[A-G](#|b)?(m|maj|min|dim|aug|sus|add|M)?[0-9]*(\([^)]*\))?([#b+-]?[0-9]+)*(M|maj)?[0-9]*(\/[A-G](#|b)?)?\)?$/;

export function isChordToken(token: string) {
  return CHORD_RE.test(token.replace(/[,;.]$/, ""));
}

export function isChordLine(line: string) {
  const tokens = line.trim().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return false;
  const chordish = tokens.filter((t) => isChordToken(t) || /^[|/\-–x2()]+$/.test(t));
  return chordish.length === tokens.length && tokens.some(isChordToken);
}

function noteIndex(note: string) {
  const i = SHARPS.indexOf(note);
  return i >= 0 ? i : FLATS.indexOf(note);
}

function shiftNote(note: string, semitones: number, preferFlats: boolean) {
  const i = noteIndex(note);
  if (i < 0) return note;
  const n = (((i + semitones) % 12) + 12) % 12;
  return (preferFlats ? FLATS : SHARPS)[n];
}

export function transposeChord(chord: string, semitones: number, preferFlats = false) {
  if (!semitones) return chord;
  return chord.replace(/([A-G])(#|b)?/g, (_, n: string, acc: string | undefined) =>
    shiftNote(n + (acc ?? ""), semitones, preferFlats),
  );
}

/** Nome do tom por extenso: "Ré (D)" / "Si menor (Bm)". */
export function keyLabel(key: string | null, semitones = 0) {
  if (!key) return "—";
  const k = transposeChord(key, semitones, key.includes("b"));
  const root = k.match(/^[A-G](#|b)?/)?.[0] ?? k;
  const minor = /^[A-G](#|b)?m(?!aj)/.test(k);
  const name = SOLFEGE[root[0]] + (root[1] === "#" ? "♯" : root[1] === "b" ? "♭" : "");
  return `${name}${minor ? " menor" : ""} (${root}${minor ? "m" : ""})`;
}

export type SheetLine =
  | { type: "chords"; text: string }
  | { type: "lyric"; text: string; chorus?: boolean }
  | { type: "blank" };

export function parseSheet(lyrics: string): SheetLine[] {
  return lyrics.split("\n").map((raw) => {
    const line = raw.replace(/\t/g, "    ").replace(/\s+$/, "");
    if (!line.trim()) return { type: "blank" };
    if (isChordLine(line)) return { type: "chords", text: line };
    return { type: "lyric", text: line };
  });
}

/** Transpõe uma linha de acordes preservando (quando possível) as posições. */
export function transposeLine(line: string, semitones: number, preferFlats = false) {
  if (!semitones) return line;
  let out = "";
  let debt = 0;
  for (const m of line.matchAll(/(\s+)|(\S+)/g)) {
    if (m[1]) {
      const len = Math.max(1, m[1].length - debt);
      debt = Math.max(0, debt - (m[1].length - 1));
      out += " ".repeat(len);
    } else {
      const t = transposeChord(m[2], semitones, preferFlats);
      debt += t.length - m[2].length;
      out += t;
    }
  }
  return out;
}

/** Remove as linhas de acordes — usado para busca e trechos. */
export function lyricsOnly(lyrics: string) {
  return lyrics
    .split("\n")
    .filter((l) => !isChordLine(l))
    .join("\n");
}
