"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Copy, Link2, Link2Off, Loader2, Search, Share2, Users, X } from "lucide-react";
import type { Mass } from "@/lib/types";
import { createShareLink, initials, rememberPeople, revokeShareLink, useMasses, usePeopleLookup, useUsers } from "@/lib/store";
import { api, API_ENABLED, ApiError } from "@/lib/api";
import { BASE_PATH } from "@/lib/routes";
import { normalize } from "@/lib/search";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { toast } from "@/components/ui/Toast";
import { ROLE_LABEL } from "@/components/admin/UsersAdmin";

const pessoas = (n: number) => `${n} ${n === 1 ? "pessoa" : "pessoas"}`;

/** Pessoa que aparece na lista do modal (conta local na demonstração, ou resultado da busca na API). */
interface Candidate {
  id: string;
  name: string;
  email: string;
  detail: string;
}

function Avatar({ name, size = 36 }: { name: string; size?: number }) {
  return (
    <span
      aria-hidden
      className="grid shrink-0 place-items-center rounded-full border-2 border-surface bg-primary-soft font-semibold text-primary"
      style={{ width: size, height: size, fontSize: Math.max(10, size * 0.34), letterSpacing: "-0.02em" }}
    >
      {initials(name) || "?"}
    </span>
  );
}

/** Pilha de iniciais de quem tem acesso à missa ("+2" quando passa de 3). */
export function SharedAvatars({ ids, size = 28 }: { ids: string[]; size?: number }) {
  const person = usePeopleLookup();
  const list = ids.map((id) => person(id)).filter((u): u is { id: string; name: string } => Boolean(u));
  if (!list.length) return null;
  return (
    <span className="flex shrink-0 -space-x-1" title={list.map((u) => u.name).join(", ")}>
      {list.slice(0, 3).map((u) => (
        <Avatar key={u.id} name={u.name} size={size} />
      ))}
      {list.length > 3 && (
        <span aria-hidden className="grid shrink-0 place-items-center rounded-full border-2 border-surface bg-surface-2 text-xs font-semibold text-ink-muted" style={{ width: size, height: size }}>
          +{list.length - 3}
        </span>
      )}
    </span>
  );
}

/** Botão "Compartilhar": escolhe, com busca, as pessoas que também podem usar a missa, ou gera um link de convite. */
export function ShareMassButton({
  mass,
  onChange,
  compact = false,
  className = "",
}: {
  mass: Mass;
  onChange: (sharedWith: string[]) => void;
  compact?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const count = mass.sharedWith?.length ?? 0;
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        title="Compartilhar com a equipe"
        className={`inline-flex min-h-11 items-center gap-2 rounded-[10px] border border-primary ${compact ? "px-4" : "px-3 sm:px-4"} text-sm font-semibold text-primary hover:bg-primary-soft ${className}`}
      >
        <Users size={18} />
        {/* Na barra do editor, no celular, fica só o ícone para caber o Modo Missa. */}
        <span className={compact ? "" : "sr-only sm:not-sr-only"}>Compartilhar</span>
        {count > 0 && <span className={`${compact ? "" : "hidden sm:inline"} rounded-full bg-primary-soft px-1.5 text-xs [font-variant-numeric:lining-nums]`}>{count}</span>}
      </button>
      {open && (
        <ShareModal
          mass={mass}
          onClose={() => setOpen(false)}
          onSave={(ids) => {
            onChange(ids);
            setOpen(false);
            toast(ids.length ? `Missa compartilhada com ${pessoas(ids.length)}.` : "A missa não está mais compartilhada.");
          }}
        />
      )}
    </>
  );
}

