"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { setPrefs, usePrefs } from "@/lib/store";
import { useHydrated } from "@/lib/hooks";

const OPTIONS = [
  { id: "light", label: "Claro", Icon: Sun },
  { id: "dark", label: "Escuro", Icon: Moon },
  { id: "system", label: "Sistema", Icon: Monitor },
] as const;

export function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const { theme } = usePrefs();
  const hydrated = useHydrated();
  if (compact) {
    const i = OPTIONS.findIndex((o) => o.id === theme);
    const cur = OPTIONS[hydrated ? i : 0];
    const next = OPTIONS[(i + 1) % OPTIONS.length];
    return (
      <button
        onClick={() => setPrefs({ theme: next.id })}
        aria-label={`Tema: ${cur.label}. Mudar para ${next.label}`}
        title={`Tema: ${cur.label}`}
        className="grid h-10 w-10 place-items-center rounded-full text-ink-muted hover:bg-surface-2 hover:text-primary"
      >
        <cur.Icon size={20} strokeWidth={1.75} />
      </button>
    );
  }
  return (
    <div role="radiogroup" aria-label="Tema" className="inline-flex rounded-[10px] border border-border bg-surface p-1">
      {OPTIONS.map(({ id, label, Icon }) => (
        <button
          key={id}
          role="radio"
          aria-checked={hydrated && theme === id}
          onClick={() => setPrefs({ theme: id })}
          className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm text-ink-muted aria-checked:bg-primary-soft aria-checked:font-semibold aria-checked:text-primary"
        >
          <Icon size={16} /> {label}
        </button>
      ))}
    </div>
  );
}
