"use client";

import { AdminGuard } from "@/components/admin/AdminShell";
import { ImportsAdmin } from "@/components/admin/ImportsAdmin";

export default function AdminSalmosPage() {
  return (
    <AdminGuard needsApi>
      <ImportsAdmin />
    </AdminGuard>
  );
}
