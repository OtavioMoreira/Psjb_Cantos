"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, Check, Eye, GripVertical, Loader2, Minus, Plus, RotateCcw, Tablet, Trash2, Users, X } from "lucide-react";
import type { Mass, MassSlot, Song } from "@/lib/types";
import { canShareMasses, massAccess, saveMass, uid, usePrefs, useSession, useUser, useUsers } from "@/lib/store";
import { useSongIndex } from "@/lib/useSongIndex";
import { SEASON_STYLE, formatNumber, liturgicalSeason, liturgicalYear } from "@/lib/liturgy";
import { keyLabel, wrapSemitones } from "@/lib/chords";
import { taxonomy } from "@/lib/labels";
import { SlotPicker } from "./SlotPicker";
import { MassPdfButton } from "./MassPdfButton";
import { ShareMassButton, SharedAvatars } from "./ShareMass";
import { ChordSheet } from "@/components/song/ChordSheet";
import { toast } from "@/components/ui/Toast";
import { massEditUrl, massModeUrl } from "@/lib/routes";

type SaveState = "idle" | "saving" | "saved";

export function MassEditor({ initial, isNew = false }: { initial: Mass; isNew?: boolean }) {
  const router = useRouter();
  const [mass, setMass] = useState<Mass>(initial);
  const [activeSlot, setActiveSlot] = useState<string | null>(null);
  // slotId: pré-visualização de um canto já escolhido (mostra e ajusta o tom desta missa).
  const [preview, setPreview] = useState<{ song: Song; slotId?: string } | null>(null);
  const [save, setSave] = useState<SaveState>("idle");
  const [flash, setFlash] = useState<string | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const { songs, error } = useSongIndex();
  const byId = useMemo(() => new Map((songs ?? []).map((s) => [s.id, s])), [songs]);
  const prefs = usePrefs();
  const { userId } = useSession();
  const me = useUser();
  const users = useUsers();
  const owner = massAccess(mass, userId) === "dono";
  const shared = mass.sharedWith ?? [];
  const touched = useRef(false);
  const persisted = useRef(!isNew);

  // Autosave com debounce de 1s (só depois da primeira alteração).
  useEffect(() => {
    if (!touched.current) return;
    setSave("saving");
    const t = setTimeout(() => {
      const saved = saveMass({ ...mass, name: mass.name.trim() || defaultName(mass.date) });
      setSave("saved");
      if (!persisted.current) {
        persisted.current = true;
        router.replace(massEditUrl(saved.id), { scroll: false });
      }
    }, 1000);
    return () => clearTimeout(t);
  }, [mass, router]);

  const update = (fn: (m: Mass) => Mass) => {
    touched.current = true;
    setMass(fn);
  };
  const updateSlot = (id: string, fn: (s: MassSlot) => MassSlot) =>
    update((m) => ({ ...m, slots: m.slots.map((s) => (s.id === id ? fn(s) : s)) }));

  const moveSlot = (from: number, to: number) =>
    update((m) => {
      if (to < 0 || to >= m.slots.length) return m;
      const slots = [...m.slots];
      const [x] = slots.splice(from, 1);
      slots.splice(to, 0, x);
      return { ...m, slots };
    });

  const pick = (slot: MassSlot, song: Song) => {
    updateSlot(slot.id, (s) => ({ ...s, items: [...s.items, { songId: song.id, transpose: 0 }] }));
    setFlash(slot.id);
    setTimeout(() => setFlash(null), 600);
    // Avança para o próximo momento vazio (no desktop o seletor continua aberto).
    const idx = mass.slots.findIndex((s) => s.id === slot.id);
    const nextEmpty = mass.slots.slice(idx + 1).find((s) => s.items.length === 0 && s.moment !== "extra");
    const desktop = window.matchMedia("(min-width: 1024px)").matches;
    setActiveSlot(desktop && nextEmpty ? nextEmpty.id : null);
  };

  const setTranspose = (slotId: string, songId: number, value: number) =>
    updateSlot(slotId, (s) => ({ ...s, items: s.items.map((x) => (x.songId === songId ? { ...x, transpose: wrapSemitones(value) } : x)) }));

  const removeItem = (slot: MassSlot, songId: number) => {
    const before = slot.items;
    updateSlot(slot.id, (s) => ({ ...s, items: s.items.filter((i) => i.songId !== songId) }));
    toast("Canto removido.", { label: "Desfazer", onClick: () => updateSlot(slot.id, (s) => ({ ...s, items: before })) });
  };

  const onDate = (date: string) =>
    update((m) => {
      const d = date ? new Date(date + "T12:00:00") : null;
      return { ...m, date, season: d ? liturgicalSeason(d) : m.season, year: d ? liturgicalYear(d) : m.year };
    });

  const current = mass.slots.find((s) => s.id === activeSlot) ?? null;
  const filled = mass.slots.filter((s) => s.items.length).length;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-serif text-[32px] font-semibold text-primary sm:text-[40px]">{isNew ? "Monte sua Missa" : "Editar missa"}</h1>
        <p className="flex items-center gap-1.5 text-sm" aria-live="polite">
          {save === "saving" && (
            <span className="flex items-center gap-1.5 text-ink-muted">
              <Loader2 size={14} className="animate-spin" /> Salvando…
            </span>
          )}
          {save === "saved" && (
            <span className="flex items-center gap-1.5 text-success">
              <Check size={14} /> Salvo
            </span>
          )}
        </p>
      </div>

      {(!owner || shared.length > 0) && (
        <p className="mt-3 flex items-center gap-2 text-sm text-ink-muted">
          {owner ? (
            <>
              <SharedAvatars ids={shared} />
              <span>Compartilhada com {shared.length} {shared.length === 1 ? "pessoa" : "pessoas"}: todos podem editar.</span>
            </>
          ) : (
            <>
              <Users size={16} className="shrink-0 text-gold-ink" />
              <span>
                Compartilhada por <strong className="font-medium text-ink">{users.find((u) => u.id === mass.ownerId)?.name ?? "outra pessoa"}</strong>.
                Você pode editar os cantos.
              </span>
            </>
          )}
        </p>
      )}

      {/* Cabeçalho da missa */}
      <div className="mt-5 grid grid-cols-2 gap-4 rounded-[16px] border border-border bg-surface p-4 shadow-card sm:grid-cols-[1fr_auto_auto] sm:p-5">
        <label className="col-span-2 block sm:col-span-1">
          <span className="mb-1.5 block text-sm font-medium">Nome da missa</span>
          <input
            value={mass.name}
            onChange={(e) => update((m) => ({ ...m, name: e.target.value }))}
            placeholder={defaultName(mass.date)}
            className="h-11 w-full rounded-[6px] border border-border bg-surface px-3 font-serif text-lg font-semibold outline-none focus:border-primary focus:ring-2 focus:ring-gold/40"
          />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium">Data</span>
          <input type="date" value={mass.date} onChange={(e) => onDate(e.target.value)} className="h-11 w-full rounded-[6px] border border-border bg-surface px-3 outline-none focus:border-primary" />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium">Horário</span>
          <input type="time" value={mass.time} onChange={(e) => update((m) => ({ ...m, time: e.target.value }))} className="h-11 w-full rounded-[6px] border border-border bg-surface px-3 outline-none focus:border-primary" />
        </label>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm col-span-2 sm:col-span-3">
          <label className="flex items-center gap-2">
            <span className="text-ink-muted">Tempo:</span>
            {mass.season && <span className="h-2.5 w-2.5 rounded-full" style={{ background: SEASON_STYLE[mass.season].color }} />}
            <select
              value={mass.season ?? ""}
              onChange={(e) => update((m) => ({ ...m, season: (e.target.value || null) as Mass["season"] }))}
              className="h-9 rounded-md border border-border bg-surface px-2"
            >
              {taxonomy.seasons.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2">
            <span className="text-ink-muted">Ano:</span>
            <select value={mass.year ?? ""} onChange={(e) => update((m) => ({ ...m, year: (e.target.value || null) as Mass["year"] }))} className="h-9 rounded-md border border-border bg-surface px-2">
              {taxonomy.years.map((y) => (
                <option key={y.id} value={y.id}>
                  {y.id}
                </option>
              ))}
            </select>
          </label>
          <span className="text-ink-muted">(sugeridos pela data)</span>
          <span className="ml-auto font-medium">
            {filled} de {mass.slots.length} momentos
          </span>
        </div>
      </div>

      {error && <p className="mt-4 rounded-md bg-danger/10 px-3 py-2 text-sm text-danger">Não conseguimos carregar os cantos. Verifique sua conexão.</p>}

      <div className="mt-6 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,440px)] lg:gap-6">
        {/* Momentos */}
        <ol className="space-y-2">
          {mass.slots.map((slot, i) => (
            <li
              key={slot.id}
              draggable={dragId === slot.id}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => {
                const from = mass.slots.findIndex((s) => s.id === dragId);
                if (from >= 0) moveSlot(from, i);
                setDragId(null);
              }}
              onDragEnd={() => setDragId(null)}
              className={`rounded-[10px] border bg-surface transition ${
                activeSlot === slot.id ? "border-2 border-gold" : slot.items.length ? "border-border" : "border-dashed border-border"
              } ${flash === slot.id ? "bg-primary-soft" : ""} ${dragId === slot.id ? "opacity-60 shadow-overlay" : ""}`}
            >
              <div className="flex items-center gap-2 px-2 py-2 sm:px-3">
                <span
                  onMouseDown={() => setDragId(slot.id)}
                  onMouseUp={() => setDragId(null)}
                  className="hidden cursor-grab text-ink-muted sm:block"
                  aria-hidden
                  title="Arraste para reordenar"
                >
                  <GripVertical size={18} />
                </span>
                <span className="w-6 text-center font-serif text-lg font-semibold text-gold-ink">{i + 1}</span>
                {slot.moment === "extra" ? (
                  <input
                    value={slot.label}
                    onChange={(e) => updateSlot(slot.id, (s) => ({ ...s, label: e.target.value }))}
                    aria-label="Nome do momento extra"
                    className="min-w-0 flex-1 rounded border border-transparent bg-transparent px-1 text-xs font-semibold uppercase tracking-[0.08em] hover:border-border focus:border-primary focus:outline-none"
                  />
                ) : (
                  <span className="flex-1 text-xs font-semibold uppercase tracking-[0.08em]">{slot.label}</span>
                )}
                <div className="flex items-center">
                  <IconBtn label={`Mover ${slot.label} para cima`} onClick={() => moveSlot(i, i - 1)} disabled={i === 0}>
                    <ArrowUp size={16} />
                  </IconBtn>
                  <IconBtn label={`Mover ${slot.label} para baixo`} onClick={() => moveSlot(i, i + 1)} disabled={i === mass.slots.length - 1}>
                    <ArrowDown size={16} />
                  </IconBtn>
                  {slot.moment === "extra" && (
                    <IconBtn label={`Remover momento ${slot.label}`} onClick={() => update((m) => ({ ...m, slots: m.slots.filter((s) => s.id !== slot.id) }))}>
                      <Trash2 size={16} />
                    </IconBtn>
                  )}
                </div>
              </div>

              <div className="space-y-2 px-3 pb-3 sm:pl-12">
                {slot.items.map((item) => {
                  const song = byId.get(item.songId);
                  return (
                    <div key={item.songId} className="rounded-[10px] border border-border bg-surface-2 p-3">
                      <div className="flex items-start gap-2">
                        <div className="min-w-0 flex-1">
                          {song ? (
                            <>
                              <p className="text-sm font-bold text-gold-ink [font-variant-numeric:lining-nums]">
                                {formatNumber(song.number)}
                                {song.composer && <span className="ml-2 font-normal text-ink-muted">{song.composer}</span>}
                              </p>
                              <p className="font-serif text-xl font-semibold leading-snug text-ink">{song.title}</p>
                            </>
                          ) : (
                            <span className="inline-block h-5 w-48 animate-pulse rounded bg-border" />
                          )}
                        </div>
                        <div className="-mr-1 flex shrink-0 items-center">
                          {song && (
                            <IconBtn label={`Ver cifra de ${song.title} no tom desta missa`} onClick={() => setPreview({ song, slotId: slot.id })}>
                              <Eye size={18} />
                            </IconBtn>
                          )}
                          <IconBtn label="Remover canto" onClick={() => removeItem(slot, item.songId)}>
                            <X size={18} />
                          </IconBtn>
                        </div>
                      </div>
                      {song?.key && (
                        <div className="mt-2 border-t border-border pt-2">
                          <ToneControl
                            songKey={song.key}
                            transpose={item.transpose}
                            preferFlats={prefs.preferFlats}
                            onChange={(v) => setTranspose(slot.id, item.songId, v)}
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
                <button
                  onClick={() => setActiveSlot(slot.id)}
                  className="flex min-h-11 w-full items-center gap-2 rounded-md px-3 text-sm font-semibold text-primary hover:bg-primary-soft"
                >
                  <Plus size={16} /> {slot.items.length ? "Adicionar outro canto" : "Escolher canto"}
                </button>
              </div>
            </li>
          ))}
          <li>
            <button
              onClick={() => {
                const slot: MassSlot = { id: uid(), moment: "extra", label: "Canto adicional", items: [] };
                update((m) => ({ ...m, slots: [...m.slots, slot] }));
                setActiveSlot(slot.id);
              }}
              className="flex min-h-12 w-full items-center justify-center gap-2 rounded-[10px] border border-dashed border-gold px-4 text-sm font-semibold text-gold-ink hover:bg-gold-soft"
            >
              <Plus size={16} /> Adicionar canto adicional (ex.: Ação de graças, Coroação de Nossa Senhora)
            </button>
          </li>
        </ol>

        {/* Seletor: painel fixo no desktop, bottom sheet no mobile */}
        <div className="hidden lg:block">
          <div className="sticky top-[96px] h-[calc(100vh-120px)] overflow-hidden rounded-[16px] border border-border bg-surface shadow-card">
            {current && songs ? (
              <SlotPicker key={current.id} slot={current} mass={mass} songs={songs} onPick={(s) => pick(current, s)} onPreview={(song) => setPreview({ song })} onClose={() => setActiveSlot(null)} />
            ) : (
              <div className="flex h-full flex-col items-center justify-center p-8 text-center text-ink-muted">
                <p className="font-serif text-2xl font-semibold text-ink">Escolha um momento</p>
                <p className="mt-2">Toque em “Escolher canto” em qualquer momento para ver as sugestões filtradas pelo tempo litúrgico.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {current && songs && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label={`Escolher canto para ${current.label}`}>
          <div className="absolute inset-0 bg-black/40" onClick={() => setActiveSlot(null)} />
          <div className="animate-fade-in absolute inset-x-0 bottom-0 h-[90vh] overflow-hidden rounded-t-[16px] bg-bg shadow-overlay">
            <SlotPicker key={current.id} slot={current} mass={mass} songs={songs} onPick={(s) => pick(current, s)} onPreview={(song) => setPreview({ song })} onClose={() => setActiveSlot(null)} />
          </div>
        </div>
      )}

      {preview && (
        <SongPreview
          song={preview.song}
          item={mass.slots.find((sl) => sl.id === preview.slotId)?.items.find((x) => x.songId === preview.song.id)}
          preferFlats={prefs.preferFlats}
          onTranspose={(v) => preview.slotId && setTranspose(preview.slotId, preview.song.id, v)}
          onClose={() => setPreview(null)}
        />
      )}

      <div className="sticky bottom-[72px] z-20 mt-8 flex items-center gap-2 rounded-[16px] border border-border bg-surface/95 p-3 shadow-raised backdrop-blur md:bottom-4">
        <Link href="/painel/missas" className="hidden min-h-11 items-center rounded-[10px] px-4 text-sm font-semibold text-primary hover:bg-primary-soft sm:inline-flex">
          Voltar às missas
        </Link>
        <MassPdfButton mass={{ ...mass, name: mass.name.trim() || defaultName(mass.date) }} className="shrink-0 sm:ml-auto" />
        {owner && canShareMasses(me.role) && (
          <ShareMassButton mass={mass} className="shrink-0" onChange={(sharedWith) => update((m) => ({ ...m, sharedWith }))} />
        )}
        <button
          onClick={() => {
            const saved = saveMass({ ...mass, name: mass.name.trim() || defaultName(mass.date) });
            router.push(massModeUrl(saved.id));
          }}
          disabled={filled === 0}
          className="flex-1 justify-center whitespace-nowrap sm:flex-none inline-flex min-h-11 items-center gap-2 rounded-[10px] bg-primary-solid px-5 text-sm font-semibold text-[#FFFDF8] hover:bg-primary-hover disabled:opacity-50"
        >
          <Tablet size={18} /> <span className="hidden sm:inline">Abrir no</span> Modo Missa
        </button>
      </div>
    </div>
  );
}

function defaultName(date: string) {
  if (!date) return "Nova missa";
  const [, m, d] = date.split("-");
  return `Missa de ${d}/${m}`;
}

function IconBtn({ label, children, ...props }: { label: string } & React.ComponentProps<"button">) {
  return (
    <button aria-label={label} title={label} className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-ink-muted hover:bg-surface hover:text-primary disabled:opacity-30" {...props}>
      {children}
    </button>
  );
}

/** Tom do canto nesta missa: −/+ meio tom (de −6 a +5, dando a volta) e ↺ para o original. */
function ToneControl({
  songKey,
  transpose,
  preferFlats,
  onChange,
}: {
  songKey: string;
  transpose: number;
  preferFlats: boolean;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1 text-sm" role="group" aria-label="Tom nesta missa">
      <span className="mr-1 text-xs font-semibold uppercase tracking-[0.08em] text-ink-muted">Tom</span>
      <IconBtn label="Descer meio tom" onClick={() => onChange(transpose - 1)}>
        <Minus size={16} />
      </IconBtn>
      <span aria-live="polite" className="min-w-[6.5rem] text-center font-semibold">
        {keyLabel(songKey, transpose, preferFlats)}
        {transpose !== 0 && (
          <span className="ml-1 text-xs font-normal text-ink-muted [font-variant-numeric:lining-nums]">
            ({transpose > 0 ? "+" : ""}
            {transpose})
          </span>
        )}
      </span>
      <IconBtn label="Subir meio tom" onClick={() => onChange(transpose + 1)}>
        <Plus size={16} />
      </IconBtn>
      {transpose !== 0 && (
        <button onClick={() => onChange(0)} title={`Voltar ao tom original (${songKey})`} className="ml-1 inline-flex min-h-9 items-center gap-1 rounded-full px-2 text-xs font-medium text-ink-muted hover:bg-surface hover:text-primary">
          <RotateCcw size={14} /> Original ({songKey})
        </button>
      )}
    </div>
  );
}

/** Pré-visualização da cifra. Para um canto já na missa, mostra e ajusta o tom desta missa. */
function SongPreview({
  song,
  item,
  preferFlats,
  onTranspose,
  onClose,
}: {
  song: Song;
  item?: { transpose: number };
  preferFlats: boolean;
  onTranspose: (v: number) => void;
  onClose: () => void;
}) {
  const transpose = item?.transpose ?? 0;
  return (
    <div className="fixed inset-0 z-[55] flex items-end justify-center sm:items-center" role="dialog" aria-modal="true" aria-label={song.title}>
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="animate-fade-in relative flex max-h-[90vh] w-full max-w-2xl flex-col rounded-t-[16px] bg-surface shadow-overlay sm:rounded-[16px]">
        <div className="border-b border-border p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-gold-ink [font-variant-numeric:lining-nums]">{formatNumber(song.number)}</p>
              <h2 className="font-serif text-2xl font-semibold">{song.title}</h2>
            </div>
            <button aria-label="Fechar" onClick={onClose} className="grid h-10 w-10 shrink-0 place-items-center rounded-full hover:bg-surface-2">
              <X size={22} />
            </button>
          </div>
          {song.key && (
            <div className="mt-3 rounded-[10px] bg-surface-2 px-2 py-1">
              {item ? (
                <ToneControl songKey={song.key} transpose={transpose} preferFlats={preferFlats} onChange={onTranspose} />
              ) : (
                <p className="px-1 py-1.5 text-sm">
                  <span className="mr-2 text-xs font-semibold uppercase tracking-[0.08em] text-ink-muted">Tom original</span>
                  <span className="font-semibold">{keyLabel(song.key, 0, preferFlats)}</span>
                </p>
              )}
            </div>
          )}
        </div>
        <div className="overflow-y-auto p-5">
          <ChordSheet lyrics={song.lyrics} fontSize={15} transpose={transpose} preferFlats={preferFlats} />
        </div>
      </div>
    </div>
  );
}
