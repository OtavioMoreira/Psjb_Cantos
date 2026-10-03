"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Check, ExternalLink, Eye, FileMusic, Guitar, Headphones, Loader2, Pencil, Trash2, Upload, X } from "lucide-react";
import { api, ApiError, type SongFileKind, type SongInput } from "@/lib/api";
import type { ApiFlag, ApiSong, FlagGroup } from "@/lib/apiSongs";
import { parseSheet } from "@/lib/chords";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { toast } from "@/components/ui/Toast";
import { AdminTitle } from "./AdminShell";
import { songEditUrl } from "./SongsAdmin";

export const GROUP_LABEL: Record<FlagGroup, string> = { momento: "Momento da missa", tempo: "Tempo litúrgico", ano: "Ano litúrgico", tema: "Tema", outro: "Outras" };
const GROUPS = Object.keys(GROUP_LABEL) as FlagGroup[];

const FILES: { kind: SongFileKind; field: keyof ApiSong["media"]; label: string; accept: string; Icon: typeof Guitar; max: string }[] = [
  { kind: "cifra-pdf", field: "cifraPdf", label: "Cifra (PDF)", accept: "application/pdf", Icon: Guitar, max: "PDF" },
  { kind: "partitura-pdf", field: "partituraPdf", label: "Partitura (PDF)", accept: "application/pdf", Icon: FileMusic, max: "PDF" },
  { kind: "audio", field: "audio", label: "Áudio", accept: "audio/mpeg,audio/mp4,audio/ogg,.mp3,.m4a,.ogg", Icon: Headphones, max: "MP3, M4A ou OGG" },
];
const MAX_FILE = 4 * 1024 * 1024; // limite das Functions da Vercel (ver API)

type Form = { number: string; title: string; composer: string; key: string; lyrics: string; audiomack: string; flagIds: number[]; active: boolean };

const toForm = (s?: ApiSong): Form => ({
  number: s?.number ? String(s.number) : "",
  title: s?.title ?? "",
  composer: s?.composer ?? "",
  key: s?.key ?? "",
  lyrics: s?.lyrics ?? "",
  audiomack: s?.media.audiomack ?? "",
  flagIds: s?.flags.map((f) => f.id) ?? [],
  active: s?.active ?? true,
});

