"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Download, ExternalLink, FileMusic, Guitar, Headphones, Minus, Plus, RotateCcw } from "lucide-react";
import type { Song } from "@/lib/types";
import { keyLabel } from "@/lib/chords";
import { setPrefs, usePrefs } from "@/lib/store";
import { ChordSheet } from "./ChordSheet";

type Tab = "cifra" | "partitura" | "audio";

export function SongViewer({ song }: { song: Song }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const prefs = usePrefs();

  const available: Record<Tab, boolean> = {
    cifra: Boolean(song.lyrics || song.media.cifraPdf),
    partitura: Boolean(song.media.partituraPdf),
    audio: Boolean(song.media.audio || song.media.audiomack),
  };
  const firstTab = (["cifra", "partitura", "audio"] as Tab[]).find((t) => available[t]) ?? "cifra";
  const requested = params.get("aba") as Tab | null;
  const tab: Tab = requested && available[requested] ? requested : firstTab;
  const transpose = Number(params.get("tom") ?? 0) || 0;
  const [showChords, setShowChords] = useState(true);

  const setParam = (key: string, value: string | null) => {
    const sp = new URLSearchParams(params.toString());
    if (value === null) sp.delete(key);
    else sp.set(key, value);
    const qs = sp.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };
  const setTranspose = (n: number) => {
    const v = ((n + 18) % 12) - 6; // mantém entre -6 e +5
    setParam("tom", v ? (v > 0 ? `+${v}` : String(v)) : null);
  };
  const fontSize = prefs.fontSize;

  const tabs: { id: Tab; label: string; Icon: typeof Guitar }[] = [
    { id: "cifra", label: "Letra e Cifra", Icon: Guitar },
    { id: "partitura", label: "Partitura", Icon: FileMusic },
    { id: "audio", label: "Áudio", Icon: Headphones },
  ];
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const onTabKey = (e: React.KeyboardEvent, i: number) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    const enabled = tabs.map((t, k) => (available[t.id] ? k : -1)).filter((k) => k >= 0);
    const pos = enabled.indexOf(i);
    const next = enabled[(pos + (e.key === "ArrowRight" ? 1 : enabled.length - 1)) % enabled.length];
    tabRefs.current[next]?.focus();
    setParam("aba", tabs[next].id === firstTab ? null : tabs[next].id);
  };

  return (
    <div>
      <div role="tablist" aria-label="Conteúdo do canto" className="flex gap-1 overflow-x-auto border-b border-border">
        {tabs.map(({ id, label, Icon }, i) => (
          <button
            key={id}
            ref={(el) => {
              tabRefs.current[i] = el;
            }}
            role="tab"
            id={`tab-${id}`}
            aria-selected={tab === id}
            aria-controls={`painel-${id}`}
            tabIndex={tab === id ? 0 : -1}
            disabled={!available[id]}
            title={available[id] ? undefined : `${label} ainda não disponível`}
            onKeyDown={(e) => onTabKey(e, i)}
            onClick={() => setParam("aba", id === firstTab ? null : id)}
            className="relative flex shrink-0 items-center gap-2 px-4 py-3 text-[15px] font-medium text-ink-muted transition-colors hover:text-primary disabled:cursor-not-allowed disabled:opacity-40 aria-selected:text-primary aria-selected:after:absolute aria-selected:after:inset-x-2 aria-selected:after:-bottom-px aria-selected:after:h-0.5 aria-selected:after:bg-gold"
          >
            <Icon size={18} strokeWidth={1.75} /> {label}
          </button>
        ))}
      </div>

      <div role="tabpanel" id={`painel-${tab}`} aria-labelledby={`tab-${tab}`} className="pt-5">
        {tab === "cifra" && (
          <>
            <div className="sticky top-14 z-10 -mx-4 mb-6 flex flex-wrap items-center gap-x-6 gap-y-3 border-b border-border bg-bg/95 px-4 py-3 backdrop-blur sm:top-[72px] sm:mx-0 sm:rounded-[10px] sm:border sm:bg-surface-2/90">
              <div className="flex items-center gap-2" aria-label="Transposição">
                <span className="text-xs font-semibold uppercase tracking-[0.08em] text-ink-muted">Tom</span>
                <IconBtn label="Descer meio tom" onClick={() => setTranspose(transpose - 1)} disabled={!showChords}>
                  <Minus size={18} />
                </IconBtn>
                <span aria-live="polite" className="min-w-[7.5rem] text-center font-semibold" title={transpose ? `${transpose > 0 ? "+" : ""}${transpose} semitons` : "Tom original"}>
                  {keyLabel(song.key, transpose)}
                </span>
                <IconBtn label="Subir meio tom" onClick={() => setTranspose(transpose + 1)} disabled={!showChords}>
                  <Plus size={18} />
                </IconBtn>
                {transpose !== 0 && (
                  <button onClick={() => setTranspose(0)} className="flex items-center gap-1 text-sm text-primary underline-offset-2 hover:underline">
                    <RotateCcw size={14} /> original
                  </button>
                )}
              </div>
              <div className="flex items-center gap-2" aria-label="Tamanho da letra">
                <span className="text-xs font-semibold uppercase tracking-[0.08em] text-ink-muted">Aa</span>
                <IconBtn label="Diminuir letra" onClick={() => setPrefs({ fontSize: Math.max(12, fontSize - 2) })}>
                  <Minus size={18} />
                </IconBtn>
                <span className="w-8 text-center text-sm tabular-nums">{fontSize}</span>
                <IconBtn label="Aumentar letra" onClick={() => setPrefs({ fontSize: Math.min(40, fontSize + 2) })}>
                  <Plus size={18} />
                </IconBtn>
              </div>
              <div role="radiogroup" aria-label="Exibição" className="inline-flex rounded-[10px] border border-border bg-surface p-1 text-sm sm:ml-auto">
                {[
                  [true, "Cifra"],
                  [false, "Só letra"],
                ].map(([v, l]) => (
                  <button
                    key={String(v)}
                    role="radio"
                    aria-checked={showChords === v}
                    onClick={() => setShowChords(v as boolean)}
                    className="rounded-md px-3 py-1 text-ink-muted aria-checked:bg-primary-soft aria-checked:font-semibold aria-checked:text-primary"
                  >
                    {l}
                  </button>
                ))}
              </div>
            </div>
            <ChordSheet
              lyrics={song.lyrics}
              transpose={transpose}
              fontSize={fontSize}
              showChords={showChords}
              preferFlats={prefs.preferFlats}
            />
            {song.media.cifraPdf && (
              <a href={song.media.cifraPdf} target="_blank" rel="noopener" className="mt-8 inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline">
                <Download size={16} /> Baixar cifra original (PDF)
              </a>
            )}
          </>
        )}

        {tab === "partitura" && song.media.partituraPdf && <PdfViewer src={song.media.partituraPdf} title={song.title} />}

        {tab === "audio" && <AudioPanel song={song} />}
      </div>
    </div>
  );
}

