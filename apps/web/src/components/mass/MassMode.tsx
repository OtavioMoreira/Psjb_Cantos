"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight, Expand, List, Minus, Moon, Plus, Shrink, Sun, SunDim, X } from "lucide-react";
import type { MassItem, MassSlot } from "@/lib/types";
import { saveMass, setPrefs, usePrefs, useMasses } from "@/lib/store";
import { useHydrated } from "@/lib/hooks";
import { useSongIndex } from "@/lib/useSongIndex";
import { keyLabel } from "@/lib/chords";
import { formatNumber } from "@/lib/liturgy";
import { ChordSheet } from "@/components/song/ChordSheet";
import { Cross } from "@/components/ui/Ornament";
import { massEditUrl } from "@/lib/routes";

// Paletas próprias de alto contraste (ux.md §2.1)
const PALETTES = {
  dia: { bg: "#FFFFFF", ink: "#000000", chord: "#1F3D2B", ui: "#F3ECDD", muted: "#5B6159", line: "#E4DAC6", soft: "#E3ECE5", Icon: Sun, label: "Dia" },
  noite: { bg: "#000000", ink: "#F2E9D8", chord: "#F2B84B", ui: "#141414", muted: "#A9A294", line: "#2A2A2A", soft: "#1F2E25", Icon: Moon, label: "Noite" },
  sepia: { bg: "#F4ECD8", ink: "#2B2118", chord: "#7A1F1F", ui: "#E8DCC0", muted: "#6B5B45", line: "#D8C9A6", soft: "#E8DCC0", Icon: SunDim, label: "Sépia" },
} as const;

interface Step {
  slot: MassSlot;
  item: MassItem;
}

type WakeLockSentinelLike = { release: () => Promise<void> };

