import type { PdfReader } from "../interfaces/index.js";

/**
 * Texto do PDF por linha visual: agrupa os pedaços de texto pela altura (y) e os ordena da esquerda
 * para a direita. Usa o unpdf (pdf.js para ambientes sem navegador), carregado só quando precisa.
 */
export class UnpdfReader implements PdfReader {
  async lines(pdf: Buffer) {
    const { getDocumentProxy } = await import("unpdf");
    const doc = await getDocumentProxy(new Uint8Array(pdf));
    const out: string[] = [];
    for (let p = 1; p <= doc.numPages; p++) {
      const { items } = await (await doc.getPage(p)).getTextContent();
      const rows: { y: number; parts: { x: number; s: string; w: number }[] }[] = [];
      for (const it of items as { str?: string; transform: number[]; width: number }[]) {
        if (!it.str?.trim()) continue;
        const y = Math.round(it.transform[5]);
        let row = rows.find((r) => Math.abs(r.y - y) <= 2);
        if (!row) rows.push((row = { y, parts: [] }));
        row.parts.push({ x: it.transform[4], s: it.str, w: it.width });
      }
      rows.sort((a, b) => b.y - a.y);
      for (const row of rows) {
        row.parts.sort((a, b) => a.x - b.x);
        let text = "";
        let end: number | null = null;
        for (const part of row.parts) {
          if (end !== null && part.x - end > 1.5) text += " ";
          text += part.s;
          end = part.x + part.w;
        }
        out.push(text);
      }
    }
    await doc.cleanup?.();
    return out;
  }
}
