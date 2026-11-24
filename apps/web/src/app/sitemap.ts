import type { MetadataRoute } from "next";
import { getSongs } from "@/lib/data";
import { IS_DEMO, siteUrl } from "@/lib/site";

// Gerado no build, como as páginas dos cantos: um canto novo entra no "Publicar no site".
export const dynamic = "force-static";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  if (IS_DEMO) return [];
  const songs = await getSongs();
  return [
    { url: siteUrl("/"), changeFrequency: "daily", priority: 1 },
    { url: siteUrl("/cantos"), changeFrequency: "weekly", priority: 0.9 },
    { url: siteUrl("/sobre"), changeFrequency: "yearly", priority: 0.3 },
    ...songs.map((s) => ({ url: siteUrl(`/cantos/${s.slug}`), changeFrequency: "monthly" as const, priority: 0.7 })),
  ];
}
