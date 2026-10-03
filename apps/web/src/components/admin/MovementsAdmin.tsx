"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, Loader2, Pencil, Plus, Trash2, X } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { toast } from "@/components/ui/Toast";
import { AdminTitle } from "./AdminShell";

type Movement = { id: number; name: string; members: number };

const input =
  "h-11 w-full min-w-0 rounded-[10px] border border-border bg-surface px-3 outline-none focus:border-primary focus:ring-2 focus:ring-gold/40";

/** Movimentos e pastorais que aparecem no cadastro e no perfil. */
export function MovementsAdmin() {
  const [list, setList] = useState<Movement[] | null>(null);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<{ id: number; name: string } | null>(null);

  const load = useCallback(() => api.admin.movements().then(setList).catch(() => setList([])), []);
  useEffect(() => {
    void load();
  }, [load]);

  const attempt = async (task: () => Promise<unknown>, done: string) => {
    setBusy(true);
    try {
      await task();
      toast(done);
      await load();
      return true;
    } catch (e) {
      // Ex.: nome repetido (MOVEMENT_TAKEN) ou movimento com pessoas (MOVEMENT_IN_USE).
      toast(e instanceof ApiError ? e.message : "Não foi possível agora.");
      return false;
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-[720px]">
      <AdminTitle title="Movimentos" description="Cada pessoa escolhe um no cadastro ou no perfil. Um movimento com pessoas não pode ser excluído." />

      <form
        className="mt-6 flex gap-2"
        onSubmit={async (e) => {
          e.preventDefault();
          if (name.trim().length < 2) return;
          if (await attempt(() => api.admin.createMovement(name.trim()), `“${name.trim()}” adicionado.`)) setName("");
        }}
      >
        <label className="sr-only" htmlFor="new-movement">
          Novo movimento
        </label>
        <input id="new-movement" value={name} onChange={(e) => setName(e.target.value)} placeholder="Novo movimento ou pastoral" className={input} />
        <Button type="submit" disabled={busy || name.trim().length < 2} className="shrink-0">
          <Plus size={18} /> <span className="sr-only sm:not-sr-only">Adicionar</span>
        </Button>
      </form>

      {!list ? (
        <p className="mt-6 flex items-center gap-2 text-sm text-ink-muted">
          <Loader2 size={14} className="animate-spin" /> Carregando…
        </p>
      ) : (
        <ul className="mt-4 divide-y divide-border rounded-[16px] border border-border bg-surface shadow-card">
          {list.map((m) =>
            editing?.id === m.id ? (
              <li key={m.id} className="flex items-center gap-2 p-3">
                <input
                  aria-label={`Novo nome para ${m.name}`}
                  autoFocus
                  value={editing.name}
                  onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                  className={input}
                />
                <button
                  aria-label="Salvar"
                  disabled={busy || editing.name.trim().length < 2}
                  onClick={async () => (await attempt(() => api.admin.renameMovement(m.id, editing.name.trim()), "Movimento renomeado.")) && setEditing(null)}
                  className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-success hover:bg-success/10 disabled:opacity-40"
                >
                  <Check size={18} />
                </button>
                <button aria-label="Cancelar" onClick={() => setEditing(null)} className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-ink-muted hover:bg-surface-2">
                  <X size={18} />
                </button>
              </li>
            ) : (
              <li key={m.id} className="flex min-h-16 items-center gap-2 px-4 py-2">
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{m.name}</span>
                  <span className="text-xs text-ink-muted [font-variant-numeric:lining-nums]">
                    {m.members} {m.members === 1 ? "pessoa" : "pessoas"}
                  </span>
                </span>
                <button onClick={() => setEditing({ id: m.id, name: m.name })} aria-label={`Renomear ${m.name}`} className="grid h-11 w-11 place-items-center rounded-full text-ink-muted hover:bg-surface-2">
                  <Pencil size={16} />
                </button>
                <button
                  onClick={() => attempt(() => api.admin.deleteMovement(m.id), `“${m.name}” excluído.`)}
                  disabled={busy || m.members > 0}
                  title={m.members > 0 ? "Há pessoas neste movimento" : undefined}
                  aria-label={`Excluir ${m.name}`}
                  className="grid h-11 w-11 place-items-center rounded-full text-danger hover:bg-danger/10 disabled:opacity-30"
                >
                  <Trash2 size={16} />
                </button>
              </li>
            ),
          )}
          {list.length === 0 && <li className="p-6 text-center text-sm text-ink-muted">Nenhum movimento ainda.</li>}
        </ul>
      )}
    </div>
  );
}
