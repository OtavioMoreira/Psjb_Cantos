import Link from "next/link";
import { ArrowRight, BookOpen, Search, Tablet } from "lucide-react";
import { getSongSummaries, getTaxonomy } from "@/lib/data";
import { SEASON_STYLE, liturgicalSeason, liturgicalYear } from "@/lib/liturgy";
import { Divider, CornerFrame } from "@/components/ui/Ornament";
import { ButtonLink } from "@/components/ui/Button";
import { SongCard } from "@/components/song/SongCard";
import { BASE_PATH } from "@/lib/routes";

// Export estático: o "tempo atual" é recalculado a cada build (o deploy roda diariamente).

export default async function Home() {
  const [songs, tax] = await Promise.all([getSongSummaries(), getTaxonomy()]);
  const now = new Date();
  const season = liturgicalSeason(now);
  const year = liturgicalYear(now);
  const style = SEASON_STYLE[season];
  const seasonSongs = songs.filter((s) => s.seasons.includes(season)).slice(0, 4);
  const featured = songs.filter((s) => s.number != null).slice(-6).reverse();
  const quickMoments = ["entrada", "ato-penitencial", "gloria", "salmo", "ofertorio", "comunhao", "saida"];

  return (
    <>
      <section className="parchment border-b border-border">
        <div className="mx-auto max-w-[1440px] px-4 pb-14 pt-12 text-center sm:px-6 sm:pt-20 lg:px-8">
          <p className="font-sc text-lg tracking-[0.12em] text-gold-ink">Paróquia Catedral São João Batista</p>
          <h1 className="mt-2 font-serif text-[40px] font-semibold leading-[1.1] text-primary sm:text-[56px]">
            Cantos para a Liturgia
          </h1>
          <Divider className="my-5" />
          <p className="mx-auto max-w-xl text-lg text-ink-muted">
            O repertório da Catedral com letra, cifra, partitura e áudio. Monte a sua missa e cante com o tablet, sem papel.
          </p>
          <form action={`${BASE_PATH}/cantos`} role="search" className="relative mx-auto mt-8 max-w-2xl">
            <label htmlFor="busca-home" className="sr-only">
              Buscar cantos
            </label>
            <Search size={22} className="pointer-events-none absolute left-5 top-1/2 -translate-y-1/2 text-ink-muted" />
            <input
              id="busca-home"
              name="q"
              type="search"
              placeholder="Busque por título, número ou trecho da letra"
              className="h-14 w-full rounded-[16px] border border-border bg-surface pl-14 pr-32 text-lg shadow-raised outline-none placeholder:text-ink-muted focus:border-primary focus:ring-2 focus:ring-gold/50"
            />
            <button className="absolute right-2 top-1/2 h-10 -translate-y-1/2 rounded-[10px] bg-primary-solid px-5 font-semibold text-[#FFFDF8] hover:bg-primary-hover">
              Buscar
            </button>
          </form>
          <div className="mx-auto mt-5 flex max-w-2xl flex-wrap justify-center gap-2">
            {quickMoments.map((id) => (
              <Link
                key={id}
                href={`/cantos?momento=${id}`}
                className="rounded-full border border-border bg-surface px-4 py-2 text-sm font-medium text-ink transition hover:border-primary hover:text-primary"
              >
                {tax.moments.find((m) => m.id === id)?.label}
              </Link>
            ))}
            <Link href="/cantos" className="rounded-full px-4 py-2 text-sm font-semibold text-primary hover:underline">
              Todos os cantos →
            </Link>
          </div>
        </div>
      </section>

      <section className="border-b border-border" style={{ background: style.soft }}>
        <div className="mx-auto max-w-[1440px] px-4 py-10 sm:px-6 lg:px-10">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="flex items-center gap-4">
              <span className="h-12 w-1.5 rounded-full" style={{ background: style.color }} />
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.08em] text-ink-muted">Tempo atual</p>
                <h2 className="font-serif text-3xl font-semibold">
                  {style.label} · Ano {year}
                </h2>
              </div>
            </div>
            <Link href={`/cantos?tempo=${season}`} className="flex items-center gap-1 font-semibold text-primary hover:underline">
              Ver cantos do tempo <ArrowRight size={18} />
            </Link>
          </div>
          {seasonSongs.length > 0 && (
            <ul className="mt-6 grid grid-cols-1 gap-3 md:grid-cols-2">
              {seasonSongs.map((s) => (
                <li key={s.id}>
                  <SongCard song={s} />
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section className="mx-auto max-w-[1440px] px-4 py-12 sm:px-6 lg:px-10">
        <h2 className="font-serif text-3xl font-semibold">Navegue por tempo</h2>
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {tax.seasons.map((s) => (
            <Link
              key={s.id}
              href={`/cantos?tempo=${s.id}`}
              className="group flex h-[88px] flex-col justify-between rounded-[10px] border bg-surface p-4 shadow-card transition hover:-translate-y-px hover:shadow-raised"
              style={{ borderColor: SEASON_STYLE[s.id].color }}
            >
              <span className="h-3 w-3 rounded-full" style={{ background: SEASON_STYLE[s.id].color }} />
              <span className="font-serif text-xl font-semibold group-hover:text-primary">{s.label}</span>
            </Link>
          ))}
        </div>

        <div className="mt-12 grid gap-6 md:grid-cols-2">
          <div className="relative overflow-hidden rounded-[16px] border border-border bg-surface p-8 shadow-card">
            <CornerFrame />
            <Tablet className="text-gold" size={32} strokeWidth={1.5} />
            <h2 className="mt-4 font-serif text-3xl font-semibold text-primary">Monte sua Missa</h2>
            <p className="mt-2 max-w-md text-ink-muted">
              Escolha um canto para cada momento — das velas à saída — e use o Modo Missa no tablet: letra grande, troca de tom e
              navegação com um toque.
            </p>
            <ButtonLink href="/painel/missas/nova" className="mt-6">
              Começar agora <ArrowRight size={18} />
            </ButtonLink>
          </div>
          <div className="rounded-[16px] border border-border bg-surface p-8 shadow-card">
            <BookOpen className="text-gold" size={32} strokeWidth={1.5} />
            <h2 className="mt-4 font-serif text-3xl font-semibold text-primary">Salmos e Aclamações</h2>
            <p className="mt-2 text-ink-muted">Organizados pelo ano litúrgico. Estamos no Ano {year}.</p>
            <div className="mt-6 grid grid-cols-3 gap-3">
              {tax.years.map((y) => (
                <Link
                  key={y.id}
                  href={`/cantos?momento=salmo,aclamacao&ano=${y.id}`}
                  className={`flex h-20 flex-col items-center justify-center rounded-[10px] border font-serif transition hover:border-primary ${y.id === year ? "border-primary bg-primary-soft text-primary" : "border-border"}`}
                >
                  <span className="text-3xl font-semibold">{y.id}</span>
                  <span className="text-xs font-sans text-ink-muted">Ano {y.id}</span>
                </Link>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-14 flex items-end justify-between">
          <h2 className="font-serif text-3xl font-semibold">Do repertório</h2>
          <Link href="/cantos" className="font-semibold text-primary hover:underline">
            Ver todos
          </Link>
        </div>
        <ul className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
          {featured.map((s) => (
            <li key={s.id}>
              <SongCard song={s} />
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
