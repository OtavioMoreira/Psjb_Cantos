"use client";

import { Fragment, useMemo } from "react";
import { transposeChord, transposeLine } from "@/lib/chords";
import { chordRow, toBlocks } from "@/lib/sheet";

export function ChordSheet({
  lyrics,
  transpose = 0,
  fontSize = 16,
  showChords = true,
  preferFlats = false,
  chordClassName = "text-primary",
  className = "",
  plain = false,
}: {
  lyrics: string;
  transpose?: number;
  fontSize?: number;
  showChords?: boolean;
  preferFlats?: boolean;
  chordClassName?: string;
  className?: string;
  /** Visual objetivo (Modo Missa): sem capitular nem cores de destaque, só preto no branco e refrão em negrito. */
  plain?: boolean;
}) {
  const blocks = useMemo(() => toBlocks(lyrics), [lyrics]);
  const t = (c: string) => transposeChord(c, transpose, preferFlats);

  if (!lyrics.trim()) {
    return <p className="text-ink-muted">Letra ainda não cadastrada para este canto.</p>;
  }

  if (!showChords) {
    const text = blocks
      .map((b) =>
        b.type === "pair"
          ? { text: b.words.map((w) => w.text).join(""), chorus: b.chorus }
          : b.type === "lyric"
            ? { text: b.text, chorus: b.chorus }
            : b.type === "blank"
              ? { text: "" }
              : null,
      )
      .filter((l): l is { text: string; chorus?: boolean } => l !== null)
      .map((l) => ({ ...l, text: l.text.trim() }));
    const first = text.findIndex((l) => l.text);
    const dropCap = "first-letter:float-left first-letter:mr-2 first-letter:font-sc first-letter:text-[3.4em] first-letter:leading-[0.8] first-letter:text-primary";
    return (
      <div className={`${plain ? "font-sans leading-snug" : "font-serif leading-relaxed"} ${className}`} style={{ fontSize: plain ? fontSize : fontSize + 4 }}>
        {text.map((l, i) =>
          l.text ? (
            <p key={i} className={`${l.chorus ? "font-bold" : ""} ${i === first && !plain ? dropCap : ""}`}>
              <Verse text={l.text} plain={plain} />
            </p>
          ) : (
            <div key={i} className={plain ? "h-[0.5em]" : "h-[0.9em]"} />
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
            <div key={i} className={`whitespace-pre-wrap ${b.chorus ? "font-bold" : ""}`}>
              <Verse text={b.text} plain={plain} />
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
                <span className={b.chorus ? "font-bold" : undefined}>{k === 0 ? <Verse text={w.text} plain={plain} /> : w.text}</span>
              </span>
            ))}
          </div>
        );
      })}
    </div>
  );
}

/** Destaca o número da estrofe ("1.", "2.") */
function Verse({ text, plain = false }: { text: string; plain?: boolean }) {
  const m = text.match(/^(\s*)(\d+\.)(.*)$/s);
  if (!m) return <>{text}</>;
  return (
    <Fragment>
      {m[1]}
      <strong className={plain ? undefined : "text-gold-ink"}>{m[2]}</strong>
      {m[3]}
    </Fragment>
  );
}
