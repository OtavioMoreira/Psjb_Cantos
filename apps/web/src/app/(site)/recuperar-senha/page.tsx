import type { Metadata } from "next";
import { ForgotPassword } from "@/components/auth/PasswordReset";
import { AuthPage } from "@/components/auth/AuthCard";

export const metadata: Metadata = { title: "Recuperar senha" };

export default function RecuperarSenhaPage() {
  return (
    <AuthPage>
      <ForgotPassword />
    </AuthPage>
  );
}
