import categories from "@data/categories.json";
import type { Taxonomy } from "./types";

// Taxonomia é pequena e estável: pode ir para o bundle do cliente.
export const taxonomy = categories as Taxonomy;

export const LABELS: Record<string, string> = Object.fromEntries(
  [...taxonomy.moments, ...taxonomy.seasons, ...taxonomy.years, ...taxonomy.themes].map((c) => [c.id, c.label]),
);

export const label = (id: string) => LABELS[id] ?? id;
