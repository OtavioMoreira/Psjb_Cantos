import type { NextConfig } from "next";
import { toTaxonomy, type ApiFlag } from "./src/lib/apiSongs";

// GITHUB_PAGES=true gera um export estático (pasta out/) servido em /<repo>.
const isPages = process.env.GITHUB_PAGES === "true";
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
// Endereço da API (apps/api), ex.: http://localhost:3333 ou https://psjb-api.vercel.app.
// Com ele, /api/* do site é repassado para a API: mesmo domínio, então o cookie do refresh é first-party.
const apiUrl = isPages ? "" : (process.env.API_URL ?? "").replace(/\/+$/, "");

/** Flags da API → taxonomia embutida no bundle (rótulos de momentos, tempos, anos e temas). */
async function taxonomyFromApi(): Promise<string | undefined> {
  if (!apiUrl) return undefined;
  try {
    const res = await fetch(`${apiUrl}/api/flags`);
    if (!res.ok) throw new Error(`status ${res.status}`);
    const { flags } = (await res.json()) as { flags: ApiFlag[] };
    return JSON.stringify(toTaxonomy(flags));
  } catch (err) {
    console.warn(`⚠ Não deu para ler as flags da API (${(err as Error).message}); usando data/categories.json.`);
    return undefined;
  }
}

export default async function config(): Promise<NextConfig> {
  const taxonomy = await taxonomyFromApi();
  return {
    ...(isPages && { output: "export", trailingSlash: true }),
    basePath: basePath || undefined,
    env: {
      NEXT_PUBLIC_USE_API: apiUrl ? "true" : "false",
      ...(taxonomy && { NEXT_PUBLIC_TAXONOMY: taxonomy }),
    },
    ...(apiUrl && {
      async rewrites() {
        return [{ source: "/api/:path*", destination: `${apiUrl}/api/:path*` }];
      },
    }),
    images: {
      // O otimizador de imagens precisa de servidor; no export estático fica desligado.
      unoptimized: isPages,
      formats: ["image/avif", "image/webp"],
    },
  };
}
