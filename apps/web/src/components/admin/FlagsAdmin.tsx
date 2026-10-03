"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { api, ApiError, type FlagInput } from "@/lib/api";
import type { ApiFlag, FlagGroup } from "@/lib/apiSongs";
import { slugify } from "@/lib/slug";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { toast } from "@/components/ui/Toast";
import { AdminTitle } from "./AdminShell";
import { GROUP_LABEL } from "./SongEditor";
import { PublishSiteButton } from "./SongsAdmin";

type Flag = ApiFlag & { songs: number };
const GROUPS = Object.keys(GROUP_LABEL) as FlagGroup[];

/** Flags dos cantos, agrupadas: momento, tempo, ano, tema e outras. */
export function FlagsAdmin() {
  const [flags, setFlags] = useState<Flag[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Flag | { group: FlagGroup } | null>(null);
  const [removing, setRemoving] = useState<Flag | null>(null);

  const load = useCallback(
    () =>
      api.admin
        .flags()
        .then(setFlags)
        .catch((e) => setError(e instanceof ApiError ? e.message : "Não foi possível carregar as flags.")),
    [],
  );
  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div>
      <AdminTitle
        title="Flags"
        description="Etiquetas que organizam o repertório e alimentam os filtros do site. Um canto pode ter várias, inclusive do mesmo grupo (ex.: Ano A e Ano B)."
      >
        <PublishSiteButton />
        <Button onClick={() => setEditing({ group: "tema" })}>
          <Plus size={18} /> Nova flag
        </Button>
      </AdminTitle>

      {error && (
        <p role="alert" className="mt-4 rounded-md bg-danger/10 px-3 py-2 text-sm text-danger">
          {error}
        </p>
      )}
      {!flags && !error && (
        <p className="mt-6 flex items-center gap-2 text-sm text-ink-muted">
          <Loader2 size={14} className="animate-spin" /> Carregando…
        </p>
      )}

      <div className="mt-6 grid grid-cols-1 gap-5 lg:grid-cols-2">
        {flags &&
          GROUPS.map((g) => {
            const list = flags.filter((f) => f.group === g);
            return (
              <section key={g} className="rounded-[16px] border border-border bg-surface p-5 shadow-card">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="font-serif text-2xl font-semibold">{GROUP_LABEL[g]}</h2>
                  <Button variant="ghost" className="min-h-10" onClick={() => setEditing({ group: g })} aria-label={`Nova flag em ${GROUP_LABEL[g]}`}>
                    <Plus size={16} /> Adicionar
                  </Button>
                </div>
                {list.length ? (
                  <ul className="mt-3 divide-y divide-border">
                    {list.map((f) => (
                      <li key={f.id} className="flex min-h-14 items-center gap-3 py-2">
                        <span aria-hidden className="h-3 w-3 shrink-0 rounded-full border border-border" style={{ background: f.color ?? "transparent" }} />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-medium">{f.name}</span>
                          <span className="block truncate text-xs text-ink-muted">
                            {f.slug} · {f.songs} {f.songs === 1 ? "canto" : "cantos"}
                          </span>
                        </span>
                        <button onClick={() => setEditing(f)} aria-label={`Editar ${f.name}`} className="grid h-11 w-11 place-items-center rounded-full text-ink-muted hover:bg-surface-2">
                          <Pencil size={16} />
                        </button>
                        <button onClick={() => setRemoving(f)} aria-label={`Excluir ${f.name}`} className="grid h-11 w-11 place-items-center rounded-full text-danger hover:bg-danger/10">
                          <Trash2 size={16} />
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-3 text-sm text-ink-muted">Nenhuma flag neste grupo.</p>
                )}
              </section>
            );
          })}
      </div>

      {editing && <FlagDialog flag={editing} onClose={() => setEditing(null)} onSaved={load} />}
      {removing && <DeleteFlag flag={removing} onClose={() => setRemoving(null)} onDeleted={load} />}
    </div>
  );
}

function FlagDialog({ flag, onClose, onSaved }: { flag: Flag | { group: FlagGroup }; onClose: () => void; onSaved: () => void }) {
  const existing = "id" in flag ? flag : null;
  const [form, setForm] = useState<FlagInput>({
    group: flag.group,
    name: existing?.name ?? "",
    slug: existing?.slug ?? "",
    color: existing?.color ?? null,
    position: existing?.position ?? 0,
  });
  // O identificador acompanha o nome até a pessoa editar o campo dele.
  const [slugTouched, setSlugTouched] = useState(Boolean(existing));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const setName = (name: string) => setForm((f) => ({ ...f, name, slug: slugTouched ? f.slug : slugify(name, f.group === "ano") }));

  return (
    <Modal
      title={existing ? "Editar flag" : "Nova flag"}
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            disabled={busy || !form.name.trim() || !form.slug}
            onClick={async () => {
              setBusy(true);
              setErrors({});
              try {
                const body = { ...form, name: form.name.trim() };
                if (existing) await api.admin.updateFlag(existing.id, body);
                else await api.admin.createFlag(body);
                toast(existing ? "Flag atualizada." : "Flag criada.");
                onSaved();
                onClose();
              } catch (e) {
                if (e instanceof ApiError && e.details?.fields) setErrors(e.details.fields);
                toast(e instanceof ApiError ? e.message : "Não foi possível salvar.");
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy && <Loader2 size={18} className="animate-spin" />} Salvar
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <label htmlFor="flag-group" className="mb-1.5 block text-sm font-medium">
            Grupo
          </label>
          <select
            id="flag-group"
            value={form.group}
            onChange={(e) => setForm({ ...form, group: e.target.value as FlagGroup })}
            className="h-11 w-full rounded-[6px] border border-border bg-surface px-3"
          >
            {GROUPS.map((g) => (
              <option key={g} value={g}>
                {GROUP_LABEL[g]}
              </option>
            ))}
          </select>
        </div>
        <Field label="Nome" name="flag-name" placeholder="Ex.: Ano A, Advento, Família" value={form.name} onChange={(e) => setName(e.target.value)} error={errors.name} />
        <Field
          label="Identificador"
          name="flag-slug"
          value={form.slug}
          onChange={(e) => {
            setSlugTouched(true);
            setForm({ ...form, slug: e.target.value });
          }}
          error={errors.slug}
          hint="Usado nos filtros e na URL. Letras, números e hífens."
        />
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="flag-color" className="mb-1.5 block text-sm font-medium">
              Cor (opcional)
            </label>
            <div className="flex items-center gap-2">
              <input
                id="flag-color"
                type="color"
                value={form.color ?? "#2E7D4F"}
                onChange={(e) => setForm({ ...form, color: e.target.value.toUpperCase() })}
                className="h-11 w-14 cursor-pointer rounded-[6px] border border-border bg-surface"
              />
              {form.color ? (
                <button type="button" onClick={() => setForm({ ...form, color: null })} className="min-h-11 text-sm text-primary underline">
                  Sem cor
                </button>
              ) : (
                <span className="text-sm text-ink-muted">Sem cor</span>
              )}
            </div>
          </div>
          <Field
            label="Ordem"
            name="flag-position"
            inputMode="numeric"
            value={String(form.position)}
            onChange={(e) => setForm({ ...form, position: Number(e.target.value.replace(/\D/g, "") || 0) })}
            hint="Menor aparece antes"
          />
        </div>
      </div>
    </Modal>
  );
}

function DeleteFlag({ flag, onClose, onDeleted }: { flag: Flag; onClose: () => void; onDeleted: () => void }) {
  const [busy, setBusy] = useState(false);
  return (
    <Modal
      title="Excluir flag"
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            className="bg-danger hover:bg-danger/90"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await api.admin.deleteFlag(flag.id);
                toast(`Flag “${flag.name}” excluída.`);
                onDeleted();
                onClose();
              } catch (e) {
                toast(e instanceof ApiError ? e.message : "Não foi possível excluir.");
              } finally {
                setBusy(false);
              }
            }}
          >
            <Trash2 size={18} /> Excluir
          </Button>
        </>
      }
    >
      <p className="text-ink-muted">
        Excluir <strong className="text-ink">“{flag.name}”</strong>?{" "}
        {flag.songs ? `Ela sai de ${flag.songs} ${flag.songs === 1 ? "canto" : "cantos"}; os cantos continuam.` : "Nenhum canto usa esta flag."}
      </p>
    </Modal>
  );
}
