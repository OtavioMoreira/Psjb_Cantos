"use client";

import { useMemo, useState } from "react";
import { Check, Search, Users, X } from "lucide-react";
import type { Mass, User } from "@/lib/types";
import { initials, useUsers } from "@/lib/store";
import { normalize } from "@/lib/search";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { toast } from "@/components/ui/Toast";
import { ROLE_LABEL } from "@/components/admin/UsersAdmin";

const pessoas = (n: number) => `${n} ${n === 1 ? "pessoa" : "pessoas"}`;

function Avatar({ user, size = 36 }: { user: Pick<User, "name">; size?: number }) {
  return (
    <span
      aria-hidden
      className="grid shrink-0 place-items-center rounded-full border-2 border-surface bg-primary-soft font-semibold text-primary"
      style={{ width: size, height: size, fontSize: Math.max(10, size * 0.34), letterSpacing: "-0.02em" }}
    >
      {initials(user.name) || "?"}
    </span>
  );
}

/** Pilha de iniciais de quem tem acesso à missa ("+2" quando passa de 3). */
export function SharedAvatars({ ids, size = 28 }: { ids: string[]; size?: number }) {
  const users = useUsers();
  const list = ids.map((id) => users.find((u) => u.id === id)).filter((u): u is User => Boolean(u));
  if (!list.length) return null;
  return (
    <span className="flex shrink-0 -space-x-1" title={list.map((u) => u.name).join(", ")}>
      {list.slice(0, 3).map((u) => (
        <Avatar key={u.id} user={u} size={size} />
      ))}
      {list.length > 3 && (
        <span aria-hidden className="grid shrink-0 place-items-center rounded-full border-2 border-surface bg-surface-2 text-xs font-semibold text-ink-muted" style={{ width: size, height: size }}>
          +{list.length - 3}
        </span>
      )}
    </span>
  );
}

/** Botão "Compartilhar": escolhe, com busca, as pessoas que também podem usar a missa. */
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

function ShareModal({ mass, onClose, onSave }: { mass: Mass; onClose: () => void; onSave: (ids: string[]) => void }) {
  const users = useUsers();
  const [selected, setSelected] = useState<string[]>(mass.sharedWith ?? []);
  const [q, setQ] = useState("");

  // Só contas ativas podem receber; o dono não aparece na lista.
  const candidates = useMemo(
    () => users.filter((u) => u.status === "ativo" && u.id !== mass.ownerId).sort((a, b) => a.name.localeCompare(b.name, "pt-BR")),
    [users, mass.ownerId],
  );
  const terms = normalize(q.trim()).split(/\s+/).filter(Boolean);
  const results = candidates.filter((u) => {
    const hay = normalize(`${u.name} ${u.email} ${u.ministry} ${ROLE_LABEL[u.role]}`);
    return terms.every((t) => hay.includes(t));
  });
  const chosen = selected.map((id) => users.find((u) => u.id === id)).filter((u): u is User => Boolean(u));
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
        Quem você escolher vê <strong className="text-ink">{mass.name || "esta missa"}</strong> em Minhas Missas, pode editar os cantos, abrir no
        Modo Missa e baixar o PDF. Só você exclui a missa ou muda o compartilhamento.
      </p>

      {/* Selecionados */}
      <div className="mt-4">
        <p className="mb-2 text-sm font-medium">
          Com acesso <span className="text-ink-muted">({selected.length})</span>
        </p>
        {chosen.length ? (
          <ul className="flex flex-wrap gap-2">
            {chosen.map((u) => (
              <li key={u.id}>
                <button
                  onClick={() => toggle(u.id)}
                  aria-label={`Remover ${u.name}`}
                  className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-primary bg-primary-soft py-1 pl-1 pr-2.5 text-sm font-medium text-primary hover:bg-primary-soft/70"
                >
                  <Avatar user={u} size={26} />
                  <span className="max-w-[160px] truncate">{u.name}</span>
                  <X size={14} />
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-ink-muted">Ninguém ainda. Busque abaixo e marque as pessoas.</p>
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
          placeholder="Buscar por nome, e-mail ou ministério"
          className="h-11 w-full rounded-[10px] border border-border bg-surface pl-10 pr-3 outline-none focus:border-primary focus:ring-2 focus:ring-gold/40"
        />
      </label>
      <ul role="listbox" aria-multiselectable="true" aria-label="Pessoas" className="mt-2 rounded-[10px] border border-border sm:max-h-72 sm:overflow-y-auto">
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
                <Avatar user={u} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{u.name}</span>
                  <span className="block truncate text-xs text-ink-muted">
                    {ROLE_LABEL[u.role]}
                    {u.ministry && ` · ${u.ministry}`} · {u.email}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
        {results.length === 0 && <li className="px-3 py-6 text-center text-sm text-ink-muted">Ninguém encontrado com “{q}”.</li>}
      </ul>
      <p className="mt-2 text-xs text-ink-muted">Só aparecem pessoas com conta ativa.</p>

      <p className="mt-4 rounded-[10px] border border-dashed border-gold bg-gold-soft px-3 py-2 text-xs text-gold-ink">
        <strong>Demonstração:</strong> por enquanto a missa fica salva só neste aparelho. Na versão com servidor, cada pessoa recebe um e-mail avisando
        e vê a missa em qualquer aparelho.
      </p>
    </Modal>
  );
}
