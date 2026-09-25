"use client";

import { useState } from "react";
import { Check, Loader2, RefreshCw } from "lucide-react";

/**
 * reCAPTCHA ILUSTRATIVO (Fase 1). Na Fase 3: Google reCAPTCHA v2 (checkbox) ou v3 (invisível)
 * com o token validado no servidor (POST https://www.google.com/recaptcha/api/siteverify). Ver planning.md.
 */
export function Recaptcha({ onChange }: { onChange: (verified: boolean) => void }) {
  const [state, setState] = useState<"idle" | "checking" | "ok">("idle");
  return (
    <div className="flex h-[78px] w-full max-w-[304px] items-center justify-between rounded-[4px] border border-[#d3d3d3] bg-[#f9f9f9] px-3 text-[#222] shadow-[0_0_4px_1px_rgba(0,0,0,0.08)]">
      <button
        type="button"
        role="checkbox"
        aria-checked={state === "ok"}
        aria-label="Não sou um robô"
        disabled={state !== "idle"}
        onClick={() => {
          setState("checking");
          setTimeout(() => {
            setState("ok");
            onChange(true);
          }, 900);
        }}
        className="flex items-center gap-3 text-left"
      >
        <span className="grid h-7 w-7 place-items-center rounded-[2px] border-2 border-[#c1c1c1] bg-white">
          {state === "checking" && <Loader2 size={20} className="animate-spin text-[#4a90e2]" />}
          {state === "ok" && <Check size={24} strokeWidth={3} className="text-[#009688]" />}
        </span>
        <span className="text-sm">Não sou um robô</span>
      </button>
      <span className="flex flex-col items-center text-[10px] leading-tight text-[#555]">
        <RefreshCw size={26} className="mb-0.5 text-[#4a90e2]" />
        reCAPTCHA
        <span className="text-[10px]">demonstração</span>
      </span>
    </div>
  );
}
