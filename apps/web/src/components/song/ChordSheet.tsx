"use client";

import { Fragment, useMemo } from "react";
import { parseSheet, transposeChord, transposeLine } from "@/lib/chords";

type Chord = { at: number; chord: string };
type Word = { text: string; chords: Chord[] };

type Block =
  | { type: "pair"; words: Word[] }
  | { type: "chords"; text: string }
  | { type: "lyric"; text: string }
  | { type: "blank" };

/**
 * Junta cada linha de acordes com a letra logo abaixo e divide em palavras.
 * Cada palavra carrega seus acordes (posição relativa), então a linha só quebra entre palavras
 * e o acorde nunca se separa da sílaba.
 */
function toBlocks(lyrics: string): Block[] {
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
      out.push({ type: "pair", words });
      i++;
    } else {
      out.push(l);
    }
  }
  // Colapsa linhas em branco repetidas
  return out.filter((b, i) => !(b.type === "blank" && out[i - 1]?.type === "blank"));
}

/** Monta a linha de acordes de uma palavra, empurrando acordes que colidiriam após a transposição. */
function chordRow(chords: Chord[], t: (c: string) => string) {
  let row = "";
  for (const c of chords) {
    const name = t(c.chord);
    const at = row.length === 0 ? c.at : Math.max(c.at, row.length + 1);
    row = row.padEnd(at, " ") + name;
  }
  return row;
}

export function ChordSheet({
  lyrics,
  transpose = 0,
  fontSize = 16,
  showChords = true,
  preferFlats = false,
  chordClassName = "text-primary",
  className = "",
}: {
  lyrics: string;
  transpose?: number;
  fontSize?: number;
  showChords?: boolean;
  preferFlats?: boolean;
  chordClassName?: string;
  className?: string;
}) {
  const blocks = useMemo(() => toBlocks(lyrics), [lyrics]);
  const t = (c: string) => transposeChord(c, transpose, preferFlats);

  if (!lyrics.trim()) {
    return <p className="text-ink-muted">Letra ainda não cadastrada para este canto.</p>;
  }

  if (!showChords) {
    const text = blocks
      .map((b) => (b.type === "pair" ? b.words.map((w) => w.text).join("") : b.type === "lyric" ? b.text : b.type === "blank" ? "" : null))
      .filter((l): l is string => l !== null)
      .map((l) => l.trim());
    const first = text.findIndex((l) => l);
    return (
      <div className={`font-serif leading-relaxed ${className}`} style={{ fontSize: fontSize + 4 }}>
        {text.map((l, i) =>
          l ? (
            <p key={i} className={i === first ? "first-letter:float-left first-letter:mr-2 first-letter:font-sc first-letter:text-[3.4em] first-letter:leading-[0.8] first-letter:text-primary" : ""}>
              <Verse text={l} />
            </p>
          ) : (
            <div key={i} className="h-[0.9em]" />
          ),
        )}
      </div>
    );
  }

  return (
    <div
      key={transpose}
      className={`chord-flash font-mono ${className}`}
      style={{ fontSize, lineHeight: 1.35 }}
      aria-label="Letra com cifra"
    >
      {blocks.map((b, i) => {
        if (b.type === "blank") return <div key={i} className="h-[1em]" />;
        if (b.type === "chords")
          return (
            <div key={i} aria-hidden className={`chord whitespace-pre-wrap font-bold ${chordClassName}`}>
              {transposeLine(b.text, transpose, preferFlats)}
            </div>
          );
        if (b.type === "lyric")
          return (
            <div key={i} className="whitespace-pre-wrap">
              <Verse text={b.text} />
            </div>
          );
        const hasChords = b.words.some((w) => w.chords.length);
        return (
          <div key={i} className="mb-[0.35em] flex flex-wrap items-end">
            {b.words.map((w, k) => (
              <span key={k} className="inline-flex flex-col whitespace-pre">
                {hasChords && (
                  <span aria-hidden className={`chord min-h-[1.35em] font-bold ${chordClassName}`}>
                    {chordRow(w.chords, t) || " "}
                  </span>
                )}
                <span>{k === 0 ? <Verse text={w.text} /> : w.text}</span>
              </span>
            ))}
          </div>
        );
      })}
    </div>
  );
}

/** Destaca o número da estrofe ("1.", "2.") */
function Verse({ text }: { text: string }) {
  const m = text.match(/^(\s*)(\d+\.)(.*)$/s);
  if (!m) return <>{text}</>;
  return (
    <Fragment>
      {m[1]}
      <strong className="text-gold-ink">{m[2]}</strong>
      {m[3]}
    </Fragment>
  );
}
