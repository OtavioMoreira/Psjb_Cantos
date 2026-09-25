"use client";

import { ShieldAlert } from "lucide-react";
import { useIsAdmin } from "@/lib/store";
import { UsersAdmin } from "@/components/admin/UsersAdmin";
import { ButtonLink } from "@/components/ui/Button";

// Proteção ilustrativa. Na Fase 3 a API recusa (403) quem não tem papel "admin".
export default function AdminUsuariosPage() {
  const isAdmin = useIsAdmin();
  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center py-16 text-center">
        <ShieldAlert size={40} className="text-gold" />
        <h1 className="mt-4 font-serif text-3xl font-semibold">Acesso restrito</h1>
        <p className="mt-2 max-w-md text-ink-muted">Esta área é só para administradores. Entre com uma conta de administrador para gerenciar usuários.</p>
        <ButtonLink href="/painel" className="mt-6">
          Voltar ao painel
        </ButtonLink>
      </div>
    );
  }
  return <UsersAdmin />;
}
