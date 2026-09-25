import type { Metadata } from "next";
import { Suspense } from "react";
import { ResetPassword } from "@/components/auth/PasswordReset";
import { AuthPage } from "@/components/auth/AuthCard";

export const metadata: Metadata = { title: "Redefinir senha", robots: { index: false } };

export default function RedefinirSenhaPage() {
  return (
    <AuthPage>
      <Suspense>
        <ResetPassword />
      </Suspense>
    </AuthPage>
  );
}
