// Estrutura da cifra (acordes + letra por palavra), compartilhada pela tela (ChordSheet) e pelo PDF da missa.
import { parseSheet } from "./chords";

export type Chord = { at: number; chord: string };
export type Word = { text: string; chords: Chord[] };

export type Block =
  | { type: "pair"; words: Word[]; chorus?: boolean }
  | { type: "chords"; text: string }
  | { type: "lyric"; text: string; chorus?: boolean }
  | { type: "blank" };

/**
 * Junta cada linha de acordes com a letra logo abaixo e divide em palavras.
 * Cada palavra carrega seus acordes (posição relativa), então a linha só quebra entre palavras
 * e o acorde nunca se separa da sílaba.
 */
export function toBlocks(lyrics: string): Block[] {
  const lines = parseSheet(lyrics);
  const out: Block[] = [];
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    const next = lines[i + 1];
    if (l.type === "chords" && next?.type === "lyric") {
      const chords = [...l.text.matchAll(/\S+/g)].map((m) => ({ at: m.index!, chord: m[0] }));
      const words: Word[] = [];
      for (const m of next.text.matchAll(/\S*\s*/g)) {
        if (!m[0]) continue;
        words.push({ text: m[0], chords: [] });
        const w = words.at(-1)!;
        const s = m.index!;
        const e = s + m[0].length;
        w.chords = chords.filter((c) => c.at >= s && c.at < e).map((c) => ({ ...c, at: c.at - s }));
      }
      // Acordes além do fim da letra vão para a última palavra.
      const len = next.text.length;
      const tail = chords.filter((c) => c.at >= len);
      if (words.length && tail.length) {
        const last = words.at(-1)!;
        const end = last.text.trimEnd().length + 1;
        last.chords.push(...tail.map((c) => ({ ...c, at: end })));
      }
      out.push({ type: "pair", words, chorus: next.chorus });
      i++;
    } else {
      out.push(l);
    }
  }
  // Colapsa linhas em branco repetidas
  return out.filter((b, i) => !(b.type === "blank" && out[i - 1]?.type === "blank"));
}

/** Monta a linha de acordes de uma palavra, empurrando acordes que colidiriam após a transposição. */
export function chordRow(chords: Chord[], t: (c: string) => string) {
  let row = "";
  for (const c of chords) {
    const name = t(c.chord);
    const at = row.length === 0 ? c.at : Math.max(c.at, row.length + 1);
    row = row.padEnd(at, " ") + name;
  }
  return row;
}
