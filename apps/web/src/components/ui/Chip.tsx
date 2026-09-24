import Link from "next/link";
import type { SeasonId } from "@/lib/types";
import { SEASON_STYLE } from "@/lib/liturgy";

export function SeasonDot({ season, size = 8 }: { season: SeasonId; size?: number }) {
  return (
    <span
      aria-hidden
      className="inline-block shrink-0 rounded-full"
      style={{ width: size, height: size, background: SEASON_STYLE[season].color }}
    />
  );
}

export function Tag({
  href,
  children,
  season,
}: {
  href?: string;
  children: React.ReactNode;
  season?: SeasonId;
}) {
  const cls =
    "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium text-ink-muted transition-colors";
  const style = season
    ? { borderColor: SEASON_STYLE[season].color, background: SEASON_STYLE[season].soft }
    : undefined;
  const content = (
    <>
      {season && <SeasonDot season={season} />}
      {children}
    </>
  );
  return href ? (
    <Link href={href} className={`${cls} border-border hover:border-primary hover:text-primary`} style={style}>
      {content}
    </Link>
  ) : (
    <span className={`${cls} border-border`} style={style}>
      {content}
    </span>
  );
}
