// PDF do roteiro da celebração: SEMPRE 1 página A4, no formato do folheto da paróquia.
// O jsPDF é carregado sob demanda. Para caber, a letra diminui aos poucos (até 6,5 pt).
import type { jsPDF as JsPDF } from "jspdf";
import type { Mass, MassScript, Song } from "./types";
import { parseRich, songRefs, type Run } from "./massScript";
import { BASE_PATH } from "./routes";

const PT = 0.3528; // mm por ponto
const PAGE = { w: 210, h: 297, margin: 12 };
const RED: [number, number, number] = [200, 16, 16];
const INK: [number, number, number] = [15, 15, 15];
const GREEN: [number, number, number] = [31, 61, 43];
const MAX_PT = 12.5;
const MIN_PT = 6.5;

// As fontes padrão do PDF usam WinAnsi: troca símbolos fora dessa tabela.
const CP1252_EXTRA = "€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ";
const clean = (t: string) => t.normalize("NFC").replace(/[^\u0000-ÿ]/g, (c) => (CP1252_EXTRA.includes(c) ? c : ""));

type Style = "normal" | "bold" | "bolditalic";
const styleOf = (r: Run): Style => (r.cue ? "bolditalic" : r.bold ? "bold" : "normal");

interface Seg {
  text: string;
  style: Style;
  red: boolean;
  /** Posição na linha, em mm. */
  x: number;
}

/** Quebra uma sequência de trechos com estilos em linhas de até `width` mm, só entre palavras. */
function wrap(doc: JsPDF, runs: Run[], size: number, width: number, firstIndent = 0): Seg[][] {
  const lines: Seg[][] = [[]];
  let x = firstIndent;
  const space = (st: Style) => doc.setFont("times", st).setFontSize(size).getTextWidth(" ");
  for (const r of runs) {
    const st = styleOf(r);
    const parts = clean(r.text).split(/(\s+)/);
    for (const part of parts) {
      if (!part) continue;
      if (/^\s+$/.test(part)) {
        if (x > 0) x += space(st);
        continue;
      }
      doc.setFont("times", st).setFontSize(size);
      const w = doc.getTextWidth(part);
      const line = lines[lines.length - 1];
      if (x + w > width && line.length) {
        lines.push([]);
        x = 0;
      }
      lines[lines.length - 1].push({ text: part, style: st, red: Boolean(r.cue), x });
      x += w;
    }
  }
  return lines;
}

async function logoDataUrl() {
  try {
    const blob = await (await fetch(`${BASE_PATH}/logo.png`)).blob();
    return await new Promise<string>((ok, fail) => {
      const fr = new FileReader();
      fr.onload = () => ok(fr.result as string);
      fr.onerror = fail;
      fr.readAsDataURL(blob);
    });
  } catch {
    return null; // sem o logo, o PDF sai assim mesmo
  }
}

/**
 * Desenha (ou só mede, com draw=false) o roteiro com a letra `size`. Devolve onde terminou,
 * para achar o maior tamanho que cabe em 1 página.
 */
