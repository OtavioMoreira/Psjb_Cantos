// Rotas com ID usam query string (?id=) para o site funcionar como export estático (GitHub Pages).

/** Prefixo do site quando publicado em subpasta (ex.: /Psjb_Cantos no GitHub Pages). */
export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export const massEditUrl = (id: string) => `/painel/missas/editar?id=${encodeURIComponent(id)}`;
export const massModeUrl = (id: string) => `/missa?id=${encodeURIComponent(id)}`;