export function MassMode() {
  const id = useSearchParams().get("id") ?? "";
  const router = useRouter();
  const hydrated = useHydrated();
  const mass = useMasses().find((m) => m.id === id);
  const prefs = usePrefs();
  const { songs, error } = useSongIndex();
  const [index, setIndex] = useState(0);
  const [done, setDone] = useState(false);
  const [sidebar, setSidebar] = useState(true);
  const [drawer, setDrawer] = useState(false);
  const [controls, setControls] = useState(true);
  const [fullscreen, setFullscreen] = useState(false);
  const [wakeLockOk, setWakeLockOk] = useState<boolean | null>(null);
  const [wakeDismissed, setWakeDismissed] = useState(false);
  const [visited, setVisited] = useState<Set<number>>(new Set([0]));
  const scroller = useRef<HTMLDivElement>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const pal = PALETTES[prefs.massPalette];
  const fontSize = prefs.massFontSize;

  const steps: Step[] = useMemo(
    () => (mass ? mass.slots.flatMap((slot) => slot.items.map((item) => ({ slot, item }))) : []),
    [mass],
  );
  const byId = useMemo(() => new Map((songs ?? []).map((s) => [s.id, s])), [songs]);
  const step = steps[index];
  const song = step ? byId.get(step.item.songId) : undefined;

  // Controles somem após 4s sem interação.
  const poke = useCallback(() => {
    setControls(true);
    clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setControls(false), 4000);
  }, []);
  const go = useCallback(
    (i: number) => {
      if (i >= steps.length) {
        setDone(true);
        return;
      }
      if (i < 0) return;
      setDone(false);
      setIndex(i);
      setVisited((v) => new Set(v).add(i));
      setDrawer(false);
      poke();
      scroller.current?.scrollTo({ top: 0 });
    },
    [steps.length, poke],
  );

  useEffect(() => {
    hideTimer.current = setTimeout(() => setControls(false), 4000);
    return () => clearTimeout(hideTimer.current);
  }, []);

  // Teclado e pedal Bluetooth (envia setas / PageUp / PageDown).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (["ArrowRight", "PageDown"].includes(e.key)) go(index + 1);
      else if (["ArrowLeft", "PageUp"].includes(e.key)) go(index - 1);
      else if (e.key === " " || e.key === "ArrowDown") {
        e.preventDefault();
        scroller.current?.scrollBy({ top: scroller.current.clientHeight * 0.85, behavior: "smooth" });
      } else if (e.key === "ArrowUp") scroller.current?.scrollBy({ top: -scroller.current.clientHeight * 0.85, behavior: "smooth" });
      else if (e.key === "Escape") setDrawer(false);
      poke();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, index, poke]);

  // Tela sempre acesa (Wake Lock API).
  useEffect(() => {
    let lock: WakeLockSentinelLike | null = null;
    const nav = navigator as Navigator & { wakeLock?: { request: (t: "screen") => Promise<WakeLockSentinelLike> } };
    const request = async () => {
      try {
        if (!nav.wakeLock) return setWakeLockOk(false);
        lock = await nav.wakeLock.request("screen");
        setWakeLockOk(true);
      } catch {
        setWakeLockOk(false);
      }
    };
    request();
    const onVis = () => document.visibilityState === "visible" && request();
    document.addEventListener("visibilitychange", onVis);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      lock?.release().catch(() => {});
    };
  }, []);

  useEffect(() => {
    const onFs = () => setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);

  // Swipe horizontal (ignora rolagem vertical).
  const touch = useRef<{ x: number; y: number; t: number } | null>(null);
  const onTouchStart = (e: React.TouchEvent) => {
    const p = e.touches[0];
    touch.current = { x: p.clientX, y: p.clientY, t: Date.now() };
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    const s = touch.current;
    if (!s) return;
    const p = e.changedTouches[0];
    const dx = p.clientX - s.x;
    const dy = p.clientY - s.y;
    const fast = Math.abs(dx) / Math.max(1, Date.now() - s.t) > 0.3;
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5 && fast) go(index + (dx < 0 ? 1 : -1));
    touch.current = null;
  };

  const setTranspose = (delta: number) => {
    if (!mass || !step) return;
    saveMass({
      ...mass,
      slots: mass.slots.map((s) =>
        s.id === step.slot.id
          ? { ...s, items: s.items.map((it) => (it.songId === step.item.songId ? { ...it, transpose: it.transpose + delta } : it)) }
          : s,
      ),
    });
  };

  const cyclePalette = () => {
    const order = ["dia", "noite", "sepia"] as const;
    setPrefs({ massPalette: order[(order.indexOf(prefs.massPalette) + 1) % 3] });
  };

  const toggleFullscreen = () => {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    else document.documentElement.requestFullscreen?.().catch(() => {});
  };

  const style = { background: pal.bg, color: pal.ink, "--mm-chord": pal.chord } as React.CSSProperties;

  if (!hydrated || (!songs && !error)) {
    return (
      <div className="grid min-h-screen place-items-center" style={style}>
        <Cross size={24} className="animate-pulse" />
      </div>
    );
  }
  if (!mass || steps.length === 0 || error) {
    return (
      <div className="grid min-h-screen place-items-center p-6 text-center" style={style}>
        <div>
          <p className="font-serif text-3xl font-semibold">{error ? "Não conseguimos carregar os cantos." : !mass ? "Missa não encontrada." : "Esta missa ainda não tem cantos."}</p>
          <Link href={mass ? massEditUrl(mass.id) : "/painel/missas"} className="mt-6 inline-block text-lg font-semibold underline underline-offset-4">
            {mass ? "Escolher cantos" : "Ver minhas missas"}
          </Link>
        </div>
      </div>
    );
  }

  const prev = steps[index - 1];
  const next = steps[index + 1];
  const btn = "grid h-14 w-14 place-items-center rounded-full transition active:scale-95";

  const roteiro = (
    <nav aria-label="Roteiro da missa" className="flex h-full flex-col">
      <p className="px-4 pb-2 pt-4 text-xs font-semibold uppercase tracking-[0.12em]" style={{ color: pal.muted }}>
        Roteiro
      </p>
      <ol className="flex-1 overflow-y-auto px-2 pb-4">
        {steps.map((s, i) => {
          const sg = byId.get(s.item.songId);
          const current = i === index && !done;
          return (
            <li key={`${s.slot.id}-${s.item.songId}`}>
              <button
                onClick={() => go(i)}
                aria-current={current ? "step" : undefined}
                className="flex min-h-14 w-full items-center gap-3 rounded-[10px] px-3 py-2 text-left"
                style={current ? { background: pal.soft } : undefined}
              >
                <span className="w-6 text-center font-serif text-lg font-semibold" style={{ color: pal.chord }}>
                  {current ? "▶" : i + 1}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-xs font-semibold uppercase tracking-[0.1em]" style={{ color: pal.muted }}>
                    {s.slot.label}
                  </span>
                  <span className="block truncate text-[15px] font-medium">{sg?.title}</span>
                </span>
                {visited.has(i) && !current && <span style={{ color: pal.muted }}>✓</span>}
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );

  return (
    <div className="fixed inset-0 flex select-none flex-col" style={style} onPointerDown={poke}>
      <div className="flex min-h-0 flex-1">
        {/* Roteiro lateral (paisagem / telas largas) */}
        {sidebar && (
          <aside className="hidden w-[260px] shrink-0 border-r lg:block" style={{ borderColor: pal.line, background: pal.ui }}>
            {roteiro}
          </aside>
        )}

        <div className="flex min-w-0 flex-1 flex-col">
          {/* Barra superior */}
          <header
            className={`flex items-center gap-2 border-b px-3 py-2 transition-opacity duration-300 sm:px-4 ${controls ? "opacity-100" : "pointer-events-none opacity-0"}`}
            style={{ borderColor: pal.line }}
          >
            <button aria-label="Abrir roteiro" onClick={() => (window.matchMedia("(min-width: 1024px)").matches ? setSidebar((v) => !v) : setDrawer(true))} className={btn}>
              <List size={24} />
            </button>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] sm:text-sm" style={{ color: pal.muted }}>
                {done ? "Fim" : `${step.slot.label} · ${index + 1}/${steps.length}`}
              </p>
              <h1 className="truncate font-serif text-xl font-semibold leading-tight sm:text-2xl">{done ? mass.name : song?.title}</h1>
            </div>
            {!done && song?.key && (
              <div className="hidden items-center gap-1 lg:flex" aria-label="Tom">
                <button aria-label="Descer meio tom" onClick={() => setTranspose(-1)} className={btn}>
                  <Minus size={22} />
                </button>
                <span className="min-w-[6.5rem] text-center text-sm font-semibold" aria-live="polite">
                  {keyLabel(song.key, step.item.transpose)}
                </span>
                <button aria-label="Subir meio tom" onClick={() => setTranspose(1)} className={btn}>
                  <Plus size={22} />
                </button>
              </div>
            )}
            <button aria-label="Diminuir letra" onClick={() => setPrefs({ massFontSize: Math.max(18, fontSize - 2) })} className={`${btn} text-sm font-bold`}>
              A−
            </button>
            <button aria-label="Aumentar letra" onClick={() => setPrefs({ massFontSize: Math.min(56, fontSize + 2) })} className={`${btn} text-lg font-bold`}>
              A+
            </button>
            <button aria-label={`Paleta: ${pal.label}. Trocar`} onClick={cyclePalette} className={btn}>
              <pal.Icon size={22} />
            </button>
            <button aria-label={fullscreen ? "Sair da tela cheia" : "Tela cheia"} onClick={toggleFullscreen} className={`${btn} hidden sm:grid`}>
              {fullscreen ? <Shrink size={22} /> : <Expand size={22} />}
            </button>
            <button aria-label="Sair do Modo Missa" onClick={() => router.push(massEditUrl(mass.id))} className={btn}>
              <X size={24} />
            </button>
          </header>

          {/* Tom no retrato/celular */}
          {!done && song?.key && (
            <div className={`flex items-center justify-center gap-2 border-b py-1 lg:hidden ${controls ? "" : "hidden"}`} style={{ borderColor: pal.line }}>
              <button aria-label="Descer meio tom" onClick={() => setTranspose(-1)} className={btn}>
                <Minus size={20} />
              </button>
              <span className="text-sm font-semibold">Tom: {keyLabel(song.key, step.item.transpose)}</span>
              <button aria-label="Subir meio tom" onClick={() => setTranspose(1)} className={btn}>
                <Plus size={20} />
              </button>
            </div>
          )}

          {/* Letra */}
          <div ref={scroller} className="flex-1 overflow-y-auto overscroll-contain" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
            {done ? (
              <div className="grid h-full place-items-center p-8 text-center">
                <div>
                  <Cross size={28} className="mx-auto" />
                  <p className="mt-6 font-serif text-4xl font-semibold">Missa concluída.</p>
                  <p className="mt-2 font-serif text-2xl italic" style={{ color: pal.muted }}>
                    Deus seja louvado!
                  </p>
                  <div className="mt-10 flex flex-wrap justify-center gap-3">
                    <button onClick={() => go(0)} className="min-h-14 rounded-[10px] border px-6 text-lg font-semibold" style={{ borderColor: pal.line }}>
                      Recomeçar
                    </button>
                    <Link href="/painel" className="grid min-h-14 place-items-center rounded-[10px] px-6 text-lg font-semibold" style={{ background: pal.chord, color: pal.bg }}>
                      Voltar ao painel
                    </Link>
                  </div>
                </div>
              </div>
            ) : song ? (
              <div key={index} className="animate-fade-in mx-auto max-w-5xl px-5 py-6 sm:px-10 sm:py-8">
                <p className="mb-4 text-sm" style={{ color: pal.muted }}>
                  {formatNumber(song.number)}
                  {song.composer && ` · ${song.composer}`}
                </p>
                <ChordSheet
                  lyrics={song.lyrics}
                  transpose={step.item.transpose}
                  fontSize={fontSize}
                  preferFlats={prefs.preferFlats}
                  chordClassName="[color:var(--mm-chord)]"
                />
                <div className="h-24" />
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {/* Navegação inferior */}
      <footer
        className={`flex h-[76px] shrink-0 items-center gap-2 border-t px-2 transition-opacity duration-300 sm:px-4 ${controls ? "opacity-100" : "opacity-40"}`}
        style={{ borderColor: pal.line, background: pal.ui }}
      >
        <button
          onClick={() => go(done ? steps.length - 1 : index - 1)}
          disabled={!done && !prev}
          className="flex h-14 min-w-0 flex-1 items-center gap-2 rounded-[10px] px-3 text-left disabled:opacity-30 sm:flex-none sm:basis-[240px]"
        >
          <ChevronLeft size={28} className="shrink-0" />
          <span className="min-w-0">
            <span className="block text-xs font-semibold uppercase tracking-[0.1em]" style={{ color: pal.muted }}>
              Anterior
            </span>
            <span className="block truncate font-semibold">{done ? steps.at(-1)?.slot.label : prev?.slot.label ?? "—"}</span>
          </span>
        </button>
        <div className="hidden flex-1 items-center justify-center gap-0.5 sm:flex" aria-hidden>
          {steps.map((_, i) => (
            <button key={i} tabIndex={-1} onClick={() => go(i)} className="grid h-8 min-w-6 place-items-center">
              <span
                className="block h-3 rounded-full transition-all"
                style={{ width: i === index && !done ? 24 : 12, background: i === index && !done ? pal.chord : visited.has(i) ? pal.muted : pal.line }}
              />
            </button>
          ))}
        </div>
        <button
          onClick={() => go(index + 1)}
          disabled={done}
          className="flex h-14 min-w-0 flex-1 items-center justify-end gap-2 rounded-[10px] px-3 text-right disabled:opacity-30 sm:flex-none sm:basis-[240px]"
          style={!done ? { background: pal.soft } : undefined}
        >
          <span className="min-w-0">
            <span className="block text-xs font-semibold uppercase tracking-[0.1em]" style={{ color: pal.muted }}>
              Próximo
            </span>
            <span className="block truncate font-semibold">{done ? "—" : next ? next.slot.label : "Fim ✣"}</span>
          </span>
          <ChevronRight size={28} className="shrink-0" />
        </button>
      </footer>

      {wakeLockOk === false && controls && !wakeDismissed && (
        <button
          onClick={() => setWakeDismissed(true)}
          className="absolute bottom-[84px] left-1/2 flex w-[90%] max-w-md -translate-x-1/2 items-center gap-3 rounded-[10px] px-4 py-2 text-left text-xs shadow-raised"
          style={{ background: pal.ui, color: pal.muted }}
        >
          <span className="flex-1">Seu aparelho pode apagar a tela. Desative o bloqueio automático nas configurações.</span>
          <X size={16} className="shrink-0" aria-label="Fechar aviso" />
        </button>
      )}

      {drawer && (
        <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label="Roteiro">
          <div className="absolute inset-0 bg-black/50" onClick={() => setDrawer(false)} />
          <div className="animate-fade-in absolute inset-y-0 left-0 w-[85vw] max-w-[340px]" style={{ background: pal.ui, color: pal.ink }}>
            {roteiro}
          </div>
        </div>
      )}

    </div>
  );
}
