"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { EyeOff, FileMusic, Guitar, Headphones, Loader2, Plus, Search, UploadCloud } from "lucide-react";
import { api, ApiError, SITE_CONTENT_EVENT, type ApiSiteStatus } from "@/lib/api";
import type { ApiSong } from "@/lib/apiSongs";
import { formatNumber } from "@/lib/liturgy";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { toast } from "@/components/ui/Toast";
import { AdminTitle } from "./AdminShell";

const PAGE = 50;

export const songEditUrl = (id: number) => `/painel/admin/cantos/editar?id=${id}`;

/** Lista de cantos do admin (inclui os ocultos), com busca no servidor. */
export function SongsAdmin() {
  const [q, setQ] = useState("");
  const [state, setState] = useState<{ q: string; songs: ApiSong[]; total: number; page: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [more, setMore] = useState(false);

  // Busca com espera de 300 ms: não chama a API a cada letra.
  useEffect(() => {
    let alive = true;
    const t = setTimeout(() => {
      api.admin
        .songs({ q: q.trim() || undefined, pageSize: PAGE })
        .then((r) => alive && (setState({ q, songs: r.songs, total: r.total, page: 1 }), setError(null)))
        .catch((e) => alive && setError(e instanceof ApiError ? e.message : "Não foi possível carregar os cantos."));
    }, 300);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [q]);

  const loadMore = async () => {
    if (!state) return;
    setMore(true);
    try {
      const r = await api.admin.songs({ q: state.q.trim() || undefined, pageSize: PAGE, page: state.page + 1 });
      setState({ ...state, songs: [...state.songs, ...r.songs], page: state.page + 1 });
    } finally {
      setMore(false);
    }
  };

  const loading = !state || state.q !== q;

  return (
    <div>
      <AdminTitle title="Cantos" description="As alterações aparecem no site depois de “Publicar no site” (o site é gerado de novo em alguns minutos).">
        <PublishSiteButton />
        <ButtonLink href="/painel/admin/cantos/editar">
          <Plus size={18} /> Novo canto
        </ButtonLink>
      </AdminTitle>

      <label className="relative mt-6 block">
        <span className="sr-only">Buscar canto</span>
        <Search size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" />
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar por número, título, autor ou trecho da letra"
          className="h-11 w-full rounded-[10px] border border-border bg-surface pl-10 pr-3 outline-none focus:border-primary focus:ring-2 focus:ring-gold/40"
        />
      </label>

      <p className="mt-4 flex items-center gap-2 text-sm text-ink-muted" aria-live="polite">
        {loading ? (
          <>
            <Loader2 size={14} className="animate-spin" /> Buscando…
          </>
        ) : (
          `${state.total} ${state.total === 1 ? "canto" : "cantos"}`
        )}
      </p>
      {error && (
        <p role="alert" className="mt-2 rounded-md bg-danger/10 px-3 py-2 text-sm text-danger">
          {error}
        </p>
      )}

      <ul className="mt-2 grid grid-cols-1 gap-3 lg:grid-cols-2" aria-busy={loading}>
        {state?.songs.map((s) => (
          <li key={s.id}>
            <Link
              href={songEditUrl(s.id)}
              className="flex min-h-[84px] items-start gap-3 rounded-[12px] border border-border bg-surface p-4 shadow-card transition hover:border-primary hover:shadow-raised"
            >
              <span className="w-14 shrink-0 font-serif text-lg font-semibold text-gold-ink [font-variant-numeric:lining-nums]">{formatNumber(s.number) ?? "—"}</span>
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold">{s.title}</span>
                  {!s.active && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-surface-2 px-2 py-0.5 text-xs font-semibold text-ink-muted">
                      <EyeOff size={12} /> Oculto
                    </span>
                  )}
                </span>
                {s.composer && <span className="block truncate text-sm text-ink-muted">{s.composer}</span>}
                <span className="mt-1.5 flex flex-wrap items-center gap-1.5">
                  {s.flags.slice(0, 4).map((f) => (
                    <span key={f.id} className="rounded-full border border-border px-2 py-0.5 text-xs text-ink-muted">
                      {f.name}
                    </span>
                  ))}
                  {s.flags.length > 4 && <span className="text-xs text-ink-muted">+{s.flags.length - 4}</span>}
                </span>
              </span>
              <span className="flex shrink-0 gap-1.5 text-ink-muted" aria-label="Arquivos">
                {s.media.cifraPdf && <Guitar size={16} aria-label="Cifra em PDF" />}
                {s.media.partituraPdf && <FileMusic size={16} aria-label="Partitura" />}
                {(s.media.audio || s.media.audiomack) && <Headphones size={16} aria-label="Áudio" />}
              </span>
            </Link>
          </li>
        ))}
      </ul>
      {state && !loading && state.songs.length === 0 && <p className="py-10 text-center text-ink-muted">Nenhum canto encontrado.</p>}
      {state && !loading && state.songs.length < state.total && (
        <div className="mt-6 flex justify-center">
          <Button variant="secondary" onClick={loadMore} disabled={more}>
            {more && <Loader2 size={16} className="animate-spin" />} Mostrar mais ({state.total - state.songs.length})
          </Button>
        </div>
      )}
    </div>
  );
}

/** Pede um novo build do site para as mudanças em cantos e flags aparecerem nas páginas públicas. */
/** Status da publicação, atualizado ao abrir, ao voltar para a aba e a cada mudança em cantos ou flags. */
function useSiteStatus() {
  const [status, setStatus] = useState<ApiSiteStatus | null>(null);
  useEffect(() => {
    let alive = true;
    const load = () => void api.admin.siteStatus().then((s) => alive && setStatus(s), () => undefined);
    load();
    const onVisible = () => document.visibilityState === "visible" && load();
    window.addEventListener(SITE_CONTENT_EVENT, load);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      alive = false;
      window.removeEventListener(SITE_CONTENT_EVENT, load);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);
  return [status, setStatus] as const;
}

const when = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });

