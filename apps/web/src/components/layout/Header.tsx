"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { BookOpen, Home, LayoutDashboard, ListMusic, LogOut, Menu, Search, ShieldCheck, User, X, Info } from "lucide-react";
import { Logo } from "./Logo";
import { ThemeToggle } from "./ThemeToggle";
import { initials, logout, useIsAdmin, useSession, useUser } from "@/lib/store";
import { useHydrated } from "@/lib/hooks";

const NAV = [
  { href: "/cantos", label: "Cantos" },
  { href: "/painel/missas/nova", label: "Monte sua Missa" },
  { href: "/sobre", label: "Sobre" },
];

export function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const [drawer, setDrawer] = useState(false);
  const [menu, setMenu] = useState(false);
  const session = useSession();
  const user = useUser();
  const isAdmin = useIsAdmin();
  const hydrated = useHydrated();
  const loggedIn = hydrated && session.loggedIn;
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const typing = /INPUT|TEXTAREA|SELECT/.test(target.tagName);
      if ((e.key === "k" && (e.metaKey || e.ctrlKey)) || (e.key === "/" && !typing)) {
        e.preventDefault();
        const input = document.getElementById("busca-cantos") as HTMLInputElement | null;
        if (input) input.focus();
        else router.push("/cantos?foco=1");
      }
      if (e.key === "Escape") {
        setDrawer(false);
        setMenu(false);
      }
    };
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenu(false);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("click", onClick);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("click", onClick);
    };
  }, [router]);

  const isActive = (href: string) =>
    href === "/painel/missas/nova" ? pathname.startsWith("/painel/missas") : pathname.startsWith(href);

  return (
    <>
      <a href="#conteudo" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[70] focus:rounded focus:bg-surface focus:px-4 focus:py-2">
        Pular para o conteúdo
      </a>
      <header className="sticky top-0 z-40 border-b border-gold/40 bg-bg/90 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-[1440px] items-center gap-3 px-4 sm:h-[72px] sm:px-6 lg:px-10">
          <button
            aria-label="Abrir menu"
            className="-ml-2 grid h-10 w-10 place-items-center rounded-full text-ink hover:bg-surface-2 md:hidden"
            onClick={() => setDrawer(true)}
          >
            <Menu size={22} strokeWidth={1.75} />
          </button>
          <Logo className="h-9 w-auto sm:h-12" priority />
          <nav aria-label="Principal" className="ml-6 hidden items-center gap-6 md:flex">
            {NAV.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                aria-current={isActive(n.href) ? "page" : undefined}
                className="relative py-2 text-[15px] font-medium text-ink-muted transition-colors hover:text-primary aria-[current=page]:text-primary aria-[current=page]:after:absolute aria-[current=page]:after:inset-x-0 aria-[current=page]:after:-bottom-[2px] aria-[current=page]:after:h-0.5 aria-[current=page]:after:bg-gold"
              >
                {n.label}
              </Link>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-1 sm:gap-2">
            <Link
              href="/cantos?foco=1"
              className="hidden items-center gap-2 rounded-full border border-border bg-surface px-4 py-2 text-sm text-ink-muted transition-colors hover:border-primary lg:flex"
            >
              <Search size={16} /> Buscar canto…
              <kbd className="ml-4 rounded border border-border px-1.5 text-xs">/</kbd>
            </Link>
            <Link href="/cantos?foco=1" aria-label="Buscar canto" className="grid h-10 w-10 place-items-center rounded-full text-ink-muted hover:bg-surface-2 lg:hidden">
              <Search size={20} strokeWidth={1.75} />
            </Link>
            <ThemeToggle compact />
            {loggedIn ? (
              <div className="relative" ref={menuRef}>
                <button
                  onClick={() => setMenu((v) => !v)}
                  aria-expanded={menu}
                  aria-haspopup="menu"
                  aria-label="Menu do usuário"
                  className="grid h-10 w-10 place-items-center rounded-full bg-primary-solid font-serif text-lg font-semibold text-[#FFFDF8]"
                >
                  {initials(user.name)}
                </button>
                {menu && (
                  <div role="menu" className="animate-fade-in absolute right-0 top-12 w-56 rounded-[16px] border border-border bg-surface p-2 shadow-overlay">
                    <p className="truncate px-3 pb-2 pt-1 text-sm font-semibold">{user.name}</p>
                    {[
                      { href: "/painel", label: "Painel", Icon: LayoutDashboard },
                      { href: "/painel/missas", label: "Minhas Missas", Icon: ListMusic },
                      { href: "/painel/perfil", label: "Meu perfil", Icon: User },
                      ...(isAdmin ? [{ href: "/painel/admin/usuarios", label: "Usuários (admin)", Icon: ShieldCheck }] : []),
                    ].map(({ href, label, Icon }) => (
                      <Link key={href} role="menuitem" href={href} onClick={() => setMenu(false)} className="flex items-center gap-3 rounded-md px-3 py-2 text-sm hover:bg-primary-soft">
                        <Icon size={16} /> {label}
                      </Link>
                    ))}
                    <button
                      role="menuitem"
                      onClick={() => {
                        logout();
                        setMenu(false);
                        router.push("/");
                      }}
                      className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm text-danger hover:bg-danger/10"
                    >
                      <LogOut size={16} /> Sair
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <Link href="/entrar" className="ml-1 rounded-[10px] border border-primary px-3 py-2 text-sm font-semibold text-primary hover:bg-primary-soft sm:px-4">
                Entrar
              </Link>
            )}
          </div>
        </div>
      </header>

      {drawer && (
        <div className="fixed inset-0 z-50 md:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <div className="absolute inset-0 bg-black/40" onClick={() => setDrawer(false)} />
          <div className="animate-fade-in absolute inset-y-0 left-0 flex w-[85vw] max-w-[360px] flex-col bg-bg p-4 shadow-overlay">
            <div className="flex items-center justify-between">
              <Logo className="h-9 w-auto" />
              <button aria-label="Fechar menu" onClick={() => setDrawer(false)} className="grid h-10 w-10 place-items-center rounded-full hover:bg-surface-2">
                <X size={22} />
              </button>
            </div>
            <nav className="mt-6 flex flex-col" onClick={() => setDrawer(false)}>
              {[
                { href: "/", label: "Início", Icon: Home },
                { href: "/cantos", label: "Cantos", Icon: BookOpen },
                { href: "/painel/missas/nova", label: "Monte sua Missa", Icon: ListMusic },
                { href: loggedIn ? "/painel" : "/entrar", label: loggedIn ? "Meu painel" : "Entrar", Icon: User },
                { href: "/sobre", label: "Sobre", Icon: Info },
              ].map(({ href, label, Icon }) => (
                <Link key={href} href={href} className="flex min-h-12 items-center gap-3 rounded-[10px] px-3 font-serif text-xl font-semibold hover:bg-primary-soft">
                  <Icon size={20} className="text-gold" /> {label}
                </Link>
              ))}
            </nav>
            <p className="mb-2 mt-6 text-xs font-semibold uppercase tracking-[0.08em] text-ink-muted">Tempos</p>
            <div className="flex flex-wrap gap-2" onClick={() => setDrawer(false)}>
              {[
                ["advento", "Advento", "var(--season-roxo)"],
                ["natal", "Natal", "var(--season-dourado)"],
                ["quaresma", "Quaresma", "var(--season-roxo)"],
                ["pascoa", "Páscoa", "var(--season-dourado)"],
                ["tempo-comum", "Tempo Comum", "var(--season-verde)"],
              ].map(([id, label, color]) => (
                <Link key={id} href={`/cantos?tempo=${id}`} className="flex items-center gap-2 rounded-full border border-border px-3 py-2 text-sm">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: color }} /> {label}
                </Link>
              ))}
            </div>
            <div className="mt-auto pt-6">
              <ThemeToggle />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
