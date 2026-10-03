import type { Metadata } from "next";
import { Suspense } from "react";
import { Invite } from "@/components/mass/Invite";

export const metadata: Metadata = { title: "Convite para a missa", robots: { index: false } };

export default function ConvitePage() {
  return (
    <Suspense>
      <Invite />
    </Suspense>
  );
}
