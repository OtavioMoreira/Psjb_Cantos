"use client";

import { useState } from "react";
import { FileText, Pause, Play } from "lucide-react";
import type { Song } from "@/lib/types";

/**
 * Atalhos do canto dentro da missa: abrir a partitura ou a cifra em PDF e ouvir o áudio, sem sair
 * da tela (útil nos salmos e aclamações da diocese, que vêm com partitura e MP3).
 */
export function SongMediaLinks({ song }: { song: Song }) {
  const [playing, setPlaying] = useState(false);
  const { audio, partituraPdf, cifraPdf } = song.media;
  if (!audio && !partituraPdf && !cifraPdf) return null;
  const link = "inline-flex min-h-9 items-center gap-1.5 rounded-full border border-border bg-surface px-3 text-xs font-semibold text-primary hover:border-primary";
  return (
    <div className="mt-2">
      <div className="flex flex-wrap gap-2">
        {partituraPdf && (
          <a href={partituraPdf} target="_blank" rel="noopener" className={link}>
            <FileText size={14} /> Partitura (PDF)
          </a>
        )}
        {cifraPdf && (
          <a href={cifraPdf} target="_blank" rel="noopener" className={link}>
            <FileText size={14} /> Cifra (PDF)
          </a>
        )}
        {audio && (
          <button type="button" aria-expanded={playing} onClick={() => setPlaying((v) => !v)} className={link}>
            {playing ? <Pause size={14} /> : <Play size={14} />} {playing ? "Fechar áudio" : "Ouvir"}
          </button>
        )}
      </div>
      {/* O player só existe depois do clique: não baixa o MP3 de todos os cantos ao abrir a missa. */}
      {audio && playing && <audio src={audio} controls autoPlay preload="none" className="mt-2 h-10 w-full" />}
    </div>
  );
}
