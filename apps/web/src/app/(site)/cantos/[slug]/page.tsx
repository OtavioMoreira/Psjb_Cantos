import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ArrowLeft, Download, FileMusic, Guitar, Headphones } from "lucide-react";
import { getSongBySlug, getSongs } from "@/lib/data";
import { formatNumber } from "@/lib/liturgy";
import { label } from "@/lib/labels";
import { Tag } from "@/components/ui/Chip";
import { Divider } from "@/components/ui/Ornament";
import { SongViewer } from "@/components/song/SongViewer";
import { AddToMass } from "@/components/mass/AddToMass";

// Todas as páginas de canto são geradas estaticamente no build (SSG).
export async function generateStaticParams() {
  const songs = await getSongs();
  return songs.map((s) => ({ slug: s.slug }));
}
export const dynamicParams = false;

export async function generateMetadata(props: PageProps<"/cantos/[slug]">): Promise<Metadata> {
  const { slug } = await props.params;
  const song = await getSongBySlug(slug);
  if (!song) return {};
  return {
    title: song.title,
    description: `${song.title}${song.composer ? ` — ${song.composer}` : ""}. Letra, cifra, partitura e áudio.`,
  };
}

export default async function SongPage(props: PageProps<"/cantos/[slug]">) {
  const { slug } = await props.params;
  const song = await getSongBySlug(slug);
  if (!song) notFound();

  const downloads = [
    { href: song.media.cifraPdf, label: "Cifra (PDF)", Icon: Guitar },
    { href: song.media.partituraPdf, label: "Partitura (PDF)", Icon: FileMusic },
    { href: song.media.audio, label: "Áudio (MP3)", Icon: Headphones },
  ].filter((d) => d.href);

  return (
    <div className="mx-auto max-w-[1440px] px-4 py-6 sm:px-6 lg:px-10">
      <Link href="/cantos" className="-ml-2 inline-flex min-h-11 items-center gap-1.5 rounded-md px-2 text-sm font-medium text-ink-muted hover:text-primary">
        <ArrowLeft size={16} /> Voltar aos cantos
      </Link>

      <header className="mt-6">
        {song.number != null && (
          <p className="font-serif text-lg font-semibold text-gold-ink [font-variant-numeric:lining-nums]">{formatNumber(song.number)}</p>
        )}
        <h1 className="font-serif text-[32px] font-semibold leading-tight text-primary sm:text-[44px]">{song.title}</h1>
        {song.composer && <p className="mt-1 text-ink-muted">{song.composer}</p>}
        <div className="mt-4 flex flex-wrap gap-2">
          {song.moments.map((m) => (
            <Tag key={m} href={`/cantos?momento=${m}`}>
              {label(m)}
            </Tag>
          ))}
          {song.seasons.map((s) => (
            <Tag key={s} href={`/cantos?tempo=${s}`} season={s}>
              {label(s)}
            </Tag>
          ))}
          {song.years.map((y) => (
            <Tag key={y} href={`/cantos?ano=${y}`}>
              Ano {y}
            </Tag>
          ))}
          {song.themes.map((t) => (
            <Tag key={t} href={`/cantos?tema=${t}`}>
              {label(t)}
            </Tag>
          ))}
        </div>
        <Divider align="left" className="my-6 [&>span:first-child]:hidden" />
        <div className="flex flex-wrap items-center gap-3">
          <AddToMass songId={song.id} moments={song.moments} title={song.title} />
        </div>
      </header>

      <div className="mt-8 lg:grid lg:grid-cols-[1fr_300px] lg:gap-10">
        <Suspense>
          <SongViewer song={song} />
        </Suspense>
        <aside className="mt-10 space-y-6 lg:mt-0">
          <div className="rounded-[16px] border border-border bg-surface p-5 shadow-card lg:sticky lg:top-[96px]">
            <h2 className="text-xs font-semibold uppercase tracking-[0.08em] text-ink-muted">Detalhes</h2>
            <dl className="mt-3 space-y-2 text-sm">
              {song.key && (
                <div className="flex justify-between">
                  <dt className="text-ink-muted">Tom original</dt>
                  <dd className="font-semibold">{song.key}</dd>
                </div>
              )}
              {song.composer && (
                <div className="flex justify-between gap-4">
                  <dt className="text-ink-muted">Autoria</dt>
                  <dd className="text-right font-semibold">{song.composer}</dd>
                </div>
              )}
            </dl>
            {downloads.length > 0 && (
              <>
                <h2 className="mt-6 text-xs font-semibold uppercase tracking-[0.08em] text-ink-muted">Downloads</h2>
                <ul className="mt-2 space-y-1">
                  {downloads.map(({ href, label, Icon }) => (
                    <li key={label}>
                      <a href={href!} target="_blank" rel="noopener" className="flex items-center gap-3 rounded-md px-2 py-2 text-sm font-medium hover:bg-primary-soft hover:text-primary">
                        <Icon size={18} className="text-gold" /> {label}
                        <Download size={14} className="ml-auto text-ink-muted" />
                      </a>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
