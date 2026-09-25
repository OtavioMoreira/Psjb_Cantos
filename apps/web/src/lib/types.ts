// Contratos de dados compartilhados — ver planning.md §3.
// Quando a API existir, estes tipos devem migrar para um pacote comum (packages/types).

export type MomentId =
  | "velas"
  | "entrada"
  | "ato-penitencial"
  | "gloria"
  | "salmo"
  | "aclamacao"
  | "preces"
  | "ofertorio"
  | "santo"
  | "cordeiro"
  | "comunhao"
  | "saida";

export type SeasonId = "advento" | "natal" | "quaresma" | "pascoa" | "tempo-comum";
export type YearId = "A" | "B" | "C";

export interface SongMedia {
  audiomack: string | null;
  audio: string | null;
  cifraPdf: string | null;
  partituraPdf: string | null;
}

export interface Song {
  id: number;
  number: number | null;
  slug: string;
  title: string;
  composer: string | null;
  key: string | null;
  moments: MomentId[];
  seasons: SeasonId[];
  years: YearId[];
  themes: string[];
  media: SongMedia;
  /** Letra com cifra no formato "acordes na linha de cima". */
  lyrics: string;
}

/** Versão leve usada em listagens (sem a letra completa). */
export type SongSummary = Omit<Song, "lyrics" | "media"> & {
  has: { cifra: boolean; partitura: boolean; audio: boolean };
  excerpt: string;
};

export interface Category {
  id: string;
  label: string;
  description?: string;
  order?: number;
  color?: string;
}

export interface Taxonomy {
  moments: (Category & { id: MomentId })[];
  seasons: (Category & { id: SeasonId })[];
  years: (Category & { id: YearId })[];
  themes: Category[];
}

export type UserRole = "admin" | "coordenador" | "musico";
/** pendente = aguardando confirmação de e-mail. */
export type UserStatus = "ativo" | "pendente" | "bloqueado";

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  ministry: string;
  parish: string;
  instrument?: string;
  createdAt: string;
  emailVerifiedAt: string | null;
  lastLoginAt: string | null;
  blockedReason?: string;
}

export interface MassItem {
  songId: number;
  /** Transposição em semitons salva só nesta missa. */
  transpose: number;
}

export interface MassSlot {
  id: string;
  moment: MomentId | "extra";
  label: string;
  items: MassItem[];
}

export interface Mass {
  id: string;
  name: string;
  date: string; // yyyy-mm-dd
  time: string; // HH:mm
  season: SeasonId | null;
  year: YearId | null;
  slots: MassSlot[];
  updatedAt: string;
}
