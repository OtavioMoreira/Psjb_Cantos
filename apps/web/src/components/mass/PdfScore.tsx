"use client";

import { useEffect, useRef, useState } from "react";

type Status = "loading" | "ready" | "error";

/**
 * Desenha todas as páginas de um PDF na largura da tela (pdf.js, carregado só quando aparece).
 * O <iframe> não serve aqui: o Chrome do Android não mostra PDF embutido e o iPad só mostra a 1ª página.
 * `filter` deixa a partitura nas cores da paleta (ex.: invertida na Noite).
 */
export function PdfScore({ src, title, filter, onError }: { src: string; title: string; filter?: string; onError: (src: string) => void }) {
  const box = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<Status>("loading");
  const [width, setWidth] = useState(0);

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
    const el = box.current;
    if (!el || !width) return;
    let cancelled = false;
    let destroy: (() => void) | undefined;
    (async () => {
      try {
        const pdfjs = await import("pdfjs-dist");
        pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
        const task = pdfjs.getDocument({ url: src });
        destroy = () => void task.destroy();
        const doc = await task.promise;
        const canvases: HTMLCanvasElement[] = [];
        const ratio = Math.min(window.devicePixelRatio || 1, 3);
        for (let n = 1; n <= doc.numPages; n++) {
          const page = await doc.getPage(n);
          if (cancelled) return;
          const base = page.getViewport({ scale: 1 });
          const viewport = page.getViewport({ scale: (width / base.width) * ratio });
          const canvas = document.createElement("canvas");
          canvas.width = Math.floor(viewport.width);
          canvas.height = Math.floor(viewport.height);
          canvas.style.width = "100%";
          canvas.style.display = "block";
          canvas.setAttribute("aria-hidden", "true");
          await page.render({ canvas, viewport }).promise;
          canvases.push(canvas);
        }
        if (cancelled) return;
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
      destroy?.();
    };
  }, [src, width, onError]);

  return (
    <div role="img" aria-label={`Partitura: ${title}`}>
      {status === "loading" && <div className="aspect-[1/1.414] w-full animate-pulse rounded bg-black/5" />}
      <div ref={box} className="flex flex-col gap-3" style={{ filter }} />
    </div>
  );
}
