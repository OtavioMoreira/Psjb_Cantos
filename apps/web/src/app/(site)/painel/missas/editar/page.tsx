"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { fetchMass, useMassesVersion, useMyMasses } from "@/lib/store";
import { API_ENABLED, ApiError } from "@/lib/api";
import { MassEditor } from "@/components/mass/MassEditor";
import { ButtonLink } from "@/components/ui/Button";

function Editor() {
  const id = useSearchParams().get("id");
  const mass = useMyMasses().find((m) => m.id === id);
  const version = useMassesVersion();
  // Com a API, a missa pode ainda não estar neste aparelho (link direto): busca no servidor.
  const [lookup, setLookup] = useState<{ id: string; error?: string } | null>(null);
  useEffect(() => {
    if (!API_ENABLED || !id || mass) return;
    let alive = true;
    fetchMass(id)
      .then(() => alive && setLookup({ id }))
      .catch((e) => alive && setLookup({ id, error: e instanceof ApiError && e.status === 403 ? "Você não tem acesso a esta missa." : undefined }));
    return () => {
      alive = false;
    };
  }, [id, mass]);

  if (!mass && API_ENABLED && id && lookup?.id !== id) {
    return (
      <div className="py-16" aria-busy="true">
        <div className="h-10 w-64 animate-pulse rounded bg-surface-2" />
        <div className="mt-6 h-48 animate-pulse rounded-[16px] bg-surface-2" />
      </div>
    );
  }
  if (!mass) {
    return (
      <div className="py-16 text-center">
        <p className="font-serif text-2xl font-semibold">{lookup?.error ?? "Missa não encontrada."}</p>
        <ButtonLink href="/painel/missas" className="mt-6">
          Ver minhas missas
        </ButtonLink>
      </div>
    );
  }
  // key: ao salvar, o editor continua com o próprio estado (não reinicia a cada autosave),
  // mas reabre quando chegam dados novos do servidor (sincronização ao abrir o painel).
  return <MassEditor key={`${mass.id}:${version}`} initial={mass} />;
}

export default function EditarMissaPage() {
  return (
    <Suspense>
      <Editor />
    </Suspense>
  );
}
