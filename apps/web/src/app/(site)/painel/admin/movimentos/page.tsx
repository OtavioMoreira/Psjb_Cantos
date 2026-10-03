"use client";

import { AdminGuard } from "@/components/admin/AdminShell";
import { MovementsAdmin } from "@/components/admin/MovementsAdmin";

export default function AdminMovimentosPage() {
  return (
    <AdminGuard needsApi>
      <MovementsAdmin />
    </AdminGuard>
  );
}
