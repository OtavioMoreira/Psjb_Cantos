"use client";

import { Check } from "lucide-react";
import { useMovements, type Movement } from "@/lib/movements";

/** Campo "Movimentos" (cadastro, perfil e admin): a pessoa pode participar de vários. */
export function MovementPicker({
  value,
  onChange,
  label = "Movimentos (opcional)",
  hint = "Marque todos de que você participa.",
}: {
  value: Movement[];
  onChange: (movements: Movement[]) => void;
  label?: string;
  hint?: string;
}) {
  const movements = useMovements();
  const chosen = new Set(value.map((m) => m.id));
  const toggle = (m: Movement) => onChange(chosen.has(m.id) ? value.filter((x) => x.id !== m.id) : [...value, m].sort((a, b) => a.name.localeCompare(b.name, "pt-BR")));
  return (
    <fieldset>
      <legend className="mb-1.5 block text-sm font-medium">{label}</legend>
      {movements.length === 0 ? (
        <p className="text-sm text-ink-muted">Carregando movimentos…</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {movements.map((m) => (
            <button
              key={m.id}
              type="button"
              aria-pressed={chosen.has(m.id)}
              onClick={() => toggle(m)}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-border bg-surface px-3.5 py-1.5 text-sm text-ink-muted transition-colors hover:border-primary aria-pressed:border-primary aria-pressed:bg-primary-soft aria-pressed:font-medium aria-pressed:text-primary"
            >
              {chosen.has(m.id) && <Check size={14} aria-hidden />}
              {m.name}
            </button>
          ))}
        </div>
      )}
      {hint && <p className="mt-1.5 text-sm text-ink-muted">{hint}</p>}
    </fieldset>
  );
}
