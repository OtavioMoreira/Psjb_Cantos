import type { Metadata } from "next";
import { Suspense } from "react";
import { LoginForm } from "@/components/layout/LoginForm";

export const metadata: Metadata = { title: "Entrar" };

export default function EntrarPage() {
  return (
    <div className="parchment flex min-h-[calc(100vh-72px)] items-center justify-center px-4 py-12">
      <Suspense>
        <LoginForm />
      </Suspense>
    </div>
  );
}
