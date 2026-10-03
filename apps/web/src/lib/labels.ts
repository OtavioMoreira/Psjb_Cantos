import categories from "@data/categories.json";
import type { Taxonomy } from "./types";

// Taxonomia é pequena e estável: pode ir para o bundle do cliente.
// Com API_URL, o next.config busca as flags da API no build e injeta aqui (NEXT_PUBLIC_TAXONOMY);
// sem ela, vem do data/categories.json.
const fromBuild = process.env.NEXT_PUBLIC_TAXONOMY;
export const taxonomy = (fromBuild ? JSON.parse(fromBuild) : categories) as Taxonomy;

export const LABELS: Record<string, string> = Object.fromEntries(
  [...taxonomy.moments, ...taxonomy.seasons, ...taxonomy.years, ...taxonomy.themes].map((c) => [c.id, c.label]),
);

export const label = (id: string) => LABELS[id] ?? id;
