import type { NextConfig } from "next";

// GITHUB_PAGES=true gera um export estático (pasta out/) servido em /<repo>.
const isPages = process.env.GITHUB_PAGES === "true";
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

const nextConfig: NextConfig = {
  ...(isPages && { output: "export", trailingSlash: true }),
  basePath: basePath || undefined,
  images: {
    // O otimizador de imagens precisa de servidor; no export estático fica desligado.
    unoptimized: isPages,
    formats: ["image/avif", "image/webp"],
  },
};

export default nextConfig;
