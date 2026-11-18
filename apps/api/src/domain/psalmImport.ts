// Regras puras da importação de salmos e aclamações (skill de regras de negócio §2, "Importação").

export type PsalmKind = "salmo" | "aclamacao";
export type Season = "advento" | "natal" | "quaresma" | "pascoa" | "tempo-comum";
export type YearLetter = "A" | "B" | "C";

/** Minúsculas, sem acento e só letras/números separados por um espaço. */
export function normalize(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9º°]+/g, " ")
    .trim();
}

// Festas e solenidades: a ordem importa ("vigília pascal" antes de "páscoa"; "domingo de ramos" antes de "domingo").
const FEASTS: [RegExp, string, Season][] = [
  [/natal (da )?noite|noite de natal|missa da noite/, "natal-noite", "natal"],
  [/natal (do )?dia|dia de natal/, "natal-dia", "natal"],
  [/sagrada familia/, "sagrada-familia", "natal"],
  [/mae de deus/, "mae-de-deus", "natal"],
  [/epifania/, "epifania", "natal"],
  [/batismo do senhor/, "batismo", "natal"],
  [/cinzas/, "cinzas", "quaresma"],
  [/ramos/, "ramos", "quaresma"],
  [/quinta feira santa|ceia do senhor/, "quinta-santa", "quaresma"],
  [/sexta feira santa|paixao do senhor/, "sexta-santa", "quaresma"],
  [/vigilia pascal/, "vigilia-pascal", "pascoa"],
  [/ascensao/, "ascensao", "pascoa"],
  [/pentecostes/, "pentecostes", "pascoa"],
  [/trindade/, "trindade", "tempo-comum"],
  [/corpus christi|corpo e sangue/, "corpus-christi", "tempo-comum"],
  [/cristo rei|rei do universo/, "cristo-rei", "tempo-comum"],
  [/todos os santos/, "todos-os-santos", "tempo-comum"],
  [/finados|fieis defuntos/, "finados", "tempo-comum"],
  [/assuncao/, "assuncao", "tempo-comum"],
  [/aparecida/, "aparecida", "tempo-comum"],
];

/**
 * Chave da celebração, igual para os dois jeitos de escrever:
 * "4º Domingo do Advento, Ano B | Salmo 88" e "Advento 4º Dom - Salmo 088" → "advento-4".
 * null quando o texto não fala de um domingo ou festa (canto genérico de aclamação, por exemplo).
 */
export function celebrationKey(text: string): { key: string; season: Season } | null {
  const n = normalize(text);
  const ordinal = n.match(/\b(\d{1,2}) ?[º°o]\b/) ?? n.match(/\b(\d{1,2})[º°]/);
  // "Domingo de Páscoa" (sem número) é a festa; "2º Domingo da Páscoa" é um domingo do tempo pascal.
  if (/domingo de pascoa|pascoa do senhor|domingo da ressurreicao/.test(n) && !ordinal) return { key: "pascoa", season: "pascoa" };
  for (const [re, key, season] of FEASTS) if (re.test(n)) return { key, season };
  if (!ordinal) return null;
  const season: Season | null = /advento/.test(n)
    ? "advento"
    : /quaresma/.test(n)
      ? "quaresma"
      : /pascoa|pascal/.test(n)
        ? "pascoa"
        : /comum/.test(n)
          ? "tempo-comum"
          : null;
  return season ? { key: `${season}-${Number(ordinal[1])}`, season } : null;
}

/** Primeiro domingo do Advento do ano civil (o domingo entre 27/11 e 03/12). */
function adventStart(year: number): Date {
  const nov27 = new Date(Date.UTC(year, 10, 27));
  return new Date(Date.UTC(year, 10, 27 + ((7 - nov27.getUTCDay()) % 7)));
}

/** Ano litúrgico A/B/C de uma data (mesma regra do site: começa no Advento; Y % 3 == 1 → A). */
export function liturgicalYear(isoDate: string): YearLetter {
  const d = new Date(`${isoDate}T12:00:00Z`);
  const y = d.getUTCFullYear();
  const end = d >= adventStart(y) ? y + 1 : y;
  return (["C", "A", "B"] as const)[end % 3];
}

