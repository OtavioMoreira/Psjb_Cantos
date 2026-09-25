import type { MetadataRoute } from "next";
import { BASE_PATH } from "@/lib/routes";

// Export estático (GitHub Pages).
export const dynamic = "force-static";

/** Instalado na tela de início, o site abre sem as barras do navegador (útil no Modo Missa). */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Cantos · Catedral São João Batista",
    short_name: "Cantos PSJB",
    description: "Repertório litúrgico com letra, cifra, partitura e áudio. Monte sua missa e cante com o tablet.",
    lang: "pt-BR",
    start_url: `${BASE_PATH}/`,
    scope: `${BASE_PATH}/`,
    display: "fullscreen",
    display_override: ["fullscreen", "standalone"],
    orientation: "any",
    background_color: "#FAF6EE",
    theme_color: "#1F3D2B",
    icons: [
      { src: `${BASE_PATH}/icon-192.png`, sizes: "192x192", type: "image/png" },
      { src: `${BASE_PATH}/icon-512.png`, sizes: "512x512", type: "image/png" },
      { src: `${BASE_PATH}/icon-512.png`, sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
