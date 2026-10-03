"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { AdminGuard } from "@/components/admin/AdminShell";
import { SongEditor } from "@/components/admin/SongEditor";

/** /painel/admin/cantos/editar → novo canto; ?id=12 → edita (query string por causa do export estático). */
function Editor() {
  const raw = useSearchParams().get("id");
  const id = raw && /^\d+$/.test(raw) ? Number(raw) : null;
  return <SongEditor key={id ?? "novo"} id={id} />;
}

export default function AdminCantoEditarPage() {
  return (
    <AdminGuard needsApi>
      <Suspense>
        <Editor />
      </Suspense>
    </AdminGuard>
  );
}