export interface ListingInfo {
  kind: PsalmKind;
  /** "1º Domingo do Advento, Ano B" */
  celebration: string;
  /** "Salmo 79", "Salmo Lc 1,46" ou null (aclamação). */
  psalm: string | null;
  psalmNumber: number | null;
  /** Ano escrito no título; sem ele, vem da data. */
  year: YearLetter;
  key: string | null;
  season: Season | null;
}

/** "1º Domingo do Advento, Ano B | Salmo 79" (a ordem das partes varia: "Salmo 28 | Batismo do Senhor"). */
export function parseListingTitle(title: string, isoDate: string): ListingInfo {
  const parts = title.split("|").map((p) => p.trim()).filter(Boolean);
  const isPart = (p: string) => /^(salmo|aclama)/i.test(normalize(p));
  const label = parts.find(isPart) ?? null;
  const celebration = parts.find((p) => !isPart(p)) ?? parts[0] ?? title;
  const kind: PsalmKind = /aclama/i.test(normalize(title)) ? "aclamacao" : "salmo";
  const year = (celebration.match(/\bAno ([ABC])\b/i)?.[1]?.toUpperCase() as YearLetter | undefined) ?? liturgicalYear(isoDate);
  const ck = celebrationKey(celebration);
  const psalm = kind === "salmo" && label ? label.replace(/\s+/g, " ") : null;
  // "Salmo 79" tem número; "Salmo Lc 1,46" (cântico) não.
  const psalmNumber = psalm ? Number(psalm.match(/^salmo\s+(\d+)\b/i)?.[1]) || null : null;
  return { kind, celebration, psalm, psalmNumber, year, key: ck?.key ?? null, season: ck?.season ?? null };
}

/** Título do canto novo: "1º Domingo do Advento, Ano B - Salmo 79" ou "Aclamação 1º Domingo do Advento, Ano B". */
export function songTitleFor(info: ListingInfo): string {
  return info.kind === "aclamacao" ? `Aclamação ${info.celebration}` : `${info.celebration}${info.psalm ? ` - ${info.psalm}` : ""}`;
}

// ---------- PDF → letra ----------

