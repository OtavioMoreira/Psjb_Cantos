"use client";

import { useEffect, useRef } from "react";
import { API_ENABLED } from "@/lib/api";
import { Recaptcha } from "./Recaptcha";

// Desafio "não sou um robô". Com a API e a chave do site (NEXT_PUBLIC_CAPTCHA_SITE_KEY), é o de verdade:
// Cloudflare Turnstile (padrão) ou Google reCAPTCHA v2, e o token é conferido no servidor. Com a API e
// sem a chave, o servidor também não pede (CAPTCHA_SECRET ausente) e nada aparece. Na demonstração,
// fica o widget ilustrativo.

const SITE_KEY = process.env.NEXT_PUBLIC_CAPTCHA_SITE_KEY ?? "";
const PROVIDER = process.env.NEXT_PUBLIC_CAPTCHA_PROVIDER === "recaptcha" ? "recaptcha" : "turnstile";

/** Com a API e sem chave, o desafio está desligado: o formulário não precisa esperar por ele. */
export const CAPTCHA_ENABLED = !API_ENABLED || Boolean(SITE_KEY);

type Widget = {
  render: (el: HTMLElement, opts: Record<string, unknown>) => string | number;
  reset: (id?: string | number) => void;
  remove?: (id: string | number) => void;
};

const SCRIPT = {
  turnstile: "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit",
  recaptcha: "https://www.google.com/recaptcha/api.js?render=explicit&hl=pt-BR",
};

let loading: Promise<Widget> | null = null;
function loadWidget(): Promise<Widget> {
  loading ??= new Promise<Widget>((resolve, reject) => {
    const s = document.createElement("script");
    s.src = SCRIPT[PROVIDER];
    s.async = true;
    s.onerror = () => {
      loading = null;
      reject(new Error("Não foi possível carregar o desafio."));
    };
    s.onload = () => {
      const w = window as unknown as { turnstile?: Widget; grecaptcha?: Widget & { ready: (cb: () => void) => void } };
      if (PROVIDER === "turnstile") resolve(w.turnstile!);
      else w.grecaptcha!.ready(() => resolve(w.grecaptcha!));
    };
    document.head.appendChild(s);
  });
  return loading;
}

/**
 * `onToken` recebe o token (ou null quando ele vence). O token só vale uma vez: depois de uma resposta
 * de erro do servidor, mude `resetKey` para pedir um novo.
 */
export function HumanCheck({ onToken, resetKey = 0 }: { onToken: (token: string | null) => void; resetKey?: number }) {
  if (!API_ENABLED) return <Recaptcha onChange={(ok) => onToken(ok ? "demo" : null)} />;
  if (!SITE_KEY) return null;
  return <RealWidget onToken={onToken} resetKey={resetKey} />;
}

function RealWidget({ onToken, resetKey }: { onToken: (token: string | null) => void; resetKey: number }) {
  const box = useRef<HTMLDivElement>(null);
  const widget = useRef<{ api: Widget; id: string | number } | null>(null);
  const cb = useRef(onToken);
  useEffect(() => {
    cb.current = onToken;
  }, [onToken]);

  useEffect(() => {
    let alive = true;
    loadWidget()
      .then((api) => {
        if (!alive || !box.current) return;
        const id = api.render(box.current, {
          sitekey: SITE_KEY,
          callback: (t: string) => cb.current(t),
          "expired-callback": () => cb.current(null),
          "error-callback": () => cb.current(null),
          language: "pt-br",
        });
        widget.current = { api, id };
      })
      .catch(() => cb.current(null));
    return () => {
      alive = false;
      const w = widget.current;
      if (w?.api.remove) w.api.remove(w.id);
      widget.current = null;
    };
  }, []);

  // Token gasto (o servidor já conferiu): pede um novo.
  useEffect(() => {
    if (!resetKey || !widget.current) return;
    widget.current.api.reset(widget.current.id);
    cb.current(null);
  }, [resetKey]);

  return <div ref={box} className="min-h-[65px]" aria-label="Verificação de segurança" />;
}