function IconBtn({ label, children, ...props }: { label: string } & React.ComponentProps<"button">) {
  return (
    <button
      aria-label={label}
      className="grid h-10 w-10 place-items-center rounded-full border border-border bg-surface text-ink transition hover:border-primary hover:text-primary disabled:opacity-40"
      {...props}
    >
      {children}
    </button>
  );
}

function PdfViewer({ src, title }: { src: string; title: string }) {
  const [loaded, setLoaded] = useState(false);
  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-ink-muted">Use os controles do visualizador para zoom e páginas.</p>
        <div className="flex gap-2">
          <a href={src} target="_blank" rel="noopener" className="inline-flex items-center gap-1.5 rounded-[10px] border border-border px-3 py-2 text-sm font-medium hover:border-primary hover:text-primary">
            <ExternalLink size={16} /> Tela cheia
          </a>
          <a href={src} download className="inline-flex items-center gap-1.5 rounded-[10px] border border-border px-3 py-2 text-sm font-medium hover:border-primary hover:text-primary">
            <Download size={16} /> Baixar PDF
          </a>
        </div>
      </div>
      <div className="relative overflow-hidden rounded-[10px] border border-border bg-surface-2">
        {!loaded && (
          <div className="absolute inset-0 grid place-items-center">
            <div className="aspect-[1/1.414] h-4/5 animate-pulse rounded bg-surface" />
          </div>
        )}
        <iframe
          src={`${src}#view=FitH`}
          title={`Partitura — ${title}`}
          loading="lazy"
          onLoad={() => setLoaded(true)}
          className="relative h-[calc(100vh-220px)] min-h-[480px] w-full"
        />
      </div>
    </div>
  );
}

function AudioPanel({ song }: { song: Song }) {
  const ref = useRef<HTMLAudioElement>(null);
  const [rate, setRate] = useState(1);
  useEffect(() => {
    if (ref.current) ref.current.playbackRate = rate;
  }, [rate]);

  // Um único áudio por vez em toda a página.
  useEffect(() => {
    const onPlay = (e: Event) => {
      document.querySelectorAll("audio").forEach((a) => a !== e.target && a.pause());
    };
    document.addEventListener("play", onPlay, true);
    return () => document.removeEventListener("play", onPlay, true);
  }, []);

  return (
    <div className="space-y-6">
      {song.media.audio && (
        <div className="rounded-[16px] border border-border bg-surface p-5 shadow-card">
          <p className="font-serif text-xl font-semibold">{song.title}</p>
          {song.composer && <p className="text-sm text-ink-muted">{song.composer}</p>}
          <audio ref={ref} controls preload="none" src={song.media.audio} className="mt-4 w-full" />
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-[0.08em] text-ink-muted">Velocidade</span>
            {[0.75, 1, 1.25].map((r) => (
              <button
                key={r}
                aria-pressed={rate === r}
                onClick={() => setRate(r)}
                className="rounded-full border border-border px-3 py-1 text-sm aria-pressed:border-primary aria-pressed:bg-primary-soft aria-pressed:font-semibold aria-pressed:text-primary"
              >
                {String(r).replace(".", ",")}×
              </button>
            ))}
            <a href={song.media.audio} download className="ml-auto inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline">
              <Download size={16} /> Baixar MP3
            </a>
          </div>
        </div>
      )}
      {song.media.audiomack && (
        <details className="rounded-[10px] border border-border bg-surface p-4" open={!song.media.audio}>
          <summary className="cursor-pointer text-sm font-semibold">Ouvir no Audiomack</summary>
          <iframe src={`${song.media.audiomack}?background=1`} title={`Audiomack — ${song.title}`} loading="lazy" className="mt-3 h-[230px] w-full rounded" />
        </details>
      )}
    </div>
  );
}
