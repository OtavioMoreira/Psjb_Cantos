"use client";

import { AdminGuard } from "@/components/admin/AdminShell";
import { AuditAdmin } from "@/components/admin/AuditAdmin";

export default function AdminAuditoriaPage() {
  return (
    <AdminGuard needsApi>
      <AuditAdmin />
    </AdminGuard>
  );
}