const MUSIC = /[«»ˆ˙Œ‰”=_&]/;
const CHORD = /^\(?[A-G](#|b)?(m|maj|min|dim|aug|sus|add|M)?[°º]?[0-9]*\+?(\/[A-G](#|b)?)?\)?$/;
const CLITICS = /^(nos|vos|me|te|se|lhe|lhes)$/i;

const isChordLine = (line: string) => {
  const t = line.trim().split(/\s+/);
  return t.length > 0 && t.every((x) => CHORD.test(x) || /^(m|#)$/.test(x)) && t.some((x) => CHORD.test(x));
};
const isText = (line: string) => !MUSIC.test(line) && (line.match(/\p{L}{3,}/gu) ?? []).length >= 2;

/**
 * Junta as sílabas separadas para a partitura: "I - lu-mi-nai" → "Iluminai", "queru - bins" → "querubins".
 * Mantém o hífen dos pronomes ("convertei-nos", "Voltai-vos", "protegei-a").
 */
export function joinSyllables(line: string): string {
  return line
    .replace(/(\p{L}+)\s*-\s*(?=(\p{L}+))/gu, (_m, left: string, right: string) => {
      const keep = (CLITICS.test(right) && /(ai|ei|i|ar|er|ir|ou|am|em|e|a)$/i.test(left)) || (/^(a|o|as|os)$/i.test(right) && /(ai|ei)$/i.test(left));
      return keep ? `${left}-` : left;
    })
    .replace(/,(?=\S)/g, ", ")
    .replace(/\s+/g, " ")
    .trim();
}

export interface ParsedSheet {
  lyrics: string;
  /** Primeiro acorde da partitura (tom original). */
  key: string | null;
  composer: string | null;
}

/**
 * Linhas de texto do PDF (de cima para baixo) → letra no formato do site.
 *
 * Na partitura, cada estrofe (ou versículo) é cantada em duas ou mais partes da melodia, e o PDF mostra
 * a 1ª parte de todas as estrofes antes da 2ª. Por isso cada estrofe guarda as seções na ordem em que
 * aparecem e, dentro de cada seção, as partes ("a)", "b)"; na aclamação, cada linha). A letra intercala:
 * parte 1 da seção 1, parte 1 da seção 2, parte 2 da seção 1, parte 2 da seção 2...
 *
 * Salmo: refrão em negrito + "1.", "2."... Aclamação: refrão (aleluia) + "1º Dom.: …" de cada domingo.
 */
export function sheetToLyrics(lines: string[], kind: PsalmKind): ParsedSheet {
  let key: string | null = null;
  let composer: string | null = null;
  let refrain: string | null = null;
  // estrofe → seções → partes → linhas
  const blocks = new Map<string, string[][][]>();
  const order: string[] = [];
  let current: string | null = null;

  const open = (label: string) => {
    if (!blocks.has(label)) (blocks.set(label, []), order.push(label));
    const sections = blocks.get(label)!;
    // O rótulo ("1.", "1° dom.") aparecendo de novo: começou a parte seguinte da melodia.
    if (!sections.length || sections.at(-1)!.length) sections.push([]);
    current = label;
  };
  const part = () => blocks.get(current!)!.at(-1)!;
  const addLine = (text: string, newPart: boolean) => {
    if (!current || !text) return;
    const sec = part();
    if (newPart || !sec.length) sec.push([]);
    sec.at(-1)!.push(text);
  };

  for (const raw of lines) {
    const line = raw.replace(/\s+/g, " ").trim();
    if (!line) continue;
    if (!key && isChordLine(line)) key = line.split(" ")[0].replace(/[()]/g, "");
    const comp = line.match(/^M\.?\s*:\s*(.+)$/);
    if (comp) {
      composer = comp[1].trim();
      continue;
    }
    const r = line.match(/^(refr[aã]o|R\.)\s*:?\s*(.+)$/i);
    if (r) {
      refrain = joinSyllables(r[2]);
      continue;
    }
    if (kind === "aclamacao") {
      // O 1º texto com "aleluia" é o refrão; os versículos vêm marcados por domingo ("1° dom.").
      if (!refrain && !current && /aleluia/i.test(joinSyllables(line).replace(/-/g, ""))) {
        refrain = joinSyllables(line);
        continue;
      }
      const dom = line.match(/^(\d{1,2})\s*[°ºo]\s*dom\.?\s*(.*)$/i);
      if (dom) {
        open(`${Number(dom[1])}º Dom.`);
        const rest = dom[2].replace(/^(adv|qua|pas|tc|nat)\.?\s*/i, "");
        if (isText(rest)) addLine(joinSyllables(rest), true);
        continue;
      }
      // "Adv." sozinho (rótulo do tempo) não é texto; "Adv. a salvação…" é.
      const rest = line.replace(/^(adv|qua|pas|tc|nat)\.\s*/i, "");
      if (current && isText(rest)) addLine(joinSyllables(rest), true);
      continue;
    }
    const st = line.match(/^(\d{1,2})\.\s*(.*)$/);
    if (st) open(`${Number(st[1])}.`);
    let text = st ? st[2] : line;
    const sub = text.match(/^[a-c]\)\s*(.*)$/);
    if (sub) text = sub[1];
    text = text.replace(/\s*\+\s*$/, "");
    if (current && isText(text)) addLine(joinSyllables(text), Boolean(sub) || Boolean(st));
  }

  const parts: string[] = [];
  if (refrain) parts.push(`**${refrain}**`);
  for (const label of order) {
    const sections = blocks.get(label)!;
    const max = Math.max(...sections.map((s) => s.length));
    const out: string[] = [];
    for (let p = 0; p < max; p++) for (const sec of sections) out.push(...(sec[p] ?? []));
    if (!out.length) continue;
    parts.push(kind === "aclamacao" ? `${label}: ${out.join(" ")}` : [`${label} ${out[0]}`, ...out.slice(1)].join("\n"));
  }
  return { lyrics: parts.join("\n\n"), key, composer };
}
