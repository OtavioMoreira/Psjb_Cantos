// Gera o PDF da missa no navegador (o site é estático, não há servidor).
// O jsPDF é carregado sob demanda, só quando a pessoa pede o PDF.
import type { Mass, Song } from "./types";
import { keyLabel, transposeChord, transposeLine } from "./chords";
import { chordRow, toBlocks, type Word } from "./sheet";
import { SEASON_STYLE, formatDateLong, formatNumber } from "./liturgy";

export interface MassPdfOptions {
  /** true = letra com cifra; false = só a letra. */
  chords: boolean;
  size: "P" | "M" | "G";
  /** Cada canto começa em uma página nova. */
  pagePerSong: boolean;
  preferFlats: boolean;
}

const FONT_PT = { P: 10, M: 12, G: 14 } as const;
const PT = 0.3528; // mm por ponto
const PAGE = { w: 210, h: 297, margin: 16, top: 18, bottom: 20 };
const COLOR = { ink: [20, 20, 20], muted: [91, 97, 89], chord: [31, 61, 43], gold: [122, 94, 34], line: [200, 188, 160] } as const;

// As fontes padrão do PDF usam WinAnsi: troca símbolos fora dessa tabela.
const CP1252_EXTRA = "€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ";
function clean(text: string) {
  return text
    .normalize("NFC")
    .replace(/♯/g, "#")
    .replace(/♭/g, "b")
    .replace(/[^\u0000-ÿ]/g, (c) => (CP1252_EXTRA.includes(c) ? c : ""));
}

