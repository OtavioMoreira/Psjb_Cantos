import type { Metadata } from "next";
import { Suspense } from "react";
import { ConfirmEmail } from "@/components/auth/ConfirmEmail";
import { AuthPage } from "@/components/auth/AuthCard";

export const metadata: Metadata = { title: "Confirmar e-mail", robots: { index: false } };

export default function ConfirmarEmailPage() {
  return (
    <AuthPage>
      <Suspense>
        <ConfirmEmail />
      </Suspense>
    </AuthPage>
  );
}