export function PublishSiteButton() {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useSiteStatus();
  const pending = Boolean(status?.enabled && status.pending);
  return (
    <>
      <span className="flex flex-col items-stretch gap-1 sm:items-end">
        <Button variant={pending ? "primary" : "secondary"} onClick={() => setOpen(true)}>
          <UploadCloud size={18} /> Publicar no site
          {pending && <span aria-hidden className="h-2 w-2 rounded-full bg-gold" />}
        </Button>
        {status && (
          <span role="status" className={`text-xs ${pending ? "font-medium text-gold-ink" : "text-ink-muted"}`}>
            {pending
              ? "Há alterações não publicadas"
              : status.publishedAt
                ? `Publicado em ${when(status.publishedAt)}${status.publishedBy ? ` por ${status.publishedBy.split(" ")[0]}` : ""}`
                : null}
          </span>
        )}
      </span>
      {open && (
        <Modal
          title="Publicar no site"
          onClose={() => setOpen(false)}
          footer={
            <>
              <Button variant="ghost" onClick={() => setOpen(false)}>
                Cancelar
              </Button>
              <Button
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  try {
                    setStatus(await api.admin.publishSite());
                    toast("Publicação pedida. O site atualiza em alguns minutos.");
                    setOpen(false);
                  } catch (e) {
                    toast(e instanceof ApiError ? e.message : "Não foi possível publicar agora.");
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                {busy ? <Loader2 size={18} className="animate-spin" /> : <UploadCloud size={18} />} Publicar agora
              </Button>
            </>
          }
        >
          <p className="text-ink-muted">
            As páginas dos cantos são geradas de antemão, para abrirem rápido e funcionarem no Modo Missa mesmo com internet ruim. Depois de
            criar ou editar cantos e flags, publique para o site ser gerado de novo. Leva alguns minutos.
          </p>
          {status && (
            <p className="mt-3 text-sm">
              {status.pending ? (
                <>
                  <strong className="text-gold-ink">Há alterações não publicadas</strong> (a última em {when(status.contentChangedAt)}).
                </>
              ) : (
                "Nenhuma alteração desde a última publicação."
              )}
              {status.publishedAt && ` Última publicação: ${when(status.publishedAt)}${status.publishedBy ? `, por ${status.publishedBy}` : ""}.`}
            </p>
          )}
        </Modal>
      )}
    </>
  );
}
