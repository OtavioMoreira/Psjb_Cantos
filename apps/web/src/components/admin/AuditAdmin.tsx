"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { History, Loader2 } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { auditDetails, auditSentence, type AuditEntry, type AuditTarget } from "@/lib/audit";
import { Button } from "@/components/ui/Button";
import { AdminTitle } from "./AdminShell";
import { songEditUrl } from "./SongsAdmin";

const PAGE = 50;

const FILTERS: [AuditTarget | "todos", string][] = [
  ["todos", "Tudo"],
  ["user", "Usuários"],
  ["song", "Cantos"],
  ["flag", "Flags"],
  ["movement", "Movimentos"],
  ["site", "Publicação"],
  ["import", "Salmos"],
];

const when = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });

/** Admin › Auditoria: quem fez o quê na administração, do mais recente ao mais antigo. */
export function AuditAdmin() {
  const [filter, setFilter] = useState<AuditTarget | "todos">("todos");
  const [state, setState] = useState<{ filter: string; entries: AuditEntry[]; total: number; page: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [more, setMore] = useState(false);
  const targetType = filter === "todos" ? undefined : filter;

  useEffect(() => {
    let alive = true;
    api.admin
      .audit({ targetType, pageSize: PAGE })
      .then((r) => alive && (setState({ filter, entries: r.entries, total: r.total, page: 1 }), setError(null)))
      .catch((e) => alive && setError(e instanceof ApiError ? e.message : "Não foi possível carregar a auditoria."));
    return () => {
      alive = false;
    };
  }, [filter, targetType]);

  const loadMore = async () => {
    if (!state) return;
    setMore(true);
    try {
      const r = await api.admin.audit({ targetType, page: state.page + 1, pageSize: PAGE });
      setState({ ...state, entries: [...state.entries, ...r.entries], page: state.page + 1 });
    } finally {
      setMore(false);
    }
  };

  const loading = !state || state.filter !== filter;

  return (
    <div className="max-w-[860px]">
      <AdminTitle title="Auditoria" description="Tudo o que foi feito na administração: quem fez, o quê e quando. Os registros ficam guardados por 2 anos." />

      <div role="group" aria-label="Filtrar por tipo" className="mt-6 flex flex-wrap gap-2">
        {FILTERS.map(([id, label]) => (
          <button
            key={id}
            aria-pressed={filter === id}
            onClick={() => setFilter(id)}
            className="min-h-11 rounded-full border border-border bg-surface px-4 text-sm font-medium text-ink-muted transition hover:border-primary hover:text-primary aria-pressed:border-primary aria-pressed:bg-primary-soft aria-pressed:text-primary"
          >
            {label}
          </button>
        ))}
      </div>

      <p className="mt-4 text-sm text-ink-muted" aria-live="polite">
        {loading ? "Carregando…" : `${state.total} ${state.total === 1 ? "registro" : "registros"}`}
      </p>
      {error && (
        <p role="alert" className="mt-2 rounded-md bg-danger/10 px-3 py-2 text-sm text-danger">
          {error}
        </p>
      )}

      {!loading && state.entries.length === 0 && (
        <div className="mt-6 flex flex-col items-center rounded-[16px] border border-dashed border-border px-4 py-12 text-center text-ink-muted">
          <History size={32} className="text-gold" />
          <p className="mt-3">Nenhum registro por aqui ainda.</p>
        </div>
      )}

      {!loading && state.entries.length > 0 && (
        <ol className="mt-2 divide-y divide-border rounded-[16px] border border-border bg-surface shadow-card">
          {state.entries.map((e) => {
            const detail = auditDetails(e);
            const songLink = e.targetType === "song" && e.action !== "song.delete" && e.targetId ? songEditUrl(Number(e.targetId)) : null;
            return (
              <li key={e.id} className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-baseline sm:gap-4">
                <time dateTime={e.createdAt} className="shrink-0 text-sm text-ink-muted sm:w-40 [font-variant-numeric:lining-nums]">
                  {when(e.createdAt)}
                </time>
                <div className="min-w-0">
                  <p className="break-words">
                    <strong className="font-semibold">{e.actorName}</strong>{" "}
                    {songLink ? (
                      <Link href={songLink} className="underline decoration-border underline-offset-2 hover:text-primary hover:decoration-primary">
                        {auditSentence(e)}
                      </Link>
                    ) : (
                      auditSentence(e)
                    )}
                  </p>
                  {detail && <p className="mt-0.5 break-words text-sm text-ink-muted">{detail}</p>}
                </div>
              </li>
            );
          })}
        </ol>
      )}

      {state && !loading && state.entries.length < state.total && (
        <div className="mt-4 flex justify-center">
          <Button variant="secondary" onClick={loadMore} disabled={more}>
            {more && <Loader2 size={16} className="animate-spin" />} Mostrar mais ({state.total - state.entries.length})
          </Button>
        </div>
      )}
    </div>
  );
}
