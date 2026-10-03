"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Link2Off, Loader2 } from "lucide-react";
import { API_ENABLED, ApiError } from "@/lib/api";
import { joinMassByToken, logout, useSession } from "@/lib/store";
import { useHydrated } from "@/lib/hooks";
import { massEditUrl } from "@/lib/routes";
import { AuthCard } from "@/components/auth/AuthCard";
import { ButtonLink } from "@/components/ui/Button";

/**
 * /convite?token=… : quem abre o link de convite de uma missa.
 * Sem login → vai para /entrar e volta aqui. Logado → vira convidado e cai direto no editor da missa.
 */
export function Invite() {
  const token = useSearchParams().get("token") ?? "";
  const router = useRouter();
  const hydrated = useHydrated();
  const { loggedIn } = useSession();
  const [error, setError] = useState<string | null>(null);
  const here = `/convite?token=${encodeURIComponent(token)}`;

  useEffect(() => {
    if (!hydrated || !API_ENABLED || !token) return;
    if (!loggedIn) {
      router.replace(`/entrar?volta=${encodeURIComponent(here)}`);
      return;
    }
    let alive = true;
    joinMassByToken(token)
      .then((id) => alive && router.replace(massEditUrl(id)))
      .catch((err) => {
        if (!alive) return;
        // Sessão vencida no servidor: entra de novo e volta para o convite.
        if (err instanceof ApiError && err.status === 401) {
          logout();
          router.replace(`/entrar?volta=${encodeURIComponent(here)}`);
          return;
        }
        setError(err instanceof ApiError ? err.message : "Não foi possível abrir o convite agora. Verifique a internet e tente de novo.");
      });
    return () => {
      alive = false;
    };
  }, [hydrated, loggedIn, token, here, router]);

  const problem = !API_ENABLED
    ? "Os convites por link funcionam na versão com servidor. Nesta demonstração, o compartilhamento é feito pela lista de pessoas."
    : !token
      ? "Este link de convite está incompleto. Peça um novo a quem montou a missa."
      : error;

  return (
    <AuthCard>
      {problem ? (
        <div className="text-center">
          <span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-danger/10 text-danger">
            <Link2Off size={30} />
          </span>
          <h1 className="mt-4 font-serif text-3xl font-semibold">Convite indisponível</h1>
          <p className="mt-2 text-ink-muted">{problem}</p>
          <ButtonLink href="/painel/missas" variant="secondary" className="mt-6 w-full">
            Ir para Minhas Missas
          </ButtonLink>
        </div>
      ) : (
        <div className="py-6 text-center" role="status">
          <Loader2 size={32} className="mx-auto animate-spin text-primary" />
          <h1 className="mt-4 font-serif text-3xl font-semibold">Abrindo a missa…</h1>
          <p className="mt-2 text-ink-muted">Estamos liberando o seu acesso. Já já você cai direto nos cantos.</p>
        </div>
      )}
    </AuthCard>
  );
}
