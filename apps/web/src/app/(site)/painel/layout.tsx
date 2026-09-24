import type { Metadata } from "next";
import { PanelShell } from "@/components/layout/PanelShell";

export const metadata: Metadata = { title: "Painel", robots: { index: false } };

export default function PainelLayout({ children }: { children: React.ReactNode }) {
  return <PanelShell>{children}</PanelShell>;
}
