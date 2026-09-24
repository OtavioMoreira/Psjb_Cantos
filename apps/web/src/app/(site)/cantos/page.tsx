import type { Metadata } from "next";
import { Suspense } from "react";
import { getSongSummaries } from "@/lib/data";
import { SongBrowser } from "@/components/song/SongBrowser";

export const metadata: Metadata = {
  title: "Cantos",
  description: "Busque cantos por título, número ou letra e filtre por momento da missa, tempo litúrgico, ano e tema.",
};

export default async function CantosPage() {
  const songs = await getSongSummaries();
  return (
    <div className="mx-auto max-w-[1440px] px-4 py-8 sm:px-6 lg:px-10">
      <h1 className="mb-4 font-serif text-[32px] font-semibold leading-tight text-primary sm:text-[40px]">Cantos</h1>
      <Suspense fallback={<ListSkeleton />}>
        <SongBrowser songs={songs} />
      </Suspense>
    </div>
  );
}

function ListSkeleton() {
  return (
    <div className="space-y-3" aria-busy="true" aria-label="Carregando cantos">
      <div className="h-12 animate-pulse rounded-[10px] bg-surface-2" />
      {Array.from({ length: 6 }, (_, i) => (
        <div key={i} className="h-28 animate-pulse rounded-[10px] bg-surface-2" />
      ))}
    </div>
  );
}
