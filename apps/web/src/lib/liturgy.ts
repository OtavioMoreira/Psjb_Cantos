import type { SeasonId, YearId } from "./types";

// Cálculo aproximado do calendário litúrgico (suficiente para sugestões na UI).

function easter(year: number) {
  // Algoritmo de Meeus/Jones/Butcher
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

function addDays(d: Date, n: number) {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function adventStart(year: number) {
  const christmas = new Date(year, 11, 25);
  const dow = christmas.getDay() || 7;
  return addDays(christmas, -dow - 21);
}

export function liturgicalSeason(date: Date): SeasonId {
  const y = date.getFullYear();
  const e = easter(y);
  const ashWednesday = addDays(e, -46);
  const pentecost = addDays(e, 49);
  const advent = adventStart(y);
  const baptism = (() => {
    const epiphany = new Date(y, 0, 6);
    return addDays(epiphany, 7 - epiphany.getDay());
  })();

  if (date >= advent && date < new Date(y, 11, 25)) return "advento";
  if (date >= new Date(y, 11, 25) || date <= baptism) return "natal";
  if (date >= ashWednesday && date < e) return "quaresma";
  if (date >= e && date <= pentecost) return "pascoa";
  return "tempo-comum";
}

export function liturgicalYear(date: Date): YearId {
  const y = date >= adventStart(date.getFullYear()) ? date.getFullYear() + 1 : date.getFullYear();
  return (["C", "A", "B"] as const)[y % 3];
}

export const SEASON_STYLE: Record<SeasonId, { color: string; soft: string; label: string }> = {
  advento: { color: "var(--season-roxo)", soft: "var(--season-roxo-soft)", label: "Advento" },
  natal: { color: "var(--season-dourado)", soft: "var(--season-dourado-soft)", label: "Natal" },
  quaresma: { color: "var(--season-roxo)", soft: "var(--season-roxo-soft)", label: "Quaresma" },
  pascoa: { color: "var(--season-dourado)", soft: "var(--season-dourado-soft)", label: "Páscoa" },
  "tempo-comum": { color: "var(--season-verde)", soft: "var(--season-verde-soft)", label: "Tempo Comum" },
};

export function formatNumber(n: number | null) {
  return n == null ? null : `Nº ${String(n).padStart(3, "0")}`;
}

export function formatDateShort(iso: string) {
  if (!iso) return "sem data";
  const d = new Date(iso + "T12:00:00");
  return d
    .toLocaleDateString("pt-BR", { weekday: "short", day: "numeric", month: "short" })
    .replace(/\./g, "");
}

export function formatDateLong(iso: string) {
  if (!iso) return "";
  const d = new Date(iso + "T12:00:00");
  return d.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}

export function todayIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function nextSundayIso() {
  const d = new Date();
  d.setDate(d.getDate() + ((7 - d.getDay()) % 7 || 7));
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
