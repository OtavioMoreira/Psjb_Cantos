"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { Home, ListMusic, LogOut, Plus, ShieldCheck, User } from "lucide-react";
import { initials, logout, useIsAdmin, useSession, useUser } from "@/lib/store";
import { useHydrated } from "@/lib/hooks";

const ADMIN_LINK = { href: "/painel/admin/usuarios", label: "Usuários", short: "Admin", Icon: ShieldCheck };

const LINKS = [
  { href: "/painel", label: "Visão geral", short: "Início", Icon: Home },
  { href: "/painel/missas", label: "Minhas Missas", short: "Missas", Icon: ListMusic },
  { href: "/painel/missas/nova", label: "Nova missa", short: "Nova", Icon: Plus },
  { href: "/painel/perfil", label: "Meu perfil", short: "Perfil", Icon: User },
];

/** Proteção ilustrativa: sem sessão, redireciona para /entrar. (Fase 3: proxy + cookie httpOnly.) */
export function PanelShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const hydrated = useHydrated();
  const session = useSession();
  const user = useUser();
  const isAdmin = useIsAdmin();
  const links = isAdmin ? [...LINKS, ADMIN_LINK] : LINKS;

  useEffect(() => {
    if (hydrated && !session.loggedIn) router.replace(`/entrar?volta=${encodeURIComponent(pathname)}`);
  }, [hydrated, session.loggedIn, pathname, router]);

  if (!hydrated || !session.loggedIn) {
    return (
      <div className="mx-auto max-w-[1440px] px-4 py-10" aria-busy="true">
        <div className="h-10 w-64 animate-pulse rounded bg-surface-2" />
        <div className="mt-6 h-48 animate-pulse rounded-[16px] bg-surface-2" />
      </div>
    );
  }

  const active = (href: string) =>
    href === "/painel"
      ? pathname === "/painel"
      : href === "/painel/missas"
        ? pathname.startsWith("/painel/missas") && pathname !== "/painel/missas/nova"
        : pathname.startsWith(href);

  return (
    <div className="mx-auto max-w-[1440px] px-4 pb-24 pt-6 sm:px-6 md:grid md:grid-cols-[220px_1fr] md:gap-10 md:pb-10 lg:px-10">
      <aside className="hidden md:block">
        <div className="sticky top-[96px]">
          <div className="flex items-center gap-3">
            <span className="grid h-12 w-12 place-items-center rounded-full bg-primary-solid font-serif text-xl font-semibold text-[#FFFDF8]">
              {initials(user.name)}
            </span>
            <div className="min-w-0">
              <p className="truncate font-semibold">{user.name}</p>
              <p className="truncate text-xs text-ink-muted">{isAdmin ? "Administrador" : user.ministry}</p>
            </div>
          </div>
          <nav aria-label="Painel" className="mt-6 space-y-1 border-t border-border pt-4">
            {links.map(({ href, label, Icon }) => (
              <Link
                key={href}
                href={href}
                aria-current={active(href) ? "page" : undefined}
                className="flex items-center gap-3 rounded-[10px] px-3 py-2.5 text-[15px] font-medium text-ink-muted hover:bg-surface-2 hover:text-ink aria-[current=page]:bg-primary-soft aria-[current=page]:text-primary"
              >
                <Icon size={18} /> {label}
              </Link>
            ))}
            <button
              onClick={() => {
                logout();
                router.push("/");
              }}
              className="mt-4 flex w-full items-center gap-3 rounded-[10px] border-t border-border px-3 pb-2.5 pt-4 text-[15px] font-medium text-ink-muted hover:text-danger"
            >
              <LogOut size={18} /> Sair
            </button>
          </nav>
        </div>
      </aside>
      <div className="min-w-0">{children}</div>

      <nav aria-label="Painel" style={{ gridTemplateColumns: `repeat(${links.length}, minmax(0, 1fr))` }} className="fixed inset-x-0 bottom-0 z-30 grid border-t border-border bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
        {links.map(({ href, short, Icon }) => (
          <Link
            key={href}
            href={href}
            aria-current={active(href) ? "page" : undefined}
            className="flex h-16 flex-col items-center justify-center gap-1 text-xs font-medium text-ink-muted aria-[current=page]:text-primary"
          >
            <Icon size={22} strokeWidth={1.75} /> {short}
          </Link>
        ))}
      </nav>
    </div>
  );
}
