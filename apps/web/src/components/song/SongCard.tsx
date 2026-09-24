import Link from "next/link";
import { FileMusic, Guitar, Headphones } from "lucide-react";
import type { SongSummary } from "@/lib/types";
import { SEASON_STYLE, formatNumber } from "@/lib/liturgy";
import { label } from "@/lib/labels";
import { SeasonDot } from "@/components/ui/Chip";

function Highlight({ text, terms }: { text: string; terms: string[] }) {
  if (!terms.length) return <>{text}</>;
  const norm = text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const marks: [number, number][] = [];
  for (const t of terms) {
    let i = norm.indexOf(t);
    while (t && i >= 0) {
      marks.push([i, i + t.length]);
      i = norm.indexOf(t, i + t.length);
    }
  }
  if (!marks.length) return <>{text}</>;
  marks.sort((a, b) => a[0] - b[0]);
  const out: React.ReactNode[] = [];
  let pos = 0;
  marks.forEach(([s, e], k) => {
    if (s < pos) return;
    out.push(text.slice(pos, s), <mark key={k}>{text.slice(s, e)}</mark>);
    pos = e;
  });
  out.push(text.slice(pos));
  return <>{out}</>;
}

export function SongCard({
  song,
  terms = [],
  snippet,
  action,
}: {
  song: SongSummary;
  terms?: string[];
  snippet?: string;
  action?: React.ReactNode;
}) {
  const season = song.seasons[0];
  const tags = [...song.moments.map(label), ...song.years.map((y) => `Ano ${y}`), ...song.themes.map(label)];
  const res = [
    { on: song.has.cifra, Icon: Guitar, name: "Cifra" },
    { on: song.has.partitura, Icon: FileMusic, name: "Partitura" },
    { on: song.has.audio, Icon: Headphones, name: "Áudio" },
  ];
  return (
    <article className="group relative flex overflow-hidden rounded-[10px] border border-border bg-surface shadow-card transition hover:-translate-y-px hover:shadow-raised">
      <span aria-hidden className="w-1 shrink-0" style={{ background: season ? SEASON_STYLE[season].color : "var(--border)" }} />
      <div className="flex min-w-0 flex-1 items-start gap-3 p-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            {song.number != null && (
              <span className="font-serif text-lg font-bold leading-none text-gold-ink [font-variant-numeric:lining-nums]">
                {formatNumber(song.number)}
              </span>
            )}
            {song.key && <span className="rounded-full bg-surface-2 px-2 py-0.5 text-sm font-medium text-ink-muted">Tom {song.key}</span>}
          </div>
          <h3 className="font-serif text-xl font-semibold leading-tight text-ink">
            <Link href={`/cantos/${song.slug}`} className="after:absolute after:inset-0 hover:text-primary focus-visible:outline-none">
              <Highlight text={song.title} terms={terms} />
            </Link>
          </h3>
          {song.composer && <p className="mt-0.5 truncate text-sm text-ink-muted">{song.composer}</p>}
          {snippet && (
            <p className="mt-2 line-clamp-2 text-sm italic text-ink-muted">
              <Highlight text={snippet} terms={terms} />
            </p>
          )}
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            {song.seasons.map((s) => (
              <span key={s} className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium text-ink" style={{ background: SEASON_STYLE[s].soft }}>
                <SeasonDot season={s} /> {label(s)}
              </span>
            ))}
            {tags.slice(0, 3).map((t) => (
              <span key={t} className="rounded-full bg-surface-2 px-2 py-0.5 text-xs font-medium text-ink-muted">
                {t}
              </span>
            ))}
            {tags.length > 3 && <span className="text-xs text-ink-muted">+{tags.length - 3}</span>}
          </div>
        </div>
        <div className="relative z-10 flex flex-col items-end gap-3">
          <div className="flex gap-1.5">
            {res.map(({ on, Icon, name }) => (
              <span key={name} title={on ? name : `${name} indisponível`} aria-label={on ? name : `${name} indisponível`} className={on ? "text-primary" : "text-border"}>
                <Icon size={18} strokeWidth={1.75} />
              </span>
            ))}
          </div>
          {action}
        </div>
      </div>
    </article>
  );
}
