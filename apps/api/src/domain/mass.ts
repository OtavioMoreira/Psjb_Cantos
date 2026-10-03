// Missa montada no "Monte sua Missa". Regras em .claude/skills/psjb-regras-de-negocio §7.

export const MOMENTS = [
  "velas",
  "entrada",
  "ato-penitencial",
  "gloria",
  "salmo",
  "aclamacao",
  "preces",
  "ofertorio",
  "santo",
  "cordeiro",
  "comunhao",
  "saida",
] as const;
export type MomentId = (typeof MOMENTS)[number];

export const SEASONS = ["advento", "natal", "quaresma", "pascoa", "tempo-comum"] as const;
export type SeasonId = (typeof SEASONS)[number];

export const YEARS = ["A", "B", "C"] as const;
export type YearId = (typeof YEARS)[number];

/** Transposição salva só nesta missa, em semitons. */
export const TRANSPOSE_MIN = -6;
export const TRANSPOSE_MAX = 5;

export interface MassItem {
  songId: number;
  transpose: number;
}

export interface MassSlot {
  id: string;
  /** "extra" = canto adicional com nome livre (ex.: "Ação de graças"). */
  moment: MomentId | "extra";
  label: string;
  items: MassItem[];
}

export interface PersonRef {
  id: string;
  name: string;
  photoUrl: string | null;
}

export interface Mass {
  id: string;
  owner: PersonRef;
  name: string;
  /** yyyy-mm-dd */
  date: string | null;
  /** HH:mm */
  time: string | null;
  season: SeasonId | null;
  year: YearId | null;
  slots: MassSlot[];
  sharedWith: PersonRef[];
  /** Token do link de convite (só o dono vê). null = sem link ativo. */
  shareToken: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export type MassAccess = "owner" | "shared";

/** Dono ou convidado. Qualquer outra pessoa não tem acesso. */
export function massAccess(mass: Pick<Mass, "owner" | "sharedWith">, userId: string): MassAccess | null {
  if (mass.owner.id === userId) return "owner";
  if (mass.sharedWith.some((p) => p.id === userId)) return "shared";
  return null;
}
