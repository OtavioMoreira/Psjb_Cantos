"use client";

import Link from "next/link";
import { useMemo } from "react";
import { ArrowRight, Plus } from "lucide-react";
import { useMasses, useUser } from "@/lib/store";
import { useSongIndex } from "@/lib/useSongIndex";
import { todayIso } from "@/lib/liturgy";
import { Divider } from "@/components/ui/Ornament";
import { ButtonLink } from "@/components/ui/Button";
import { MassCard } from "@/components/mass/MassCard";

export default function PainelPage() {
  const user = useUser();
  const masses = useMasses();
  const { songs } = useSongIndex();
  const today = todayIso();
  const upcoming = [...masses].filter((m) => m.date >= today).sort((a, b) => a.date.localeCompare(b.date));
  const next = upcoming[0];
  const recent = [...masses].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).filter((m) => m !== next).slice(0, 4);

  const topSongs = useMemo(() => {
    const count = new Map<number, number>();
    masses.forEach((m) => m.slots.forEach((s) => s.items.forEach((i) => count.set(i.songId, (count.get(i.songId) ?? 0) + 1))));
    return [...count.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([id, n]) => ({ song: songs?.find((s) => s.id === id), n }))
      .filter((x) => x.song);
  }, [masses, songs]);

  return (
    <div>
      <h1 className="font-serif text-[32px] font-semibold text-primary sm:text-[40px]">A paz, {user.name.split(" ")[0]}!</h1>
      <Divider align="left" className="mb-8 mt-3 [&>span:first-child]:hidden" />

      <section>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.08em] text-ink-muted">Próxima missa</h2>
        {next ? (
          <MassCard mass={next} />
        ) : (
          <div className="rounded-[16px] border border-dashed border-border p-8 text-center">
            <p className="text-ink-muted">Nenhuma missa agendada.</p>
            <ButtonLink href="/painel/missas/nova" className="mt-4">
              <Plus size={18} /> Montar missa
            </ButtonLink>
          </div>
        )}
      </section>

      {recent.length > 0 && (
        <section className="mt-10">
          <div className="mb-3 flex items-end justify-between">
            <h2 className="text-xs font-semibold uppercase tracking-[0.08em] text-ink-muted">Missas recentes</h2>
            <Link href="/painel/missas" className="flex items-center gap-1 text-sm font-semibold text-primary hover:underline">
              Ver todas <ArrowRight size={16} />
            </Link>
          </div>
          <div className="grid gap-3 lg:grid-cols-2">
            {recent.map((m) => (
              <MassCard key={m.id} mass={m} />
            ))}
          </div>
        </section>
      )}

      {topSongs.length > 0 && (
        <section className="mt-10">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.08em] text-ink-muted">Cantos que você mais usa</h2>
          <ol className="divide-y divide-border rounded-[10px] border border-border bg-surface">
            {topSongs.map(({ song, n }, i) => (
              <li key={song!.id}>
                <Link href={`/cantos/${song!.slug}`} className="flex items-center gap-4 px-4 py-3 hover:bg-surface-2">
                  <span className="font-serif text-lg font-semibold text-gold-ink">{i + 1}</span>
                  <span className="flex-1 font-medium">{song!.title}</span>
                  <span className="text-xs text-ink-muted">
                    {n} {n === 1 ? "missa" : "missas"}
                  </span>
                </Link>
              </li>
            ))}
          </ol>
        </section>
      )}
    </div>
  );
}
