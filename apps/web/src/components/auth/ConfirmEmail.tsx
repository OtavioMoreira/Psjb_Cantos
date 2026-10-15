"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CircleCheck, CircleX, Loader2 } from "lucide-react";
import { syncApiUser, verifyEmail } from "@/lib/store";
import { api, API_ENABLED, ApiError } from "@/lib/api";
import { ButtonLink } from "@/components/ui/Button";
import { AuthCard } from "./AuthCard";

export function ConfirmEmail() {
  const token = useSearchParams().get("token") ?? "";
  const [result, setResult] = useState<"verificando" | "ok" | "trocado" | "invalido">("verificando");
  const [newEmail, setNewEmail] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!API_ENABLED) {
      const t = setTimeout(() => setResult(token ? verifyEmail(token) : "invalido"), 700);
      return () => clearTimeout(t);
    }
    // Com a API, este link confirma a troca de e-mail feita no perfil.
    let alive = true;
    const t = setTimeout(() => {
      api
        .confirmEmailChange(token)
        .then((r) => {
          if (!alive) return;
          setNewEmail(r.email);
          setResult("trocado");
          // Se este aparelho está logado, atualiza o e-mail mostrado no painel.
          api.me().then(syncApiUser, () => undefined);
        })
        .catch((e) => {
          if (!alive) return;
          if (e instanceof ApiError && e.code !== "INVALID_TOKEN" && e.code !== "VALIDATION_ERROR") setMessage(e.message);
          setResult("invalido");
        });
    }, 0);
    return () => {
      alive = false;
      clearTimeout(t);
    };
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
        {result === "trocado" && (
          <>
            <CircleCheck size={48} className="mx-auto text-success" />
            <h1 className="mt-4 font-serif text-3xl font-semibold">E-mail alterado!</h1>
            <p className="mt-2 text-ink-muted">
              A partir de agora, você entra com <strong className="text-ink">{newEmail}</strong>.
            </p>
            <ButtonLink href="/painel" className="mt-6 w-full">
              Ir para o painel
            </ButtonLink>
          </>
        )}
        {result === "invalido" && (
          <>
            <CircleX size={48} className="mx-auto text-danger" />
            <h1 className="mt-4 font-serif text-3xl font-semibold">Link inválido ou expirado</h1>
            <p className="mt-2 text-ink-muted">
              {message ||
                (API_ENABLED
                  ? "Este link já foi usado ou expirou. Peça a troca de novo em Meu perfil."
                  : "Este link já foi usado ou expirou. Entre com seu e-mail para receber um novo link.")}
            </p>
            <ButtonLink href="/entrar" variant="secondary" className="mt-6 w-full">
              Ir para o login
            </ButtonLink>
          </>
        )}
      </div>
    </AuthCard>
  );
}
