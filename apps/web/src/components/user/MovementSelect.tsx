"use client";

import { useMovements } from "@/lib/movements";

/** Campo "Movimento" (cadastro, perfil e admin). Valor null = nenhum. */
export function MovementSelect({
  id = "movement",
  value,
  onChange,
  label = "Movimento (opcional)",
}: {
  id?: string;
  value: number | null;
  onChange: (movement: { id: number; name: string } | null) => void;
  label?: string;
}) {
  const movements = useMovements();
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium">
        {label}
      </label>
      <select
        id={id}
        name={id}
        value={value ?? ""}
        onChange={(e) => onChange(movements.find((m) => m.id === Number(e.target.value)) ?? null)}
        className="h-11 w-full rounded-[6px] border border-border bg-surface px-3 outline-none focus:border-primary focus:ring-2 focus:ring-gold/40"
      >
        <option value="">Nenhum</option>
        {movements.map((m) => (
          <option key={m.id} value={m.id}>
            {m.name}
          </option>
        ))}
      </select>
    </div>
  );
}
