"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { CalendarClock, ExternalLink, Loader2, RefreshCw } from "lucide-react";
import { api, ApiError, type ApiImportItem, type ApiImportRun, type ImportStatus } from "@/lib/api";
import { formatDateShort } from "@/lib/liturgy";
import { Button } from "@/components/ui/Button";
import { toast } from "@/components/ui/Toast";
import { AdminTitle } from "./AdminShell";
import { songEditUrl } from "./SongsAdmin";

const STATUS: Record<ImportStatus, { label: string; tone: string }> = {
  created: { label: "Novo (oculto)", tone: "bg-gold-soft text-gold-ink" },
  linked: { label: "Já existia", tone: "bg-primary-soft text-primary" },
  review: { label: "A revisar", tone: "bg-gold-soft text-gold-ink" },
  ignored: { label: "Ignorado", tone: "bg-surface-2 text-ink-muted" },
  failed: { label: "Falhou", tone: "bg-danger/10 text-danger" },
};
const SUMMARY: Record<string, string> = { created: "novos", linked: "já existiam", review: "a revisar", failed: "falharam", skipped: "já lidos" };

const summaryText = (s: Record<string, number>) =>
  Object.entries(s)
    .filter(([, n]) => n > 0)
    .map(([k, n]) => `${n} ${SUMMARY[k] ?? k}`)
    .join(" · ") || "nada novo";
const when = (iso: string) => new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

