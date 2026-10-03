"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ChevronRight, Flag, Music, UserCog, Users } from "lucide-react";
import { api, API_ENABLED } from "@/lib/api";
import { AdminGuard, AdminTitle } from "@/components/admin/AdminShell";

interface Counts {
  pending: number;
  users: number;
  songs: number;
  flags: number;
  movements: number;
}

export default function AdminHomePage() {
  return (
    <AdminGuard>
      <AdminHome />
    </AdminGuard>
  );
}

function AdminHome() {
  const [counts, setCounts] = useState<Counts | null>(null);

  useEffect(() => {
    if (!API_ENABLED) return;
    let alive = true;
    Promise.all([api.admin.users(), api.admin.songs({ pageSize: 1 }), api.admin.flags(), api.admin.movements()])
      .then(([users, songs, flags, movements]) => {
        if (!alive) return;
        setCounts({ pending: users.filter((u) => u.status === "pending").length, users: users.length, songs: songs.total, flags: flags.length, movements: movements.length });
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);

  const n = (v: number | undefined) => (v === undefined ? "…" : String(v));
  const cards = [
    {
      href: "/painel/admin/usuarios",
      title: "Usuários",
      Icon: Users,
      text: "Ativar contas novas, ver papéis e status.",
      stat: API_ENABLED ? `${n(counts?.users)} contas` : "Demonstração",
      badge: counts?.pending ? `${counts.pending} aguardando ativação` : null,
    },
    { href: "/painel/admin/cantos", title: "Cantos", Icon: Music, text: "Letra e cifra, flags, PDF e áudio. Publicar no site.", stat: API_ENABLED ? `${n(counts?.songs)} cantos` : "Com servidor" },
    { href: "/painel/admin/flags", title: "Flags", Icon: Flag, text: "Momentos, tempos, anos (A, B, C) e temas dos cantos.", stat: API_ENABLED ? `${n(counts?.flags)} flags` : "Com servidor" },
    { href: "/painel/admin/movimentos", title: "Movimentos", Icon: UserCog, text: "Pastorais e movimentos que aparecem no cadastro.", stat: API_ENABLED ? `${n(counts?.movements)} movimentos` : "Com servidor" },
  ];

  return (
    <div>
      <AdminTitle title="Administração" description="Escolha o que você quer gerenciar." />
      <ul className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        {cards.map(({ href, title, Icon, text, stat, badge }) => (
          <li key={href}>
            <Link
              href={href}
              className="group flex h-full min-h-[140px] flex-col rounded-[16px] border border-border bg-surface p-5 shadow-card transition hover:border-primary hover:shadow-raised"
            >
              <span className="flex items-center justify-between">
                <span className="grid h-11 w-11 place-items-center rounded-full bg-primary-soft text-primary">
                  <Icon size={22} />
                </span>
                <ChevronRight size={20} className="text-ink-muted transition group-hover:translate-x-0.5 group-hover:text-primary" />
              </span>
              <span className="mt-3 font-serif text-2xl font-semibold">{title}</span>
              <span className="mt-1 text-sm text-ink-muted">{text}</span>
              <span className="mt-auto flex flex-wrap items-center gap-2 pt-3 text-sm">
                <span className="font-medium [font-variant-numeric:lining-nums]">{stat}</span>
                {badge && <span className="rounded-full bg-gold-soft px-2 py-0.5 text-xs font-semibold text-gold-ink">{badge}</span>}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
