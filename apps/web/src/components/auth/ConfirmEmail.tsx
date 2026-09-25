"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CircleCheck, CircleX, Loader2 } from "lucide-react";
import { verifyEmail } from "@/lib/store";
import { ButtonLink } from "@/components/ui/Button";
import { AuthCard } from "./AuthCard";

export function ConfirmEmail() {
  const token = useSearchParams().get("token") ?? "";
  const [result, setResult] = useState<"verificando" | "ok" | "invalido">("verificando");

  useEffect(() => {
    // Fase 3: POST /api/auth/verify-email { token } — o servidor muda o status para "ativo".
    const t = setTimeout(() => setResult(token ? verifyEmail(token) : "invalido"), 700);
    return () => clearTimeout(t);
  }, [token]);

  return (
    <AuthCard>
      <div className="text-center" aria-live="polite">
        {result === "verificando" && (
          <>
            <Loader2 size={40} className="mx-auto animate-spin text-primary" />
            <h1 className="mt-4 font-serif text-3xl font-semibold">Confirmando seu e-mail…</h1>
          </>
        )}
        {result === "ok" && (
          <>
            <CircleCheck size={48} className="mx-auto text-success" />
            <h1 className="mt-4 font-serif text-3xl font-semibold">E-mail confirmado!</h1>
            <p className="mt-2 text-ink-muted">Sua conta está ativa. Seja bem-vindo(a) ao repertório da Catedral.</p>
            <ButtonLink href="/entrar" className="mt-6 w-full">
              Entrar agora
            </ButtonLink>
          </>
        )}
        {result === "invalido" && (
          <>
            <CircleX size={48} className="mx-auto text-danger" />
            <h1 className="mt-4 font-serif text-3xl font-semibold">Link inválido ou expirado</h1>
            <p className="mt-2 text-ink-muted">Este link já foi usado ou expirou. Entre com seu e-mail para receber um novo link.</p>
            <ButtonLink href="/entrar" variant="secondary" className="mt-6 w-full">
              Ir para o login
            </ButtonLink>
          </>
        )}
      </div>
    </AuthCard>
  );
}
