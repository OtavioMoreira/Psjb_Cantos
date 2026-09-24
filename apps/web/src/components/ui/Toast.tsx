"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";

interface ToastItem {
  id: number;
  message: string;
  action?: { label: string; onClick: () => void };
}

let push: ((t: Omit<ToastItem, "id">) => void) | null = null;

export function toast(message: string, action?: ToastItem["action"]) {
  push?.({ message, action });
}

export function Toaster() {
  const [items, setItems] = useState<ToastItem[]>([]);

  useEffect(() => {
    push = (t) => {
      const id = Date.now() + Math.random();
      setItems((cur) => [...cur.slice(-2), { ...t, id }]);
      setTimeout(() => setItems((cur) => cur.filter((i) => i.id !== id)), t.action ? 6000 : 4000);
    };
    return () => {
      push = null;
    };
  }, []);

  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-20 z-[60] flex flex-col items-center gap-2 px-4 sm:bottom-6 sm:items-end sm:pr-6"
    >
      {items.map((t) => (
        <div
          key={t.id}
          className="animate-fade-in pointer-events-auto flex max-w-sm items-center gap-3 rounded-[10px] bg-primary-solid px-4 py-3 text-sm text-[#FFFDF8] shadow-overlay"
        >
          <span>{t.message}</span>
          {t.action && (
            <button
              className="font-semibold text-[#F1E6CC] underline underline-offset-2"
              onClick={() => {
                t.action!.onClick();
                setItems((cur) => cur.filter((i) => i.id !== t.id));
              }}
            >
              {t.action.label}
            </button>
          )}
          <button
            aria-label="Fechar aviso"
            className="ml-1 opacity-70 hover:opacity-100"
            onClick={() => setItems((cur) => cur.filter((i) => i.id !== t.id))}
          >
            <X size={16} />
          </button>
        </div>
      ))}
    </div>
  );
}