/** Criar (sem id) ou editar (com id) um canto. */
export function SongEditor({ id }: { id: number | null }) {
  const router = useRouter();
  const [song, setSong] = useState<ApiSong | null>(null);
  const [form, setForm] = useState<Form>(toForm());
  const [flags, setFlags] = useState<ApiFlag[]>([]);
  const [loading, setLoading] = useState(Boolean(id));
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [preview, setPreview] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    let alive = true;
    api.admin.flags().then((f) => alive && setFlags(f)).catch(() => undefined);
    if (id)
      api.admin
        .song(id)
        .then((s) => alive && (setSong(s), setForm(toForm(s))))
        .catch((e) => alive && toast(e instanceof ApiError ? e.message : "Não foi possível abrir o canto."))
        .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [id]);

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => ({ ...f, [k]: v }));
  const toggleFlag = (fid: number) => set("flagIds", form.flagIds.includes(fid) ? form.flagIds.filter((x) => x !== fid) : [...form.flagIds, fid]);

  const save = async () => {
    setErrors({});
    if (!form.title.trim()) return setErrors({ title: "Informe o título." });
    const body: SongInput = {
      number: form.number ? Number(form.number) : null,
      title: form.title.trim(),
      composer: form.composer.trim() || null,
      key: form.key.trim() || null,
      lyrics: form.lyrics,
      media: { ...(song?.media ?? { audio: null, cifraPdf: null, partituraPdf: null }), audiomack: form.audiomack.trim() || null },
      flagIds: form.flagIds,
      active: form.active,
    };
    setSaving(true);
    try {
      if (song) {
        const s = await api.admin.updateSong(song.id, body);
        setSong(s);
        toast("Canto salvo. Publique no site para a mudança aparecer nas páginas.");
      } else {
        const s = await api.admin.createSong(body);
        toast("Canto criado. Agora você pode enviar os arquivos.");
        router.replace(songEditUrl(s.id));
      }
    } catch (e) {
      if (e instanceof ApiError && e.details?.fields) setErrors(e.details.fields);
      toast(e instanceof ApiError ? e.message : "Não foi possível salvar.");
    } finally {
      setSaving(false);
    }
  };

  if (loading)
    return (
      <div aria-busy="true">
        <div className="h-10 w-64 animate-pulse rounded bg-surface-2" />
        <div className="mt-6 h-96 animate-pulse rounded-[16px] bg-surface-2" />
      </div>
    );

  return (
    <div className="pb-24 md:pb-0">
      <Link href="/painel/admin/cantos" className="mb-3 inline-flex min-h-11 items-center gap-2 text-sm font-medium text-primary hover:underline">
        <ArrowLeft size={16} /> Todos os cantos
      </Link>
      <AdminTitle title={song ? song.title : "Novo canto"} description={song ? `Endereço: /cantos/${song.slug}` : "O endereço é criado a partir do número e do título."} />

      <div className="mt-6 grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-5">
          <section className="rounded-[16px] border border-border bg-surface p-5 shadow-card">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-[120px_1fr]">
              <Field label="Número" name="number" inputMode="numeric" value={form.number} onChange={(e) => set("number", e.target.value.replace(/\D/g, ""))} error={errors.number} hint="Opcional" />
              <Field label="Título" name="title" value={form.title} onChange={(e) => set("title", e.target.value)} error={errors.title} />
            </div>
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-[1fr_160px]">
              <Field label="Autor" name="composer" value={form.composer} onChange={(e) => set("composer", e.target.value)} error={errors.composer} />
              <Field label="Tom original" name="key" placeholder="D, Em, F#m" value={form.key} onChange={(e) => set("key", e.target.value)} error={errors.key} />
            </div>
          </section>

          <section className="rounded-[16px] border border-border bg-surface p-5 shadow-card">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-serif text-2xl font-semibold">Letra e cifra</h2>
              <div role="tablist" className="inline-flex rounded-[10px] bg-surface-2 p-1 text-sm">
                <button role="tab" aria-selected={!preview} onClick={() => setPreview(false)} className="flex min-h-9 items-center gap-1.5 rounded-md px-3 aria-selected:bg-surface aria-selected:font-semibold aria-selected:text-primary">
                  <Pencil size={14} /> Editar
                </button>
                <button role="tab" aria-selected={preview} onClick={() => setPreview(true)} className="flex min-h-9 items-center gap-1.5 rounded-md px-3 aria-selected:bg-surface aria-selected:font-semibold aria-selected:text-primary">
                  <Eye size={14} /> Ver
                </button>
              </div>
            </div>
            <p className="mt-1 text-sm text-ink-muted">
              Acordes na linha de cima da letra. O refrão vai entre <code className="font-mono">**…**</code> e aparece em negrito.
            </p>
            {preview ? (
              <SheetPreview lyrics={form.lyrics} />
            ) : (
              <textarea
                aria-label="Letra e cifra"
                value={form.lyrics}
                onChange={(e) => set("lyrics", e.target.value)}
                rows={18}
                spellCheck={false}
                className="mt-3 w-full rounded-[8px] border border-border bg-surface p-3 font-mono text-sm leading-6 outline-none focus:border-primary focus:ring-2 focus:ring-gold/40"
              />
            )}
            {errors.lyrics && <p className="mt-1 text-sm text-danger">{errors.lyrics}</p>}
          </section>
        </div>

        <div className="space-y-5">
          <section className="rounded-[16px] border border-border bg-surface p-5 shadow-card">
            <h2 className="font-serif text-2xl font-semibold">Flags</h2>
            <p className="mt-1 text-sm text-ink-muted">Marque quantas quiser, inclusive várias do mesmo grupo.</p>
            {GROUPS.map((g) => {
              const list = flags.filter((f) => f.group === g);
              if (!list.length) return null;
              return (
                <fieldset key={g} className="mt-4">
                  <legend className="mb-2 text-xs font-semibold uppercase tracking-[0.08em] text-ink-muted">{GROUP_LABEL[g]}</legend>
                  <div className="flex flex-wrap gap-2">
                    {list.map((f) => {
                      const on = form.flagIds.includes(f.id);
                      return (
                        <button
                          key={f.id}
                          type="button"
                          aria-pressed={on}
                          onClick={() => toggleFlag(f.id)}
                          className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-border px-3 text-sm text-ink-muted aria-pressed:border-primary aria-pressed:bg-primary-soft aria-pressed:font-semibold aria-pressed:text-primary"
                        >
                          {f.color && <span aria-hidden className="h-2.5 w-2.5 rounded-full" style={{ background: f.color }} />}
                          {on && <Check size={14} />} {f.name}
                        </button>
                      );
                    })}
                  </div>
                </fieldset>
              );
            })}
            {errors.flagIds && <p className="mt-2 text-sm text-danger">{errors.flagIds}</p>}
          </section>

          <section className="rounded-[16px] border border-border bg-surface p-5 shadow-card">
            <h2 className="font-serif text-2xl font-semibold">Arquivos</h2>
            {song ? (
              <ul className="mt-3 space-y-3">
                {FILES.map((f) => (
                  <FileRow key={f.kind} song={song} file={f} onChange={setSong} />
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-ink-muted">Salve o canto para enviar PDF e áudio.</p>
            )}
            <Field
              className="mt-4"
              label="Audiomack (link de incorporação)"
              name="audiomack"
              type="url"
              placeholder="https://audiomack.com/embed/song/…"
              value={form.audiomack}
              onChange={(e) => set("audiomack", e.target.value)}
              error={errors["media.audiomack"]}
            />
          </section>

          <section className="rounded-[16px] border border-border bg-surface p-5 shadow-card">
            <label className="flex min-h-11 cursor-pointer items-start gap-3">
              <input type="checkbox" checked={form.active} onChange={(e) => set("active", e.target.checked)} className="mt-1 h-5 w-5 accent-[var(--primary-solid)]" />
              <span>
                <span className="font-semibold">Visível no repertório</span>
                <span className="block text-sm text-ink-muted">Desmarque para ocultar sem excluir (as missas que usam o canto continuam funcionando).</span>
              </span>
            </label>
          </section>
        </div>
      </div>

      {/* Barra de ações: fixa no celular (acima da navegação do painel), normal no desktop. */}
      <div className="fixed inset-x-0 bottom-16 z-20 border-t border-border bg-surface/95 px-4 py-3 backdrop-blur md:static md:mt-6 md:border-0 md:bg-transparent md:p-0">
        <div className="flex items-center justify-between gap-3">
          {song ? (
            <Button variant="ghost" className="text-danger" onClick={() => setConfirmDelete(true)}>
              <Trash2 size={18} /> <span className="sr-only sm:not-sr-only">Excluir</span>
            </Button>
          ) : (
            <span />
          )}
          <Button onClick={save} disabled={saving} className="min-w-[160px]">
            {saving ? <Loader2 size={18} className="animate-spin" /> : <Check size={18} />} {song ? "Salvar canto" : "Criar canto"}
          </Button>
        </div>
      </div>

      {confirmDelete && song && <DeleteSong song={song} onClose={() => setConfirmDelete(false)} onDeleted={() => router.replace("/painel/admin/cantos")} />}
    </div>
  );
}

/** Pré-visualização simples: acordes em cor, refrão em negrito (a mesma leitura do site). */
function SheetPreview({ lyrics }: { lyrics: string }) {
  if (!lyrics.trim()) return <p className="mt-3 rounded-[8px] bg-surface-2 p-6 text-center text-sm text-ink-muted">Nada para mostrar ainda.</p>;
  return (
    <div className="mt-3 overflow-x-auto rounded-[8px] bg-surface-2 p-4 font-mono text-sm leading-6">
      {parseSheet(lyrics).map((l, i) =>
        l.type === "blank" ? (
          <div key={i} className="h-4" />
        ) : l.type === "chords" ? (
          <div key={i} className="whitespace-pre font-semibold text-primary">
            {l.text}
          </div>
        ) : (
          <div key={i} className={`whitespace-pre ${l.chorus ? "font-bold" : ""}`}>
            {l.text}
          </div>
        ),
      )}
    </div>
  );
}

function FileRow({ song, file, onChange }: { song: ApiSong; file: (typeof FILES)[number]; onChange: (s: ApiSong) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const url = song.media[file.field];

  const run = async (task: () => Promise<ApiSong>, done: string) => {
    setBusy(true);
    try {
      onChange(await task());
      toast(done);
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Não foi possível agora.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <li className="rounded-[10px] border border-border p-3">
      <div className="flex items-center gap-2">
        <file.Icon size={18} className="shrink-0 text-gold-ink" />
        <span className="flex-1 text-sm font-semibold">{file.label}</span>
        {url && (
          <a href={url} target="_blank" rel="noreferrer" className="inline-flex min-h-9 items-center gap-1 text-sm text-primary hover:underline">
            Abrir <ExternalLink size={14} />
          </a>
        )}
      </div>
      <p className="mt-1 truncate text-xs text-ink-muted">{url ? url.split("/").pop() : `Nenhum arquivo · ${file.max}, até 4 MB`}</p>
      <input
        ref={input}
        type="file"
        accept={file.accept}
        className="sr-only"
        aria-label={`Escolher ${file.label}`}
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (!f) return;
          if (f.size > MAX_FILE) return toast("O arquivo pode ter no máximo 4 MB.");
          void run(() => api.admin.uploadSongFile(song.id, file.kind, f), `${file.label} enviado.`);
        }}
      />
      <div className="mt-2 flex gap-2">
        <Button variant="secondary" disabled={busy} className="min-h-10 flex-1" onClick={() => input.current?.click()}>
          {busy ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />} {url ? "Trocar" : "Enviar"}
        </Button>
        {url && (
          <Button variant="ghost" disabled={busy} className="min-h-10 text-danger" onClick={() => run(() => api.admin.removeSongFile(song.id, file.kind), `${file.label} removido.`)}>
            <X size={16} /> Remover
          </Button>
        )}
      </div>
    </li>
  );
}

function DeleteSong({ song, onClose, onDeleted }: { song: ApiSong; onClose: () => void; onDeleted: () => void }) {
  const [busy, setBusy] = useState(false);
  const [blocked, setBlocked] = useState<string | null>(null);
  return (
    <Modal
      title="Excluir canto"
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          {!blocked && (
            <Button
              className="bg-danger hover:bg-danger/90"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await api.admin.deleteSong(song.id);
                  toast(`“${song.title}” excluído.`);
                  onDeleted();
                } catch (e) {
                  // Canto em alguma missa: a API recusa e sugere ocultar.
                  if (e instanceof ApiError && e.code === "SONG_IN_USE") setBlocked(e.message);
                  else toast(e instanceof ApiError ? e.message : "Não foi possível excluir.");
                } finally {
                  setBusy(false);
                }
              }}
            >
              <Trash2 size={18} /> Excluir
            </Button>
          )}
        </>
      }
    >
      {blocked ? (
        <p role="alert" className="rounded-md bg-gold-soft px-3 py-2 text-sm text-gold-ink">
          {blocked}
        </p>
      ) : (
        <p className="text-ink-muted">
          Excluir <strong className="text-ink">“{song.title}”</strong> apaga também os arquivos enviados. Isso não pode ser desfeito. Se quiser só tirar do
          repertório, desmarque “Visível no repertório”.
        </p>
      )}
    </Modal>
  );
}
