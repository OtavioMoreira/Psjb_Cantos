"use client";

import { ServerOff, ShieldAlert, ShieldCheck } from "lucide-react";
import { API_ENABLED } from "@/lib/api";
import { useIsAdmin } from "@/lib/store";
import { ButtonLink } from "@/components/ui/Button";

/** Só admin entra. Com `needsApi`, a tela existe apenas na versão com servidor. (A API também recusa com 403.) */
export function AdminGuard({ children, needsApi = false }: { children: React.ReactNode; needsApi?: boolean }) {
  const isAdmin = useIsAdmin();
  if (!isAdmin)
    return (
      <Blocked icon={<ShieldAlert size={40} className="text-gold" />} title="Acesso restrito">
        Esta área é só para administradores. Entre com uma conta de administrador para continuar.
      </Blocked>
    );
  if (needsApi && !API_ENABLED)
    return (
      <Blocked icon={<ServerOff size={40} className="text-gold" />} title="Disponível na versão com servidor">
        Cantos, flags e movimentos são gerenciados pela API. Nesta demonstração, o repertório vem dos arquivos de exemplo.
      </Blocked>
    );
  return <>{children}</>;
}

function Blocked({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center py-16 text-center">
      {icon}
      <h1 className="mt-4 font-serif text-3xl font-semibold">{title}</h1>
      <p className="mt-2 max-w-md text-ink-muted">{children}</p>
      <ButtonLink href="/painel" className="mt-6">
        Voltar ao painel
      </ButtonLink>
    </div>
  );
}

/** Cabeçalho das telas de admin: "Administração" + título + ações à direita. */
export function AdminTitle({ title, children, description }: { title: string; children?: React.ReactNode; description?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.08em] text-gold-ink">
          <ShieldCheck size={14} /> Administração
        </p>
        <h1 className="font-serif text-[32px] font-semibold text-primary sm:text-[40px]">{title}</h1>
        {description && <p className="mt-1 max-w-2xl text-sm text-ink-muted">{description}</p>}
      </div>
      {children && <div className="flex flex-wrap gap-2">{children}</div>}
    </div>
  );
}
