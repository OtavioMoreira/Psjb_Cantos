import type { Metadata } from "next";
import { Suspense } from "react";
import { MassMode } from "@/components/mass/MassMode";

export const metadata: Metadata = { title: "Modo Missa", robots: { index: false } };

export default function ModoMissaPage() {
  return (
    <Suspense>
      <MassMode />
    </Suspense>
  );
}