function render(doc: JsPDF, script: MassScript, mass: Pick<Mass, "slots">, byId: Map<number, Song>, size: number, logo: string | null, draw: boolean) {
  const lh = size * PT * 1.28;
  const left = PAGE.margin;
  const right = PAGE.w - PAGE.margin;
  let y = PAGE.margin;
  const color = (c: readonly number[]) => doc.setTextColor(c[0], c[1], c[2]);

  const drawLines = (lines: Seg[][], x: number, firstX = x) => {
    lines.forEach((line, i) => {
      if (draw)
        // Palavras seguidas no mesmo estilo saem num texto só: o espaçamento fica o natural da fonte.
        for (let j = 0; j < line.length; ) {
          const s = line[j];
          let text = s.text;
          for (j++; j < line.length && line[j].style === s.style && line[j].red === s.red; j++) text += ` ${line[j].text}`;
          doc.setFont("times", s.style).setFontSize(size);
          color(s.red ? RED : INK);
          doc.text(text, (i === 0 ? firstX : x) + s.x, y + size * PT * 0.95);
        }
      y += lh;
    });
  };

  // Título numa moldura traço-ponto, como no folheto.
  const titleSize = size + 1.5;
  doc.setFont("times", "bold").setFontSize(titleSize);
  const titleLines = doc.splitTextToSize(clean(script.title || "Roteiro da celebração"), right - left - 8) as string[];
  const titleH = titleLines.length * titleSize * PT * 1.25 + 4;
  if (draw) {
    doc.setLineWidth(0.6).setDrawColor(0, 0, 0).setLineDashPattern([3, 1.2, 0.6, 1.2], 0);
    doc.rect(left, y, right - left, titleH);
    color(INK);
    titleLines.forEach((t, i) => doc.text(t, PAGE.w / 2, y + 2 + titleSize * PT * (0.95 + i * 1.25), { align: "center" }));
  }
  y += titleH + 2.5;

  // Lembretes (moldura tracejada) à esquerda e o logo à direita.
  const logoW = 40;
  const logoH = (logoW * 345) / 723;
  const notesW = right - left - logoW - 6;
  const noteRuns: Run[][] = (script.notes || "").split("\n").filter((l) => l.trim()).map(parseRich);
  const noteLines = noteRuns.flatMap((runs, i) => wrap(doc, i === 0 ? [{ text: "Lembretes importantes: ", bold: true }, ...runs] : runs, size, notesW - 6));
  const notesH = noteLines.length ? noteLines.length * lh + 3 : 0;
  const top = y;
  if (notesH) {
    if (draw) {
      doc.setLineWidth(0.25).setLineDashPattern([1.2, 0.8], 0);
      doc.roundedRect(left, y, notesW, notesH, 2, 2);
    }
    y += 1.5;
    drawLines(noteLines, left + 3);
  }
  if (draw && logo) doc.addImage(logo, "PNG", right - logoW, top - 1, logoW, logoH, "logo", "FAST");
  y = Math.max(top + notesH, top + (logo ? logoH - 1 : 0)) + 2.5;

  // Itens numerados.
  const numW = doc.setFont("times", "bold").setFontSize(size).getTextWidth("00. ");
  const x0 = left + 3;
  const xt = x0 + numW;
  const width = right - xt - 1;
  script.items.forEach((item, idx) => {
    const head: Run = { text: `${item.title.trim()}${item.kind === "cantos" || item.text.trim() ? ":" : "."} `, bold: true };
    const paragraphs = item.text.split("\n").filter((l) => l.trim());
    const refs = item.kind === "cantos" ? songRefs(item, mass, byId) : "";
    const first: Run[] = [head];
    if (refs) first.push({ text: `${refs} ` });
    if (item.kind === "cantos" && !refs && !paragraphs.length) first.push({ text: "LIVRE", cue: false });

    if (item.boxed) {
      // Título em linha própria e o texto dentro da moldura (motivação, preces...).
      const body = paragraphs.flatMap((p) => wrap(doc, parseRich(p), size, right - left - 8));
      const boxTop = y;
      const headLines = wrap(doc, first, size, width);
      const h = headLines.length * lh + body.length * lh + 2.5;
      if (draw) {
        doc.setLineWidth(0.3).setLineDashPattern([], 0).setDrawColor(0, 0, 0);
        doc.roundedRect(left, boxTop, right - left, h, 3, 3);
        doc.setFont("times", "bold").setFontSize(size);
        color(INK);
        doc.text(`${idx + 1}.`, x0, y + 1 + size * PT * 0.95);
      }
      y += 1;
      drawLines(headLines, xt);
      drawLines(body, left + 4);
      y = boxTop + h + 1.5;
      return;
    }

    const inline = [...first, ...(paragraphs[0] ? parseRich(paragraphs[0]) : [])];
    if (draw) {
      doc.setFont("times", "bold").setFontSize(size);
      color(INK);
      doc.text(`${idx + 1}.`, x0, y + size * PT * 0.95);
    }
    drawLines(wrap(doc, inline, size, width), xt);
    for (const p of paragraphs.slice(1)) drawLines(wrap(doc, parseRich(p), size, width), xt);
    y += lh * 0.12;
  });

  if (draw) {
    doc.setFont("helvetica", "normal").setFontSize(6.5);
    color(GREEN);
    doc.text("Cantos PSJB · Paróquia Catedral São João Batista", PAGE.w / 2, PAGE.h - 5, { align: "center" });
  }
  return y;
}

/** Maior tamanho de letra (em passos de 0,25 pt) com que o roteiro cabe em 1 página. */
function fitSize(doc: JsPDF, script: MassScript, mass: Pick<Mass, "slots">, byId: Map<number, Song>, logo: string | null) {
  const limit = PAGE.h - PAGE.margin - 4;
  for (let s = MAX_PT; s >= MIN_PT; s -= 0.25) if (render(doc, script, mass, byId, s, logo, false) <= limit) return { size: s, fits: true };
  return { size: MIN_PT, fits: false };
}

export function scriptFileName(script: MassScript, date: string) {
  const base = (script.title || "roteiro")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
  return `roteiro-${base}${date && !base.includes(date.slice(0, 4)) ? `-${date}` : ""}.pdf`;
}

/** Monta o PDF (sem baixar). `fits: false` = mesmo na letra mínima passou de 1 página (texto longo demais). */
export async function buildScriptPdf(mass: Pick<Mass, "slots">, script: MassScript, byId: Map<number, Song>, logo: string | null) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const { size, fits } = fitSize(doc, script, mass, byId, logo);
  render(doc, script, mass, byId, size, logo, true);
  return { doc, fits, size };
}

export async function downloadScriptPdf(mass: Pick<Mass, "slots" | "date">, script: MassScript, byId: Map<number, Song>) {
  const { doc, fits, size } = await buildScriptPdf(mass, script, byId, await logoDataUrl());
  doc.save(scriptFileName(script, mass.date));
  return { fits, size };
}
