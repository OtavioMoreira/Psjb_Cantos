"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { Flag, Home, ListMusic, LogOut, Music, Plus, ShieldCheck, User, UserCog, Users } from "lucide-react";
import { logout, syncApiUser, syncMasses, useIsAdmin, useSession, useUser } from "@/lib/store";
import { UserAvatar } from "@/components/user/UserAvatar";
import { api, API_ENABLED, ApiError } from "@/lib/api";
import { useHydrated } from "@/lib/hooks";

const ADMIN_LINK = { href: "/painel/admin", label: "Administração", short: "Admin", Icon: ShieldCheck };
/** Seções do admin, listadas abaixo de "Administração" na barra lateral. */
const ADMIN_SECTIONS = [
  { href: "/painel/admin/usuarios", label: "Usuários", Icon: Users },
  { href: "/painel/admin/cantos", label: "Cantos", Icon: Music },
  { href: "/painel/admin/flags", label: "Flags", Icon: Flag },
  { href: "/painel/admin/movimentos", label: "Movimentos", Icon: UserCog },
];

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
    // Leva a query junto (ex.: ?id= do editor), para voltar ao mesmo lugar depois do login.
    if (hydrated && !session.loggedIn) router.replace(`/entrar?volta=${encodeURIComponent(pathname + window.location.search)}`);
  }, [hydrated, session.loggedIn, pathname, router]);

  // Com a API, confere a sessão no servidor (renova o token pelo cookie) e atualiza os dados da pessoa.
  useEffect(() => {
    if (!API_ENABLED || !hydrated || !session.loggedIn) return;
    let alive = true;
    api
      .me()
      .then((u) => {
        if (!alive) return;
        syncApiUser(u);
        return syncMasses();
      })
      .catch((e) => {
        if (alive && e instanceof ApiError && e.status === 401) logout();
      });
    return () => {
      alive = false;
    };
  }, [hydrated, session.loggedIn]);

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
            <UserAvatar name={user.name} photoUrl={user.photoUrl} size={48} />
            <div className="min-w-0">
              <p className="truncate font-semibold">{user.name}</p>
              <p className="truncate text-xs text-ink-muted">{isAdmin ? "Administrador" : user.movement}</p>
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
            {isAdmin && pathname.startsWith("/painel/admin") && (
              <ul className="ml-5 space-y-0.5 border-l border-border pl-2">
                {ADMIN_SECTIONS.map(({ href, label, Icon }) => (
                  <li key={href}>
                    <Link
                      href={href}
                      aria-current={pathname.startsWith(href) ? "page" : undefined}
                      className="flex items-center gap-2.5 rounded-[8px] px-2.5 py-2 text-sm text-ink-muted hover:bg-surface-2 hover:text-ink aria-[current=page]:font-semibold aria-[current=page]:text-primary"
                    >
                      <Icon size={16} /> {label}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
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
