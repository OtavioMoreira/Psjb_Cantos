"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useMasses } from "@/lib/store";
import { MassEditor } from "@/components/mass/MassEditor";
import { ButtonLink } from "@/components/ui/Button";

function Editor() {
  const id = useSearchParams().get("id");
  const mass = useMasses().find((m) => m.id === id);
  if (!mass) {
    return (
      <div className="py-16 text-center">
        <p className="font-serif text-2xl font-semibold">Missa não encontrada.</p>
        <ButtonLink href="/painel/missas" className="mt-6">
          Ver minhas missas
        </ButtonLink>
      </div>
    );
  }
  // key: ao salvar, o editor continua com o próprio estado (não reinicia a cada autosave).
  return <MassEditor key={mass.id} initial={mass} />;
}

export default function EditarMissaPage() {
  return (
    <Suspense>
      <Editor />
    </Suspense>
  );
}