/** Salmos e aclamações lidos do site da Diocese de Montenegro: execuções, itens e a revisão. */
export function ImportsAdmin() {
  const [data, setData] = useState<{ items: ApiImportItem[]; runs: ApiImportRun[] } | null>(null);
  const [filter, setFilter] = useState<"review" | "all">("all");
  const [titles, setTitles] = useState<Record<number, string>>({});
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(
    () =>
      api.admin
        .imports()
        .catch(() => ({ items: [] as ApiImportItem[], runs: [] as ApiImportRun[] }))
        .then((d) => {
          setData(d);
          // Títulos dos cantos citados (criados, reconhecidos e candidatos da revisão).
          const ids = [...new Set(d.items.flatMap((i) => [i.songId, ...i.candidateSongIds]).filter((x): x is number => Boolean(x)))];
          return Promise.all(ids.map((id) => api.admin.song(id).then((s) => [id, s.title] as const).catch(() => null)));
        })
        .then((found) => setTitles(Object.fromEntries(found.filter((x): x is readonly [number, string] => Boolean(x))))),
    [],
  );
  useEffect(() => {
    void load();
  }, [load]);

  const attempt = async (key: string, task: () => Promise<string>) => {
    setBusy(key);
    try {
      toast(await task());
      await load();
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Não foi possível agora.");
    } finally {
      setBusy(null);
    }
  };

  const review = data?.items.filter((i) => i.status === "review") ?? [];
  const shown = filter === "review" ? review : (data?.items ?? []);

  return (
    <div className="max-w-[880px]">
      <AdminTitle
        title="Salmos da diocese"
        description={
          <>
            Salmos e aclamações da semana, lidos do{" "}
            <a href="https://www.diocesemontenegro.org.br/salmos-e-aclamacoes" target="_blank" rel="noopener" className="text-primary underline-offset-2 hover:underline">
              site da Diocese de Montenegro
            </a>
            . O que é novo entra <strong>oculto</strong>: confira a letra no editor e marque “Visível no repertório”.
          </>
        }
      >
        <Button onClick={() => attempt("run", async () => `Busca concluída: ${summaryText((await api.admin.runImport()).summary)}.`)} disabled={busy !== null}>
          {busy === "run" ? <Loader2 size={18} className="animate-spin" /> : <RefreshCw size={18} />} Buscar agora
        </Button>
      </AdminTitle>

      <section className="mt-6 rounded-[16px] border border-border bg-surface p-5 shadow-card">
        <h2 className="flex items-center gap-2 font-semibold">
          <CalendarClock size={18} className="text-gold" /> Rotina automática: segunda a quinta, às 3h
        </h2>
        <p className="mt-1 text-sm text-ink-muted">Cada execução pega os itens de hoje até 10 dias adiante. O que já foi lido não é lido de novo.</p>
        {!data ? (
          <Loader2 size={20} className="mt-4 animate-spin text-ink-muted" />
        ) : data.runs.length ? (
          <ul className="mt-3 divide-y divide-border text-sm">
            {data.runs.slice(0, 5).map((r) => (
              <li key={r.id} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-2">
                <span className="[font-variant-numeric:lining-nums]">
                  {when(r.startedAt)} · {r.trigger === "cron" ? "automática" : "manual"}
                </span>
                <span className={r.error ? "text-danger" : "text-ink-muted"}>{r.error ? `Erro: ${r.error}` : summaryText(r.summary)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-sm text-ink-muted">Ainda não rodou nenhuma vez.</p>
        )}
      </section>

      <div role="radiogroup" aria-label="Filtro" className="mt-8 inline-flex rounded-[10px] border border-border bg-surface p-1 text-sm">
        {(
          [
            ["all", `Todos (${data?.items.length ?? 0})`],
            ["review", `A revisar (${review.length})`],
          ] as const
        ).map(([v, l]) => (
          <button
            key={v}
            role="radio"
            aria-checked={filter === v}
            onClick={() => setFilter(v)}
            className="min-h-9 rounded-md px-3 py-1 text-ink-muted aria-checked:bg-primary-soft aria-checked:font-semibold aria-checked:text-primary"
          >
            {l}
          </button>
        ))}
      </div>

      <ul className="mt-4 grid grid-cols-1 gap-3">
        {data && !shown.length && <li className="text-sm text-ink-muted">{filter === "review" ? "Nada para revisar." : "Nenhum item lido ainda."}</li>}
        {shown.map((i) => (
          <li key={i.id} className="rounded-[16px] border border-border bg-surface p-4 shadow-card">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm text-ink-muted [font-variant-numeric:lining-nums]">{formatDateShort(i.celebrationDate)}</p>
                <p className="font-semibold">{i.title}</p>
              </div>
              <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS[i.status].tone}`}>{STATUS[i.status].label}</span>
            </div>
            {i.message && <p className="mt-1 text-sm text-ink-muted">{i.message}</p>}
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
              {i.songId && (
                <Link href={songEditUrl(i.songId)} className="font-medium text-primary hover:underline">
                  Abrir canto{titles[i.songId] ? `: ${titles[i.songId]}` : ""}
                </Link>
              )}
              {i.pdfUrl && (
                <a href={i.pdfUrl} target="_blank" rel="noopener" className="inline-flex items-center gap-1 text-ink-muted hover:text-primary">
                  PDF na diocese <ExternalLink size={14} />
                </a>
              )}
            </div>
            {i.status === "review" && (
              <div className="mt-3 border-t border-border pt-3">
                {i.candidateSongIds.length > 0 && (
                  <>
                    <p className="text-sm font-medium">É um destes cantos?</p>
                    <ul className="mt-2 grid grid-cols-1 gap-2">
                      {i.candidateSongIds.map((id) => (
                        <li key={id} className="flex flex-wrap items-center justify-between gap-2 rounded-[10px] bg-surface-2 px-3 py-2 text-sm">
                          <Link href={songEditUrl(id)} className="min-w-0 hover:text-primary hover:underline">
                            {titles[id] ?? `Canto ${id}`}
                          </Link>
                          <Button
                            variant="secondary"
                            disabled={busy !== null}
                            onClick={() => attempt(`l${i.id}`, async () => (await api.admin.resolveImport(i.id, { action: "link", songId: id }), "Ligado ao canto existente."))}
                          >
                            É este
                          </Button>
                        </li>
                      ))}
                    </ul>
                  </>
                )}
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button disabled={busy !== null} onClick={() => attempt(`c${i.id}`, async () => (await api.admin.resolveImport(i.id, { action: "create" }), "Canto novo criado (oculto)."))}>
                    {busy === `c${i.id}` && <Loader2 size={18} className="animate-spin" />} É um canto novo
                  </Button>
                  <Button variant="ghost" disabled={busy !== null} onClick={() => attempt(`i${i.id}`, async () => (await api.admin.resolveImport(i.id, { action: "ignore" }), "Item ignorado."))}>
                    Ignorar
                  </Button>
                </div>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