function slug(s: string) {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/** Quebra um par acordes+letra em linhas de até `max` caracteres, só entre palavras. */
function wrapPair(words: Word[], max: number, t: (c: string) => string) {
  const lines: { chords: string; lyric: string }[] = [];
  let chords = "";
  let lyric = "";
  const flush = () => {
    if (lyric.trim() || chords.trim()) lines.push({ chords: chords.trimEnd(), lyric: lyric.trimEnd() });
    chords = "";
    lyric = "";
  };
  for (const w of words) {
    const row = chordRow(w.chords, t);
    // A "coluna" da palavra tem a largura do maior entre texto e acordes (igual à tela).
    let text = w.text;
    if (row.length >= text.trimEnd().length && row) text = text.trimEnd().padEnd(row.length + 1, " ");
    if (lyric.length && lyric.trimEnd().length + text.trimEnd().length > max) flush();
    const at = lyric.length;
    if (row) chords = chords.padEnd(chords.length ? Math.max(at, chords.length + 1) : at, " ") + row;
    lyric += text;
  }
  flush();
  return lines;
}

export async function generateMassPdf(mass: Mass, songsById: Map<number, Song>, opts: MassPdfOptions) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const size = FONT_PT[opts.size];
  const lineH = size * PT * 1.28;
  const width = PAGE.w - PAGE.margin * 2;
  const maxChars = Math.floor(width / (size * 0.6 * PT)); // Courier: 0,6 em por caractere
  const t = (c: string, semis: number) => transposeChord(c, semis, opts.preferFlats);
  let y = PAGE.top;

  const color = (c: readonly number[]) => doc.setTextColor(c[0], c[1], c[2]);
  const ensure = (h: number) => {
    if (y + h > PAGE.h - PAGE.bottom) {
      doc.addPage();
      y = PAGE.top;
      return true;
    }
    return false;
  };

  const items = mass.slots.flatMap((slot) =>
    slot.items.map((item) => ({ slot, item, song: songsById.get(item.songId) })).filter((x) => x.song),
  ) as { slot: Mass["slots"][number]; item: Mass["slots"][number]["items"][number]; song: Song }[];

  /* ---------- Capa e roteiro ---------- */
  color(COLOR.gold);
  doc.setFont("times", "bold").setFontSize(10);
  doc.text(clean("PARÓQUIA CATEDRAL SÃO JOÃO BATISTA"), PAGE.w / 2, y, { align: "center", charSpace: 0.6 });
  y += 12;
  color(COLOR.ink);
  doc.setFont("times", "bold").setFontSize(24);
  for (const l of doc.splitTextToSize(clean(mass.name || "Missa"), width)) {
    doc.text(l, PAGE.w / 2, y, { align: "center" });
    y += 9;
  }
  color(COLOR.muted);
  doc.setFont("helvetica", "normal").setFontSize(11);
  const when = [formatDateLong(mass.date), mass.time ? mass.time.replace(":00", "h").replace(":", "h") : ""].filter(Boolean).join(" · ");
  const liturgy = [mass.season ? SEASON_STYLE[mass.season].label : "", mass.year ? `Ano ${mass.year}` : ""].filter(Boolean).join(" · ");
  if (when) {
    doc.text(clean(when), PAGE.w / 2, y, { align: "center" });
    y += 6;
  }
  if (liturgy) {
    doc.text(clean(liturgy), PAGE.w / 2, y, { align: "center" });
    y += 6;
  }
  doc.setDrawColor(COLOR.line[0], COLOR.line[1], COLOR.line[2]).setLineWidth(0.3);
  doc.line(PAGE.w / 2 - 30, y + 2, PAGE.w / 2 + 30, y + 2);
  y += 12;

  color(COLOR.ink);
  doc.setFont("times", "bold").setFontSize(15);
  doc.text("Roteiro", PAGE.margin, y);
  y += 8;
  // As páginas de cada canto só são conhecidas depois; guardamos onde escrever.
  const indexRows: { page: number; y: number }[] = [];
  items.forEach(({ slot, song }, i) => {
    ensure(8);
    doc.setFont("helvetica", "bold").setFontSize(8.5);
    color(COLOR.gold);
    doc.text(clean(`${i + 1}. ${slot.label.toUpperCase()}`), PAGE.margin, y);
    doc.setFont("helvetica", "normal").setFontSize(11);
    color(COLOR.ink);
    const title = clean(`${song.title}${song.number != null ? `  (${formatNumber(song.number)})` : ""}`);
    doc.text(doc.splitTextToSize(title, width - 60)[0], PAGE.margin + 48, y);
    indexRows.push({ page: doc.getNumberOfPages(), y });
    y += 7;
  });
  if (items.length === 0) {
    color(COLOR.muted);
    doc.setFont("helvetica", "italic").setFontSize(11);
    doc.text("Nenhum canto escolhido ainda.", PAGE.margin, y);
  }

  /* ---------- Cantos ---------- */
  const songPages: number[] = [];
  items.forEach(({ slot, item, song }, i) => {
    if (i === 0 || opts.pagePerSong) {
      doc.addPage();
      y = PAGE.top;
    } else {
      y += lineH * 1.6;
      ensure(28 + lineH * 4);
    }
    songPages.push(doc.getNumberOfPages());

    doc.setFont("helvetica", "bold").setFontSize(9);
    color(COLOR.gold);
    doc.text(clean(`${slot.label.toUpperCase()}  ·  ${i + 1}/${items.length}`), PAGE.margin, y, { charSpace: 0.3 });
    y += 7;
    doc.setFont("times", "bold").setFontSize(18);
    color(COLOR.ink);
    for (const l of doc.splitTextToSize(clean(song.title), width)) {
      doc.text(l, PAGE.margin, y);
      y += 7;
    }
    const meta = [
      formatNumber(song.number),
      song.composer,
      opts.chords && song.key
        ? `Tom: ${keyLabel(song.key, item.transpose)}${item.transpose ? ` (original ${song.key})` : ""}`
        : null,
    ].filter(Boolean);
    if (meta.length) {
      doc.setFont("helvetica", "normal").setFontSize(9.5);
      color(COLOR.muted);
      doc.text(clean(meta.join("  ·  ")), PAGE.margin, y);
      y += 4;
    }
    doc.setDrawColor(COLOR.line[0], COLOR.line[1], COLOR.line[2]).line(PAGE.margin, y, PAGE.w - PAGE.margin, y);
    y += lineH * 1.3;

    const blocks = toBlocks(song.lyrics);
    if (!song.lyrics.trim()) {
      doc.setFont("helvetica", "italic").setFontSize(size);
      color(COLOR.muted);
      doc.text("Letra ainda não cadastrada para este canto.", PAGE.margin, y);
      y += lineH;
      return;
    }

    for (const b of blocks) {
      if (b.type === "blank") {
        y += lineH * 0.55;
        continue;
      }
      if (!opts.chords) {
        if (b.type === "chords") continue;
        const text = b.type === "pair" ? b.words.map((w) => w.text).join("").trim() : b.text.trim();
        doc.setFont("helvetica", b.chorus ? "bold" : "normal").setFontSize(size + 1);
        for (const l of doc.splitTextToSize(clean(text), width)) {
          ensure(lineH);
          color(COLOR.ink);
          doc.text(l, PAGE.margin, y);
          y += lineH * 1.05;
        }
        continue;
      }
      doc.setFontSize(size);
      if (b.type === "chords") {
        const line = transposeLine(b.text, item.transpose, opts.preferFlats);
        for (let s = 0; s < line.length; s += maxChars) {
          ensure(lineH);
          doc.setFont("courier", "bold");
          color(COLOR.chord);
          doc.text(clean(line.slice(s, s + maxChars)), PAGE.margin, y);
          y += lineH;
        }
        continue;
      }
      if (b.type === "lyric") {
        doc.setFont("courier", b.chorus ? "bold" : "normal");
        for (const l of doc.splitTextToSize(clean(b.text), width)) {
          ensure(lineH);
          color(COLOR.ink);
          doc.text(l, PAGE.margin, y);
          y += lineH;
        }
        continue;
      }
      for (const l of wrapPair(b.words, maxChars, (c) => t(c, item.transpose))) {
        // Acorde e letra nunca ficam em páginas diferentes.
        ensure(lineH * (l.chords ? 2 : 1));
        if (l.chords) {
          doc.setFont("courier", "bold");
          color(COLOR.chord);
          doc.text(clean(l.chords), PAGE.margin, y);
          y += lineH;
        }
        doc.setFont("courier", b.chorus ? "bold" : "normal");
        color(COLOR.ink);
        doc.text(clean(l.lyric), PAGE.margin, y);
        y += lineH * 1.15;
      }
    }
  });

  /* ---------- Números de página no roteiro e rodapé ---------- */
  doc.setFont("helvetica", "normal").setFontSize(11);
  indexRows.forEach((r, i) => {
    doc.setPage(r.page);
    color(COLOR.muted);
    doc.text(`p. ${songPages[i]}`, PAGE.w - PAGE.margin, r.y, { align: "right" });
  });
  const total = doc.getNumberOfPages();
  const footer = clean(`${mass.name || "Missa"}${mass.date ? `  ·  ${mass.date.split("-").reverse().join("/")}` : ""}`);
  for (let p = 1; p <= total; p++) {
    doc.setPage(p);
    doc.setDrawColor(COLOR.line[0], COLOR.line[1], COLOR.line[2]).line(PAGE.margin, PAGE.h - 13, PAGE.w - PAGE.margin, PAGE.h - 13);
    doc.setFont("helvetica", "normal").setFontSize(8.5);
    color(COLOR.muted);
    doc.text(footer, PAGE.margin, PAGE.h - 8.5);
    doc.text(`${p} / ${total}`, PAGE.w - PAGE.margin, PAGE.h - 8.5, { align: "right" });
  }

  const filename = `missa-${slug(mass.name || "missa")}${mass.date ? `-${mass.date}` : ""}.pdf`;
  doc.save(filename);
  return filename;
}
