import { Logo } from "@/components/layout/Logo";
import { CornerFrame, Divider } from "@/components/ui/Ornament";

export function AuthCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative w-full max-w-[460px] rounded-[16px] border border-border bg-surface px-6 py-10 shadow-overlay sm:px-10">
      <CornerFrame />
      <div className="flex justify-center">
        <Logo className="h-20 w-auto" />
      </div>
      <Divider className="my-6" />
      {children}
    </div>
  );
}

export function AuthPage({ children }: { children: React.ReactNode }) {
  return <div className="parchment flex min-h-[calc(100vh-72px)] items-center justify-center px-4 py-12">{children}</div>;
}

/** Caixa amarela usada para explicar o que é simulado nesta fase. */
export function DemoNote({ children }: { children: React.ReactNode }) {
  return <div className="mt-6 rounded-[10px] border border-gold/40 bg-gold-soft p-4 text-sm">{children}</div>;
}
