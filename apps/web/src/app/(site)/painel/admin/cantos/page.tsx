"use client";

import { AdminGuard } from "@/components/admin/AdminShell";
import { SongsAdmin } from "@/components/admin/SongsAdmin";

export default function AdminCantosPage() {
  return (
    <AdminGuard needsApi>
      <SongsAdmin />
    </AdminGuard>
  );
}
