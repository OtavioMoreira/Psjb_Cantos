"use client";

import { AdminGuard } from "@/components/admin/AdminShell";
import { FlagsAdmin } from "@/components/admin/FlagsAdmin";

export default function AdminFlagsPage() {
  return (
    <AdminGuard needsApi>
      <FlagsAdmin />
    </AdminGuard>
  );
}
