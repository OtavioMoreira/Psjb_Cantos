import { BASE_PATH } from "./routes";

// Endereço público do site, para sitemap, robots e dados estruturados (só no build/servidor).
// A demonstração do GitHub Pages não deve ser indexada: os buscadores mostrariam a cópia.
export const IS_DEMO = process.env.GITHUB_PAGES === "true";

const origin = (process.env.SITE_URL ?? (IS_DEMO ? "https://otaviomoreira.github.io" : "https://cantos.psjb.org.br")).replace(/\/+$/, "");

/** URL absoluta de um caminho interno (com o basePath). */
export const siteUrl = (path = "/") => `${origin}${BASE_PATH}${path === "/" ? "/" : path}`;
