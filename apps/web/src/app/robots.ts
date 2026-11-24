import type { MetadataRoute } from "next";
import { BASE_PATH } from "@/lib/routes";
import { IS_DEMO, siteUrl } from "@/lib/site";

export const dynamic = "force-static";

/** O repertório é público; área logada, Modo Missa, links de e-mail e a API ficam fora dos buscadores. */
export default function robots(): MetadataRoute.Robots {
  if (IS_DEMO) return { rules: { userAgent: "*", disallow: "/" } };
  const p = (path: string) => `${BASE_PATH}${path}`;
  return {
    rules: {
      userAgent: "*",
      allow: p("/"),
      disallow: ["/painel", "/missa", "/entrar", "/convite", "/confirmar-email", "/recuperar-senha", "/redefinir-senha", "/dados/", "/api/"].map(p),
    },
    sitemap: siteUrl("/sitemap.xml"),
  };
}
