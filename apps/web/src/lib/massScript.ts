// Roteiro da celebração: o folheto de 1 página da equipe de liturgia (modelo da paróquia).
// Regras puras (sem jsPDF): modelo padrão, números dos cantos e a marcação leve do texto.
import type { Mass, MassScript, MassSlot, ScriptItem, Song } from "./types";

/** Cor litúrgica de cada tempo (o "Lembrete" do folheto). */
export const LITURGICAL_COLOR: Record<NonNullable<Mass["season"]>, string> = {
  advento: "ROXA",
  natal: "BRANCA",
  quaresma: "ROXA",
  pascoa: "BRANCA",
  "tempo-comum": "VERDE",
};

const MONTHS = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

/**
 * "28 e 29 de novembro de 2026": a missa de domingo também é celebrada na véspera (sábado à noite).
 * Em outros dias, só a data.
 */
export function weekendLabel(iso: string) {
  if (!iso) return "";
  const d = new Date(`${iso}T12:00:00`);
  const day = d.getDate();
  const month = MONTHS[d.getMonth()];
  if (d.getDay() !== 0) return `${day} de ${month} de ${d.getFullYear()}`;
  const eve = new Date(d);
  eve.setDate(day - 1);
  return eve.getMonth() === d.getMonth()
    ? `${eve.getDate()} e ${day} de ${month} de ${d.getFullYear()}`
    : `${eve.getDate()} de ${MONTHS[eve.getMonth()]} e ${day} de ${month} de ${d.getFullYear()}`;
}

let seq = 0;
const itemId = () => `r${Date.now().toString(36)}${(seq++).toString(36)}`;

const text = (title: string, body = "", boxed = false): ScriptItem => ({ id: itemId(), title, kind: "texto", slotIds: [], text: body, boxed });
const songs = (title: string, slots: MassSlot[], body = ""): ScriptItem => ({
  id: itemId(),
  title,
  kind: "cantos",
  slotIds: slots.map((s) => s.id),
  text: body,
  boxed: false,
});

/**
 * Modelo padrão, no formato que a paróquia já usa. Os itens de canto ficam ligados aos momentos da
 * missa (os números aparecem sozinhos); momento que a missa não tem não entra (ex.: Glória no Advento).
 */
export function defaultScript(mass: Mass): MassScript {
  const slot = (moment: string) => mass.slots.filter((s) => s.moment === moment);
  const maybe = (title: string, moment: string, body = "") => (slot(moment).length ? [songs(title, slot(moment), body)] : []);
  const title = [mass.name.replace(/\s+[—-]\s+Missa.*$/i, ""), weekendLabel(mass.date)].filter(Boolean).join(" – ");
  return {
    title: title.toUpperCase(),
    notes: [`1) Cor litúrgica: ${mass.season ? LITURGICAL_COLOR[mass.season] : "…"}`, "2) **Acolhida:** 30 min ANTES DA CELEBRAÇÃO"].join("\n"),
    items: [
      text(
        "Ambientação e acendimento das velas",
        "*3 min antes da celebração:* Irmãos e irmãs, preparemo-nos para a celebração eucarística. Permaneçamos sentados e rezemos a Oração pelas Vocações: Jesus, mestre divino... *Depois, uma pessoa acende as velas do altar enquanto se canta o refrão orante.*",
      ),
      ...maybe("Velas", "velas"),
      text("Comentarista", "Iniciemos a Celebração Eucarística, cantando:", true),
      text("Procissão de entrada", "1. Cruz; 2. Evangeliário; 3. Toda a equipe de celebração;"),
      ...maybe("Canto de abertura", "entrada"),
      text("Saudação", "com o Presidente da Celebração."),
      text(
        "Motivação inicial",
        "Irmãos e irmãs, …\nUnimo-nos em oração aos familiares dos falecidos de nossa comunidade. (*De modo particular:* ……………………………………).",
        true,
      ),
      ...maybe("Ato Penitencial", "ato-penitencial"),
      ...maybe("Glória", "gloria"),
      text("Liturgia da Palavra"),
      ...maybe("Salmo", "salmo"),
      ...maybe("Aclamação", "aclamacao", "*(cf. material da diocese)*"),
      text("Creio", "*durante o Creio o leitor das preces já se posiciona no ambão!*"),
      text(
        "Preces da Comunidade",
        "Padre: …, apresentemos as nossas preces, suplicando:\nR.: …\nL.: Pela Igreja, …, supliquemos:\nL.: Pela nossa comunidade reunida, …, supliquemos:\nL.: Pelos que faleceram recentemente, (em especial ……………………), para que seus familiares sejam consolados pelo Cristo ressurreição e vida, supliquemos:\nPadre: … Por Cristo, nosso Senhor. **T.: Amém.**",
        true,
      ),
      ...maybe("Apresentação dos dons", "ofertorio"),
      text("Oração Eucarística", "III"),
      text("Aclamação Memorial", "Mistério da Fé! Anunciamos..."),
      ...maybe("Santo", "santo"),
      ...maybe("Cordeiro de Deus", "cordeiro"),
      ...maybe("Procissão da Comunhão", "comunhao"),
      ...mass.slots.filter((s) => s.moment === "extra").map((s) => songs(s.label, [s])),
      ...maybe("Canto final", "saida"),
    ],
  };
}

/**
 * Cantos de um item, como no folheto: o número com 2 dígitos ("06, 01, 117"); canto sem número
 * (salmos e aclamações da diocese) entra pelo título.
 */
export function songRefs(item: ScriptItem, mass: Pick<Mass, "slots">, byId: Map<number, Song>) {
  return mass.slots
    .filter((s) => item.slotIds.includes(s.id))
    .flatMap((s) => s.items)
    .map((i) => {
      const song = byId.get(i.songId);
      if (!song) return "";
      return song.number != null ? String(song.number).padStart(2, "0") : song.title;
    })
    .filter(Boolean)
    .join(", ");
}

export interface Run {
  text: string;
  bold?: boolean;
  /** Instrução: vermelho, itálico e negrito (como no folheto). */
  cue?: boolean;
}

/**
 * Marcação leve do texto: **negrito** e *instrução*. Linhas que começam com "Padre:" ganham o prefixo
 * em vermelho; "R.:" deixa a linha toda em negrito; "T.:" em negrito.
 */
export function parseRich(line: string): Run[] {
  const runs: Run[] = [];
  const prefix = line.match(/^(Padre|Presidente|P\.)\s*:/);
  let rest = line;
  if (prefix) {
    runs.push({ text: prefix[0], cue: true });
    rest = line.slice(prefix[0].length);
  }
  const wholeBold = /^R\.\s*:/.test(line);
  const re = /\*\*(.+?)\*\*|\*(.+?)\*|(T\.\s*:)/g;
  let last = 0;
  for (let m = re.exec(rest); m; m = re.exec(rest)) {
    if (m.index > last) runs.push({ text: rest.slice(last, m.index), bold: wholeBold });
    if (m[1] !== undefined) runs.push({ text: m[1], bold: true });
    else if (m[2] !== undefined) runs.push({ text: m[2], cue: true });
    else runs.push({ text: m[3], bold: true });
    last = re.lastIndex;
  }
  if (last < rest.length) runs.push({ text: rest.slice(last), bold: wholeBold });
  return runs.filter((r) => r.text.length);
}

/** Texto sem a marcação (para a pré-visualização simples e os testes). */
export const plain = (line: string) => parseRich(line).map((r) => r.text).join("");
