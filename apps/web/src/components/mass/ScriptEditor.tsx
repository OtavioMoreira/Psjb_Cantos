"use client";

import { useState } from "react";
import { ArrowDown, ArrowUp, FileDown, FileText, Loader2, Music, Plus, RotateCcw, Trash2 } from "lucide-react";
import type { Mass, MassScript, ScriptItem, Song } from "@/lib/types";
import { defaultScript, songRefs } from "@/lib/massScript";
import { toast } from "@/components/ui/Toast";

const field = "w-full rounded-[6px] border border-border bg-surface px-3 outline-none focus:border-primary focus:ring-2 focus:ring-gold/40";

/**
 * Roteiro da celebração (o folheto de 1 página da equipe de liturgia). O admin monta junto da missa:
 * os itens de canto puxam os números dos momentos, os de texto levam a motivação, as preces etc.
 */
export function ScriptEditor({ mass, byId, onChange }: { mass: Mass; byId: Map<number, Song>; onChange: (script: MassScript | null) => void }) {
  const script = mass.script ?? null;
  const [busy, setBusy] = useState(false);

  if (!script)
    return (
      <section className="mt-4 rounded-[16px] border border-dashed border-border bg-surface p-4 sm:p-5">
        <h2 className="flex items-center gap-2 font-semibold">
          <FileText size={18} className="text-gold-ink" /> Roteiro da celebração (PDF de 1 página)
        </h2>
        <p className="mt-1 text-sm text-ink-muted">
          O folheto da equipe de liturgia: lembretes, motivação, preces e os números dos cantos de cada momento. Começa no modelo da paróquia, e você só ajusta os textos.
        </p>
        <button
          type="button"
          onClick={() => onChange(defaultScript(mass))}
          className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-[10px] border border-primary px-4 text-sm font-semibold text-primary hover:bg-primary-soft"
        >
          <Plus size={16} /> Criar roteiro
        </button>
      </section>
    );

  const set = (patch: Partial<MassScript>) => onChange({ ...script, ...patch });
  const setItem = (id: string, patch: Partial<ScriptItem>) => set({ items: script.items.map((i) => (i.id === id ? { ...i, ...patch } : i)) });
  const move = (from: number, to: number) => {
    if (to < 0 || to >= script.items.length) return;
    const items = [...script.items];
    const [x] = items.splice(from, 1);
    items.splice(to, 0, x);
    set({ items });
  };
  const remove = (item: ScriptItem) => {
    const before = script.items;
    set({ items: before.filter((i) => i.id !== item.id) });
    toast(`“${item.title || "Item"}” removido do roteiro.`, { label: "Desfazer", onClick: () => onChange({ ...script, items: before }) });
  };
  const add = (kind: ScriptItem["kind"]) =>
    set({ items: [...script.items, { id: `r${Date.now().toString(36)}`, title: kind === "cantos" ? "Canto" : "Novo item", kind, slotIds: [], text: "", boxed: false }] });

  const download = async () => {
    setBusy(true);
    try {
      const { downloadScriptPdf } = await import("@/lib/scriptPdf");
      const { fits, size } = await downloadScriptPdf(mass, script, byId);
      toast(fits ? (size < 8 ? "PDF gerado. O texto ficou pequeno para caber em 1 página; dá para encurtar algum item." : "PDF gerado em 1 página.") : "O roteiro passou de 1 página mesmo com a letra mínima: encurte algum texto.");
    } catch {
      toast("Não foi possível gerar o PDF agora.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <details open className="group mt-4 rounded-[16px] border border-border bg-surface shadow-card">
      <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 px-4 sm:px-5">
        <span className="flex items-center gap-2 font-semibold">
          <FileText size={18} className="text-gold-ink" /> Roteiro da celebração
          <span className="text-sm font-normal text-ink-muted">({script.items.length} itens)</span>
        </span>
        <span className="text-sm text-primary group-open:hidden">Abrir</span>
        <span className="hidden text-sm text-primary group-open:inline">Fechar</span>
      </summary>
      <div className="space-y-4 border-t border-border p-4 sm:p-5">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={download}
            disabled={busy}
            className="inline-flex min-h-11 items-center gap-2 rounded-[10px] bg-primary-solid px-4 text-sm font-semibold text-[#FFFDF8] hover:bg-primary-hover disabled:opacity-60"
          >
            {busy ? <Loader2 size={16} className="animate-spin" /> : <FileDown size={16} />} Baixar roteiro (PDF)
          </button>
          <button
            type="button"
            onClick={() => {
              const before = script;
              onChange(defaultScript(mass));
              toast("Roteiro voltou ao modelo da paróquia.", { label: "Desfazer", onClick: () => onChange(before) });
            }}
            className="inline-flex min-h-11 items-center gap-2 rounded-[10px] border border-border px-4 text-sm font-medium text-ink-muted hover:border-primary hover:text-primary"
          >
            <RotateCcw size={16} /> Voltar ao modelo
          </button>
        </div>
        <p className="rounded-md bg-surface-2 px-3 py-2 text-xs text-ink-muted">
          Formatação: <strong>**negrito**</strong> · <em className="font-semibold not-italic text-danger">*instrução em vermelho*</em> · linhas que começam com{" "}
          <span className="font-semibold text-danger">Padre:</span>, <strong>R.:</strong> e <strong>T.:</strong> ganham destaque. Os números dos cantos vêm dos momentos da missa.
        </p>

        <label className="block">
          <span className="mb-1.5 block text-sm font-medium">Título (vai em maiúsculas no topo)</span>
          <input value={script.title} maxLength={200} onChange={(e) => set({ title: e.target.value })} className={`${field} h-11 font-semibold`} />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium">Lembretes importantes</span>
          <textarea value={script.notes} maxLength={1000} rows={2} onChange={(e) => set({ notes: e.target.value })} className={`${field} py-2 text-sm`} />
        </label>

        <ol className="space-y-2">
          {script.items.map((item, i) => {
            const refs = item.kind === "cantos" ? songRefs(item, mass, byId) : "";
            return (
              <li key={item.id} className={`rounded-[10px] border p-3 ${item.boxed ? "border-gold bg-gold-soft/40" : "border-border"}`}>
                <div className="flex items-center gap-2">
                  <span className="w-7 shrink-0 text-center font-serif text-lg font-semibold text-gold-ink">{i + 1}.</span>
                  <input
                    value={item.title}
                    maxLength={120}
                    onChange={(e) => setItem(item.id, { title: e.target.value })}
                    aria-label={`Título do item ${i + 1}`}
                    className={`${field} h-10 min-w-0 flex-1 font-semibold`}
                  />
                  <div className="flex shrink-0 items-center">
                    <IconBtn label={`Subir ${item.title}`} onClick={() => move(i, i - 1)} disabled={i === 0}>
                      <ArrowUp size={16} />
                    </IconBtn>
                    <IconBtn label={`Descer ${item.title}`} onClick={() => move(i, i + 1)} disabled={i === script.items.length - 1}>
                      <ArrowDown size={16} />
                    </IconBtn>
                    <IconBtn label={`Remover ${item.title}`} onClick={() => remove(item)}>
                      <Trash2 size={16} />
                    </IconBtn>
                  </div>
                </div>
                {item.kind === "cantos" && (
                  <div className="mt-2 flex flex-wrap items-center gap-2 pl-9 text-sm">
                    <Music size={14} className="text-gold-ink" />
                    <select
                      value={item.slotIds[0] ?? ""}
                      onChange={(e) => setItem(item.id, { slotIds: e.target.value ? [e.target.value] : [] })}
                      aria-label={`Momento da missa do item ${i + 1}`}
                      className="h-9 rounded-md border border-border bg-surface px-2"
                    >
                      <option value="">Nenhum momento (escreva no texto)</option>
                      {mass.slots.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.label}
                        </option>
                      ))}
                    </select>
                    <span className="text-ink-muted">{refs ? `→ ${refs}` : item.slotIds.length ? "→ sem cantos neste momento (sai “LIVRE”)" : ""}</span>
                  </div>
                )}
                <div className="mt-2 pl-9">
                  <textarea
                    value={item.text}
                    maxLength={4000}
                    rows={Math.min(12, Math.max(item.boxed ? 4 : 2, item.text.split("\n").length + Math.floor(item.text.length / 90)))}
                    onChange={(e) => setItem(item.id, { text: e.target.value })}
                    placeholder={item.kind === "cantos" ? "Observação depois dos números (opcional)" : "Texto do item"}
                    aria-label={`Texto do item ${i + 1}`}
                    className={`${field} py-2 text-sm [field-sizing:content]`}
                  />
                  <label className="mt-1 inline-flex min-h-11 cursor-pointer items-center gap-2 text-sm text-ink-muted">
                    <input type="checkbox" checked={item.boxed} onChange={(e) => setItem(item.id, { boxed: e.target.checked })} className="h-4 w-4 accent-[var(--primary-solid)]" />
                    Com moldura (texto em destaque, título em linha própria)
                  </label>
                </div>
              </li>
            );
          })}
        </ol>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => add("texto")} className="inline-flex min-h-11 items-center gap-2 rounded-[10px] border border-dashed border-border px-4 text-sm text-ink-muted hover:border-primary hover:text-primary">
            <Plus size={16} /> Item de texto
          </button>
          <button type="button" onClick={() => add("cantos")} className="inline-flex min-h-11 items-center gap-2 rounded-[10px] border border-dashed border-border px-4 text-sm text-ink-muted hover:border-primary hover:text-primary">
            <Plus size={16} /> Item de canto
          </button>
          <button
            type="button"
            onClick={() => {
              const before = script;
              onChange(null);
              toast("Roteiro removido.", { label: "Desfazer", onClick: () => onChange(before) });
            }}
            className="ml-auto inline-flex min-h-11 items-center gap-2 rounded-[10px] px-3 text-sm text-danger hover:bg-danger/10"
          >
            <Trash2 size={16} /> Remover roteiro
          </button>
        </div>
      </div>
    </details>
  );
}

function IconBtn({ label, onClick, disabled, children }: { label: string; onClick: () => void; disabled?: boolean; children: React.ReactNode }) {
  return (
    <button type="button" aria-label={label} title={label} onClick={onClick} disabled={disabled} className="grid h-10 w-10 place-items-center rounded-full text-ink-muted hover:bg-surface-2 disabled:opacity-30">
      {children}
    </button>
  );
}
