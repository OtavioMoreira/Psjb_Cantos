/** "Tempo Comum" → "tempo-comum" (sem acento, minúsculo, hífens). Mesma regra dos slugs da API. */
export function slugify(text: string, keepCase = false) {
  const base = text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return keepCase ? base : base.toLowerCase();
}
