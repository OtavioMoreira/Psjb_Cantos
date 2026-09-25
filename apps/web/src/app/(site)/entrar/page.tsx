import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthForms } from "@/components/auth/AuthForms";
import { AuthPage } from "@/components/auth/AuthCard";

export const metadata: Metadata = { title: "Entrar ou criar conta" };

export default function EntrarPage() {
  return (
    <AuthPage>
      <Suspense>
        <AuthForms />
      </Suspense>
    </AuthPage>
  );
}
