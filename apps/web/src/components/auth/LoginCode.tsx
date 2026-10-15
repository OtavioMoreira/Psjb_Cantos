"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, MailCheck, ShieldAlert } from "lucide-react";
import { api, ApiError, type ApiUser, type LoginChallenge } from "@/lib/api";
import { Button } from "@/components/ui/Button";

const LENGTH = 6;
const RESEND_SECONDS = 60;

/**
 * Segunda etapa do login (2FA): o código de 6 dígitos enviado por e-mail.
 * Colar o código inteiro em qualquer campo funciona, e ao completar os 6 números já envia.
 */
export function LoginCode({ challenge: initial, onDone, onBack }: { challenge: LoginChallenge; onDone: (u: ApiUser) => void; onBack: () => void }) {
  const [challenge, setChallenge] = useState(initial);
  const [digits, setDigits] = useState<string[]>(Array(LENGTH).fill(""));
  // Marcado por padrão: no tablet da paróquia e no celular de cada um, o código só é pedido no primeiro acesso.
  const [trust, setTrust] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ text: string; restart?: boolean } | null>(null);
  const [wait, setWait] = useState(RESEND_SECONDS);
  const [resent, setResent] = useState(false);
  const inputs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    inputs.current[0]?.focus();
  }, [challenge.challengeId]);

  useEffect(() => {
    if (wait <= 0) return;
    const t = setTimeout(() => setWait((w) => w - 1), 1000);
    return () => clearTimeout(t);
  }, [wait]);

  const submit = (code: string) => {
    if (code.length !== LENGTH || busy) return;
    setBusy(true);
    setError(null);
    api
      .verifyLoginCode(challenge.challengeId, code, trust)
      .then(onDone)
      .catch((err) => {
        setBusy(false);
        setDigits(Array(LENGTH).fill(""));
        inputs.current[0]?.focus();
        if (err instanceof ApiError && err.code === "INVALID_CODE") {
          const left = err.details?.attemptsLeft;
          return setError({ text: `Código incorreto.${left ? ` Você ainda tem ${left} ${left === 1 ? "tentativa" : "tentativas"}.` : ""}` });
        }
        if (err instanceof ApiError && err.code === "INVALID_TOKEN") return setError({ text: err.message, restart: true });
        setError({ text: err instanceof ApiError ? err.message : "Não foi possível conferir o código. Tente de novo." });
      });
  };

  /** Escreve a partir da posição `from` (vários dígitos = colou o código). */
  const fill = (from: number, value: string) => {
    const nums = value.replace(/\D/g, "");
    if (!nums) return;
    const next = [...digits];
    for (let i = 0; i < nums.length && from + i < LENGTH; i++) next[from + i] = nums[i];
    setDigits(next);
    inputs.current[Math.min(from + nums.length, LENGTH - 1)]?.focus();
    if (next.every(Boolean)) submit(next.join(""));
  };

  const resend = () => {
    setError(null);
    api
      .resendLoginCode(challenge.challengeId)
      .then((c) => {
        setChallenge(c);
        setDigits(Array(LENGTH).fill(""));
        setWait(RESEND_SECONDS);
        setResent(true);
      })
      .catch((err) => {
        if (err instanceof ApiError && err.code === "TOO_SOON") return setWait(err.details?.retryAfter ?? RESEND_SECONDS);
        setError({ text: err instanceof ApiError ? err.message : "Não foi possível reenviar agora.", restart: err instanceof ApiError && err.code === "INVALID_TOKEN" });
      });
  };

  return (
    <>
      <MailCheck size={32} className="text-gold" />
      <h1 className="mt-3 font-serif text-3xl font-semibold">Confirme que é você</h1>
      <p className="mt-1 text-sm text-ink-muted" aria-live="polite">
        {resent ? "Enviamos um código novo para " : "Digite o código de 6 números que enviamos para "}
        <strong className="text-ink">{challenge.emailHint}</strong>. Ele vale por 10 minutos.
      </p>
      <form
        noValidate
        className="mt-6 space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          submit(digits.join(""));
        }}
      >
        <fieldset>
          <legend className="sr-only">Código de acesso</legend>
          <div className="grid grid-cols-6 gap-2">
            {digits.map((d, i) => (
              <input
                key={i}
                ref={(el) => {
                  inputs.current[i] = el;
                }}
                value={d}
                inputMode="numeric"
                autoComplete={i === 0 ? "one-time-code" : "off"}
                aria-label={`Dígito ${i + 1} de ${LENGTH}`}
                disabled={busy}
                onChange={(e) => {
                  const v = e.target.value;
                  if (!v) {
                    const next = [...digits];
                    next[i] = "";
                    return setDigits(next);
                  }
                  // Digitou num campo já preenchido: fica o número novo. Mais que isso é o código
                  // inteiro (colado ou sugerido pelo teclado do celular).
                  fill(i, v.length === 2 && d ? v.replace(d, "") || d : v);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Backspace" && !d && i > 0) inputs.current[i - 1]?.focus();
                  if (e.key === "ArrowLeft" && i > 0) inputs.current[i - 1]?.focus();
                  if (e.key === "ArrowRight" && i < LENGTH - 1) inputs.current[i + 1]?.focus();
                }}
                onPaste={(e) => {
                  e.preventDefault();
                  fill(0, e.clipboardData.getData("text"));
                }}
                onFocus={(e) => e.target.select()}
                className="h-14 w-full min-w-0 rounded-[10px] border border-border bg-surface text-center font-mono text-2xl [font-variant-numeric:lining-nums] focus:border-primary focus:outline-none focus:ring-2 focus:ring-gold"
              />
            ))}
          </div>
        </fieldset>

        <label className="flex min-h-11 items-start gap-2 text-sm">
          <input type="checkbox" checked={trust} onChange={(e) => setTrust(e.target.checked)} className="mt-1 h-4 w-4 accent-[var(--primary-solid)]" />
          <span>
            Confiar neste aparelho por 30 dias
            <span className="block text-ink-muted">Não pede o código de novo aqui. Desmarque em aparelhos de outras pessoas.</span>
          </span>
        </label>

        {error && (
          <div role="alert" className="flex gap-2 rounded-md bg-danger/10 px-3 py-2 text-sm text-danger">
            <ShieldAlert size={18} className="mt-0.5 shrink-0" />
            <div>
              {error.text}
              {error.restart && (
                <button type="button" onClick={onBack} className="ml-1 font-semibold underline underline-offset-2">
                  Entrar de novo
                </button>
              )}
            </div>
          </div>
        )}

        <Button type="submit" disabled={busy || digits.some((x) => !x)} className="h-12 w-full">
          {busy ? <Loader2 size={18} className="animate-spin" /> : "Confirmar"}
        </Button>
      </form>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-sm">
        <button type="button" onClick={onBack} className="inline-flex min-h-11 items-center px-1 font-medium text-ink-muted hover:text-ink">
          ← Voltar
        </button>
        {wait > 0 ? (
          <span className="text-ink-muted [font-variant-numeric:tabular-nums]">Reenviar código em {wait} s</span>
        ) : (
          <button type="button" onClick={resend} className="inline-flex min-h-11 items-center px-1 font-semibold text-primary hover:underline">
            Reenviar código
          </button>
        )}
      </div>
      <p className="mt-2 text-xs text-ink-muted">Não chegou? Confira a caixa de spam ou de promoções.</p>
    </>
  );
}
