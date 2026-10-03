"use client";

import { UsersAdmin } from "@/components/admin/UsersAdmin";
import { AdminGuard } from "@/components/admin/AdminShell";

// A guarda aqui é conforto visual: a API recusa (403) quem não tem o papel admin.
export default function AdminUsuariosPage() {
  return (
    <AdminGuard>
      <UsersAdmin />
    </AdminGuard>
  );
}
