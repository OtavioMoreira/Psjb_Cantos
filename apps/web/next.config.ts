import type { NextConfig } from "next";

// GITHUB_PAGES=true gera um export estático (pasta out/) servido em /<repo>.
const isPages = process.env.GITHUB_PAGES === "true";
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
// Endereço da API (apps/api), ex.: http://localhost:3333 ou https://psjb-api.vercel.app.
// Com ele, /api/* do site é repassado para a API: mesmo domínio, então o cookie do refresh é first-party.
const apiUrl = isPages ? "" : (process.env.API_URL ?? "").replace(/\/+$/, "");

const nextConfig: NextConfig = {
  ...(isPages && { output: "export", trailingSlash: true }),
  basePath: basePath || undefined,
  env: { NEXT_PUBLIC_USE_API: apiUrl ? "true" : "false" },
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

export default nextConfig;