/** Demonstração: as contas do aparelho. Com a API: busca no servidor (só contas ativas, sem o dono). */
function useCandidates(q: string, ownerId: string | undefined): { list: Candidate[]; loading: boolean } {
  const users = useUsers();
  const [remote, setRemote] = useState<{ q: string; list: Candidate[] } | null>(null);

  useEffect(() => {
    if (!API_ENABLED) return;
    let alive = true;
    const t = setTimeout(() => {
      api
        .searchPeople(q.trim())
        .then((found) => {
          if (!alive) return;
          rememberPeople(found);
          setRemote({ q, list: found.map((p) => ({ id: p.id, name: p.name, email: p.email, detail: p.movement ?? "" })) });
        })
        .catch(() => alive && setRemote({ q, list: [] }));
    }, 250);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [q]);

  const local = useMemo(() => {
    const terms = normalize(q.trim()).split(/\s+/).filter(Boolean);
    return users
      .filter((u) => u.status === "ativo" && u.id !== ownerId)
      .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"))
      .map((u) => ({ id: u.id, name: u.name, email: u.email, detail: [ROLE_LABEL[u.role], u.movement].filter(Boolean).join(" · ") }))
      .filter((u) => terms.every((t) => normalize(`${u.name} ${u.email} ${u.detail}`).includes(t)));
  }, [users, ownerId, q]);

  if (!API_ENABLED) return { list: local, loading: false };
  return { list: remote?.list ?? [], loading: remote?.q !== q };
}

function ShareModal({ mass, onClose, onSave }: { mass: Mass; onClose: () => void; onSave: (ids: string[]) => void }) {
  const person = usePeopleLookup();
  const [selected, setSelected] = useState<string[]>(mass.sharedWith ?? []);
  const [q, setQ] = useState("");
  const { list: results, loading } = useCandidates(q, mass.ownerId);

  const toggle = (id: string) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  const initial = mass.sharedWith ?? [];
  const dirty = initial.length !== selected.length || selected.some((id) => !initial.includes(id));

  return (
    <Modal
      title="Compartilhar missa"
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={() => onSave(selected)} disabled={!dirty}>
            <Check size={18} /> {selected.length ? `Compartilhar com ${pessoas(selected.length)}` : "Salvar"}
          </Button>
        </>
      }
    >
      <p className="text-sm text-ink-muted">
        Quem tiver acesso vê <strong className="text-ink">{mass.name || "esta missa"}</strong> em Minhas Missas, pode editar os cantos, abrir no
        Modo Missa e baixar o PDF. Só você exclui a missa ou muda o compartilhamento.
      </p>

      {API_ENABLED && <InviteLink mass={mass} />}

      {/* Selecionados */}
      <div className="mt-5">
        <p className="mb-2 text-sm font-medium">
          Com acesso <span className="text-ink-muted">({selected.length})</span>
        </p>
        {selected.length ? (
          <ul className="flex flex-wrap gap-2">
            {selected.map((id) => {
              const name = person(id)?.name ?? "Pessoa";
              return (
                <li key={id}>
                  <button
                    onClick={() => toggle(id)}
                    aria-label={`Remover ${name}`}
                    className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-primary bg-primary-soft py-1 pl-1 pr-2.5 text-sm font-medium text-primary hover:bg-primary-soft/70"
                  >
                    <Avatar name={name} size={26} />
                    <span className="max-w-[160px] truncate">{name}</span>
                    <X size={14} />
                  </button>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-sm text-ink-muted">Ninguém ainda. Busque abaixo e marque as pessoas{API_ENABLED ? ", ou mande o link de convite" : ""}.</p>
        )}
      </div>

      {/* Busca + lista com seleção múltipla */}
      <label className="relative mt-5 block">
        <span className="sr-only">Buscar pessoa</span>
        <Search size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" />
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar por nome, e-mail ou movimento"
          className="h-11 w-full rounded-[10px] border border-border bg-surface pl-10 pr-3 outline-none focus:border-primary focus:ring-2 focus:ring-gold/40"
        />
      </label>
      <ul role="listbox" aria-multiselectable="true" aria-label="Pessoas" aria-busy={loading} className="mt-2 rounded-[10px] border border-border sm:max-h-72 sm:overflow-y-auto">
        {results.map((u) => {
          const on = selected.includes(u.id);
          return (
            <li key={u.id} role="option" aria-selected={on} className="border-b border-border last:border-b-0">
              <button onClick={() => toggle(u.id)} className={`flex min-h-14 w-full items-center gap-3 px-3 py-2 text-left hover:bg-surface-2 ${on ? "bg-primary-soft/60" : ""}`}>
                <span
                  aria-hidden
                  className={`grid h-5 w-5 shrink-0 place-items-center rounded border-2 ${on ? "border-primary-solid bg-primary-solid text-[#FFFDF8]" : "border-border"}`}
                >
                  {on && <Check size={14} strokeWidth={3} />}
                </span>
                <Avatar name={u.name} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{u.name}</span>
                  <span className="block truncate text-xs text-ink-muted">{[u.detail, u.email].filter(Boolean).join(" · ")}</span>
                </span>
              </button>
            </li>
          );
        })}
        {loading && !results.length && (
          <li className="flex items-center justify-center gap-2 px-3 py-6 text-sm text-ink-muted">
            <Loader2 size={16} className="animate-spin" /> Buscando…
          </li>
        )}
        {!loading && results.length === 0 && (
          <li className="px-3 py-6 text-center text-sm text-ink-muted">{q ? `Ninguém encontrado com “${q}”.` : "Nenhuma outra pessoa com conta ativa."}</li>
        )}
      </ul>
      <p className="mt-2 text-xs text-ink-muted">Só aparecem pessoas com conta ativa.</p>

      {!API_ENABLED && (
        <p className="mt-4 rounded-[10px] border border-dashed border-gold bg-gold-soft px-3 py-2 text-xs text-gold-ink">
          <strong>Demonstração:</strong> por enquanto a missa fica salva só neste aparelho. Na versão com servidor, dá para mandar um link de convite e
          cada pessoa vê a missa em qualquer aparelho.
        </p>
      )}
    </Modal>
  );
}

/** Link de convite: quem abrir e entrar na conta passa a ter acesso à missa, sem precisar ser escolhido na lista. */
function InviteLink({ mass }: { mass: Mass }) {
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  // O token vem do store (o editor guarda a própria cópia da missa, que não recebe o token novo).
  const live = useMasses().find((m) => m.id === mass.id);
  const token = live ? live.shareToken : mass.shareToken;
  const url = token ? `${window.location.origin}${BASE_PATH}/convite?token=${token}` : null;
  const canShare = typeof navigator !== "undefined" && "share" in navigator;

  const run = async (task: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await task();
    } catch (err) {
      toast(err instanceof ApiError ? err.message : "Não foi possível agora. Tente de novo.");
    } finally {
      setBusy(false);
    }
  };

  const copy = async () => {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast("Não deu para copiar. Selecione o link e copie.");
    }
  };

  return (
    <section className="mt-5 rounded-[12px] border border-border bg-surface-2 p-3 sm:p-4" aria-labelledby="invite-title">
      <h3 id="invite-title" className="flex items-center gap-2 text-sm font-semibold">
        <Link2 size={16} className="text-gold-ink" /> Link de convite
      </h3>
      <p className="mt-1 text-sm text-ink-muted">Quem abrir o link e entrar na conta já passa a ter acesso a esta missa.</p>
      {url ? (
        <>
          <input
            readOnly
            value={url}
            aria-label="Link de convite"
            onFocus={(e) => e.currentTarget.select()}
            className="mt-3 h-11 w-full rounded-[8px] border border-border bg-surface px-3 font-mono text-xs text-ink"
          />
          <div className="mt-2 flex flex-wrap gap-2">
            <Button variant="secondary" onClick={copy} className="min-h-11 flex-1 sm:flex-none">
              {copied ? <Check size={16} /> : <Copy size={16} />} {copied ? "Copiado" : "Copiar link"}
            </Button>
            {canShare && (
              <Button
                variant="secondary"
                className="min-h-11 flex-1 sm:flex-none"
                onClick={() => navigator.share({ title: mass.name || "Missa", text: `Participe da missa “${mass.name || "Missa"}” no Cantos PSJB:`, url }).catch(() => undefined)}
              >
                <Share2 size={16} /> Enviar
              </Button>
            )}
            <Button
              variant="ghost"
              disabled={busy}
              className="min-h-11 w-full text-danger sm:w-auto"
              onClick={() =>
                run(async () => {
                  await revokeShareLink(mass.id);
                  toast("Link desativado. Quem já entrou continua com acesso.");
                })
              }
            >
              <Link2Off size={16} /> Desativar link
            </Button>
          </div>
        </>
      ) : (
        <Button variant="secondary" disabled={busy} className="mt-3 min-h-11 w-full sm:w-auto" onClick={() => run(() => createShareLink(mass.id))}>
          {busy ? <Loader2 size={16} className="animate-spin" /> : <Link2 size={16} />} Gerar link de convite
        </Button>
      )}
    </section>
  );
}
