import type { ExternalPsalm, PsalmSource } from "../interfaces/index.js";

// Identificação honesta: o robots.txt do site bloqueia robôs de IA e libera os demais.
const USER_AGENT = "CantosPSJB/1.0 (rotina semanal da Paroquia Catedral Sao Joao Batista)";
const MAX_FILE_BYTES = 25 * 1024 * 1024;

const decode = (s: string) =>
  s.replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").trim();

/**
 * Lê a lista "Próximos Salmos e Aclamações" (https://www.diocesemontenegro.org.br/salmos-e-aclamacoes).
 * Cada item tem título (<h3>), data (dd/mm/aaaa), áudio (<audio src>) e o PDF da partitura.
 */
export function parseDioceseListing(html: string): ExternalPsalm[] {
  const items: ExternalPsalm[] = [];
  const re = /<h3[^>]*>([^<]+)<\/h3>\s*<p[^>]*>\s*(\d{2})\/(\d{2})\/(\d{4})\s*<\/p>([\s\S]*?)(?=<h3[^>]*>|$)/g;
  for (const m of html.matchAll(re)) {
    const [, title, dd, mm, yyyy, rest] = m;
    const pdf = rest.match(/href="(https:\/\/[^"]+\.pdf)"/i)?.[1] ?? null;
    const audio = rest.match(/<audio[^>]*\ssrc="(https:\/\/[^"]+)"/i)?.[1] ?? null;
    const date = `${yyyy}-${mm}-${dd}`;
    // O código do arquivo (DocumentAssets/<n>) é estável; o mesmo PDF pode voltar com outro código.
    const asset = (pdf ?? audio ?? "").match(/DocumentAssets\/(\d+)\//)?.[1] ?? decode(title).slice(0, 80);
    items.push({ externalId: `${asset}@${date}`, title: decode(title), date, pdfUrl: pdf && decode(pdf), audioUrl: audio && decode(audio) });
  }
  return items;
}

export class DioceseMontenegroSource implements PsalmSource {
  readonly id = "diocese-montenegro";
  readonly name = "Diocese de Montenegro";
  constructor(readonly url = "https://www.diocesemontenegro.org.br/salmos-e-aclamacoes") {}

  async listUpcoming() {
    const res = await fetch(this.url, { headers: { "User-Agent": USER_AGENT }, signal: AbortSignal.timeout(30_000) });
    if (!res.ok) throw new Error(`A página de salmos respondeu ${res.status}.`);
    return parseDioceseListing(await res.text());
  }

  async download(url: string) {
    if (!/^https:\/\//.test(url)) throw new Error("Link de arquivo inválido.");
    const res = await fetch(url, { headers: { "User-Agent": USER_AGENT }, signal: AbortSignal.timeout(60_000) });
    if (!res.ok) throw new Error(`O arquivo respondeu ${res.status}.`);
    const data = Buffer.from(await res.arrayBuffer());
    if (data.length > MAX_FILE_BYTES) throw new Error("Arquivo grande demais.");
    return data;
  }
}
