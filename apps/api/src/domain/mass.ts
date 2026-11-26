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

/** Item do roteiro: texto livre ou um momento da missa (os números dos cantos vêm dos slots). */
export interface ScriptItem {
  id: string;
  title: string;
  kind: "texto" | "cantos";
  /** Só em "cantos": de quais momentos vêm os cantos. */
  slotIds: string[];
  /** Texto do item (em "cantos", vem depois dos números). Aceita **negrito** e *instrução*. */
  text: string;
  /** Com moldura no PDF (ex.: motivação inicial, preces). */
  boxed: boolean;
}

/** Roteiro da celebração: o folheto de 1 página da equipe de liturgia. */
export interface MassScript {
  title: string;
  notes: string;
  items: ScriptItem[];
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
  /** Sugerida por um admin para todos (a "missa do padre"); aparece na semana da data. */
  suggested: boolean;
  /** Roteiro da celebração (PDF de 1 página). null = sem roteiro. */
  script: MassScript | null;
  sharedWith: PersonRef[];
  /** Token do link de convite (só o dono vê). null = sem link ativo. */
  shareToken: string | null;
  /** Sobe a cada alteração do conteúdo: controle de concorrência na edição (If-Match). */
  version: number;
  /** Quem salvou por último (null se a conta foi excluída). */
  updatedBy: PersonRef | null;
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
