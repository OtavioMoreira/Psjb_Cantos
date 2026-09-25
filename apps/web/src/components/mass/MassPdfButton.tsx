"use client";

import { useState } from "react";
import { FileDown, Loader2 } from "lucide-react";
import type { Mass } from "@/lib/types";
import { usePrefs } from "@/lib/store";
import { loadSongIndex } from "@/lib/useSongIndex";
import type { MassPdfOptions } from "@/lib/massPdf";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { toast } from "@/components/ui/Toast";

/** Botão "Baixar PDF" da missa: para imprimir ou ter tudo na ordem sem internet. */
export function MassPdfButton({ mass, className = "", compact = false }: { mass: Mass; className?: string; compact?: boolean }) {
  const prefs = usePrefs();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [opts, setOpts] = useState<Omit<MassPdfOptions, "preferFlats">>({ chords: true, size: "M", pagePerSong: true });
  const count = mass.slots.reduce((n, s) => n + s.items.length, 0);

  const generate = async () => {
    setBusy(true);
    try {
      const [songs, { generateMassPdf }] = await Promise.all([loadSongIndex(), import("@/lib/massPdf")]);
      const file = await generateMassPdf(mass, new Map(songs.map((s) => [s.id, s])), { ...opts, preferFlats: prefs.preferFlats });
      toast(`PDF pronto: ${file}`);
      setOpen(false);
    } catch {
      toast("Não foi possível gerar o PDF. Verifique sua conexão e tente de novo.");
    } finally {
      setBusy(false);
    }
  };

  const seg = (on: boolean) =>
    `min-h-11 flex-1 rounded-md px-3 text-sm font-medium ${on ? "bg-primary-soft font-semibold text-primary" : "text-ink-muted"}`;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        disabled={count === 0}
        title={count === 0 ? "Escolha ao menos um canto" : "Baixar a missa em PDF"}
        className={`inline-flex min-h-11 items-center gap-2 rounded-[10px] border border-primary px-4 text-sm font-semibold text-primary hover:bg-primary-soft disabled:opacity-50 ${className}`}
      >
        <FileDown size={18} /> {compact ? "PDF" : <><span className="sm:hidden">PDF</span><span className="hidden sm:inline">Baixar PDF</span></>}
      </button>
      {open && (
        <Modal
          title="Baixar missa em PDF"
          onClose={() => !busy && setOpen(false)}
          footer={
            <>
              <Button variant="ghost" onClick={() => setOpen(false)} disabled={busy}>
                Cancelar
              </Button>
              <Button onClick={generate} disabled={busy}>
                {busy ? <Loader2 size={18} className="animate-spin" /> : <FileDown size={18} />}
                {busy ? "Gerando…" : "Gerar PDF"}
              </Button>
            </>
          }
        >
          <p className="text-sm text-ink-muted">
            <strong className="text-ink">{mass.name || "Missa"}</strong>: {count} {count === 1 ? "canto" : "cantos"} na ordem da missa, com
            roteiro na primeira página. Serve para imprimir ou para abrir sem internet.
          </p>
          <div className="mt-5 space-y-5">
            <fieldset>
              <legend className="mb-2 text-sm font-medium">Conteúdo</legend>
              <div role="radiogroup" className="flex rounded-[10px] border border-border bg-surface p-1">
                <button role="radio" aria-checked={opts.chords} onClick={() => setOpts({ ...opts, chords: true })} className={seg(opts.chords)}>
                  Letra e cifra
                </button>
                <button role="radio" aria-checked={!opts.chords} onClick={() => setOpts({ ...opts, chords: false })} className={seg(!opts.chords)}>
                  Só a letra
                </button>
              </div>
              <p className="mt-1.5 text-xs text-ink-muted">
                {opts.chords ? "Para músicos: usa o tom definido em cada canto desta missa." : "Para quem canta: texto corrido, refrão em negrito."}
              </p>
            </fieldset>
            <fieldset>
              <legend className="mb-2 text-sm font-medium">Tamanho da letra</legend>
              <div role="radiogroup" className="flex rounded-[10px] border border-border bg-surface p-1">
                {(
                  [
                    ["P", "Pequena"],
                    ["M", "Média"],
                    ["G", "Grande"],
                  ] as const
                ).map(([id, label]) => (
                  <button key={id} role="radio" aria-checked={opts.size === id} onClick={() => setOpts({ ...opts, size: id })} className={seg(opts.size === id)}>
                    {label}
                  </button>
                ))}
              </div>
            </fieldset>
            <label className="flex min-h-11 items-center gap-3 text-sm">
              <input
                type="checkbox"
                checked={opts.pagePerSong}
                onChange={(e) => setOpts({ ...opts, pagePerSong: e.target.checked })}
                className="h-5 w-5 accent-[var(--primary-solid)]"
              />
              Cada canto começa em uma página nova
            </label>
          </div>
        </Modal>
      )}
    </>
  );
}
