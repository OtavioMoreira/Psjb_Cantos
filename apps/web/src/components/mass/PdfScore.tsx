"use client";

import { useEffect, useRef, useState } from "react";
import type { PageViewport, PDFPageProxy, RenderTask } from "pdfjs-dist";
import { transposeChord } from "@/lib/chords";
import { chordParts, findScoreChords, type ScoreChord } from "@/lib/scoreChords";

type Status = "loading" | "ready" | "error";
type Page = { page: PDFPageProxy; chords: ScoreChord[] };

/**
 * Desenha todas as páginas de um PDF na largura da tela (pdf.js, carregado só quando aparece).
 * O <iframe> não serve aqui: o Chrome do Android não mostra PDF embutido e o iPad só mostra a 1ª página.
 * `filter` deixa a partitura nas cores da paleta (ex.: invertida na Noite).
 * Com `transpose`, troca só os acordes (texto do PDF) pelos do tom novo; as notas da pauta ficam como estão.
 * O PDF é baixado uma vez: trocar o tom ou girar a tela só redesenha.
 */
export function PdfScore({
  src,
  title,
  filter,
  transpose = 0,
  preferFlats = false,
  onError,
  onChords,
}: {
  src: string;
  title: string;
  filter?: string;
  transpose?: number;
  preferFlats?: boolean;
  onError: (src: string) => void;
  /** Avisa o 1º acorde achado (null = PDF sem acordes em texto). */
  onChords?: (src: string, first: string | null) => void;
}) {
  const box = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<Status>("loading");
  const [width, setWidth] = useState(0);
  const [pages, setPages] = useState<Page[] | null>(null);

  // Redesenha só quando a largura muda de verdade (girar o tablet, abrir o roteiro).
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    let timer: ReturnType<typeof setTimeout>;
    const ro = new ResizeObserver(([e]) => {
      clearTimeout(timer);
      timer = setTimeout(() => setWidth(Math.round(e.contentRect.width)), 150);
    });
    ro.observe(el);
    return () => {
      ro.disconnect();
      clearTimeout(timer);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    let destroy: (() => void) | undefined;
    (async () => {
      try {
        const pdfjs = await import("pdfjs-dist");
        pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
        const task = pdfjs.getDocument({ url: src });
        destroy = () => void task.destroy();
        const doc = await task.promise;
        const list: Page[] = [];
        for (let n = 1; n <= doc.numPages; n++) {
          const page = await doc.getPage(n);
          const text = await page.getTextContent();
          const items = text.items.flatMap((i) => ("str" in i ? [{ str: i.str, x: i.transform[4], y: i.transform[5], w: i.width, h: i.height }] : []));
          list.push({ page, chords: findScoreChords(items, page.view[2]) });
        }
        if (cancelled) return;
        setPages(list);
        onChords?.(src, list.flatMap((p) => p.chords)[0]?.chord ?? null);
      } catch {
        if (!cancelled) {
          setStatus("error");
          onError(src);
        }
      }
    })();
    return () => {
      cancelled = true;
      destroy?.();
    };
  }, [src, onError, onChords]);

  useEffect(() => {
    const el = box.current;
    if (!el || !pages || !width) return;
    let cancelled = false;
    const tasks: RenderTask[] = [];
    (async () => {
      try {
        const canvases: HTMLCanvasElement[] = [];
        const ratio = Math.min(window.devicePixelRatio || 1, 3);
        for (const { page, chords } of pages) {
          const base = page.getViewport({ scale: 1 });
          const viewport = page.getViewport({ scale: (width / base.width) * ratio });
          const canvas = document.createElement("canvas");
          canvas.width = Math.floor(viewport.width);
          canvas.height = Math.floor(viewport.height);
          canvas.style.width = "100%";
          canvas.style.display = "block";
          canvas.setAttribute("aria-hidden", "true");
          const task = page.render({ canvas, viewport });
          tasks.push(task);
          await task.promise;
          if (cancelled) return;
          if (transpose) drawChords(canvas, viewport, chords, transpose, preferFlats);
          canvases.push(canvas);
        }
        el.replaceChildren(...canvases);
        setStatus("ready");
      } catch {
        if (!cancelled) {
          setStatus("error");
          onError(src);
        }
      }
    })();
    return () => {
      cancelled = true;
      tasks.forEach((t) => t.cancel());
    };
  }, [pages, width, transpose, preferFlats, src, onError]);

  return (
    <div role="img" aria-label={`Partitura: ${title}`}>
      {status === "loading" && <div className="aspect-[1/1.414] w-full animate-pulse rounded bg-black/5" />}
      <div ref={box} className="flex flex-col gap-3" style={{ filter }} />
    </div>
  );
}

const SERIF = '"Times New Roman", Times, "Liberation Serif", "Nimbus Roman", "Noto Serif", serif';

/** Cobre cada acorde original com o fundo da página e escreve o novo no mesmo lugar, no estilo do PDF. */
function drawChords(canvas: HTMLCanvasElement, viewport: PageViewport, chords: ScoreChord[], semitones: number, preferFlats: boolean) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const s = viewport.scale;
  for (const c of chords) {
    const parts = chordParts(transposeChord(c.chord, semitones, preferFlats));
    if (!parts) continue;
    const [x, y] = viewport.convertToViewportPoint(c.x, c.y);
    const size = c.size * s;
    // [texto, tamanho, subida]: acidente um pouco menor e alto (como o ♯ do PDF); extensão sobrescrita (E⁷).
    const segs: [string, number, number][] = [[parts.root, 1, 0]];
    const acc = (a: string) => a && segs.push([a === "#" ? "♯" : "♭", 0.8, 0.3]);
    acc(parts.acc);
    if (parts.minor) segs.push([parts.minor, 1, 0]);
    if (parts.ext) segs.push([parts.ext, 0.72, 0.38]);
    if (parts.bass) {
      segs.push(["/" + parts.bass.root, 1, 0]);
      acc(parts.bass.acc);
    }
    const widths = segs.map(([t, k]) => {
      ctx.font = `${size * k}px ${SERIF}`;
      return ctx.measureText(t).width;
    });
    const total = widths.reduce((a, b) => a + b, 0);
    // Se o acorde novo ficar mais largo que o espaço até o próximo, aperta na horizontal.
    const squeeze = Math.min(1, ((c.limit - c.x) * s) / total);
    const cover = Math.max((c.right - c.x) * s, total * squeeze);
    ctx.fillStyle = "#fff";
    ctx.fillRect(x - s, y - size * 1.2, cover + 2 * s, size * 1.42);
    ctx.fillStyle = "#000";
    ctx.textBaseline = "alphabetic";
    let cx = x;
    segs.forEach(([t, k, rise], i) => {
      ctx.font = `${size * k}px ${SERIF}`;
      ctx.fillText(t, cx, y - rise * size, widths[i] * squeeze);
      cx += widths[i] * squeeze;
    });
  }
}
