import type { Mass, MassSlot } from "./types";

// Junta as alterações de duas pessoas que editaram a mesma missa ao mesmo tempo (merge de 3 vias).
// `base` é a última versão que este aparelho recebeu do servidor, `local` é o que a pessoa tem na
// tela e `server` é o que outra pessoa salvou nesse meio-tempo. Regra geral, campo a campo e
// momento a momento: o que só um lado mudou, vale; se os dois mudaram, vale o daqui, mas cantos
// que a outra pessoa acrescentou no mesmo momento não se perdem.

type Content = Pick<Mass, "name" | "date" | "time" | "season" | "year" | "slots">;

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/** O que só um lado mudou, vale; se os dois mudaram, vale o daqui. */
function pick<T>(base: T, local: T, server: T): T {
  return same(local, base) ? server : local;
}

function mergeItems(base: MassSlot["items"], local: MassSlot["items"], server: MassSlot["items"]) {
  if (same(local, base)) return server;
  if (same(server, base)) return local;
  // Os dois mexeram: fica a lista daqui e entram os cantos novos de lá (que não estavam na base).
  const extra = server.filter((s) => !local.some((l) => l.songId === s.songId) && !base.some((b) => b.songId === s.songId));
  return [...local, ...extra];
}

function mergeSlots(base: MassSlot[], local: MassSlot[], server: MassSlot[]): MassSlot[] {
  const find = (list: MassSlot[], id: string) => list.find((s) => s.id === id);
  const result = new Map<string, MassSlot>();

  for (const id of new Set([...local, ...server].map((s) => s.id))) {
    const b = find(base, id);
    const l = find(local, id);
    const s = find(server, id);
    if (l && s) {
      result.set(id, b ? { ...l, label: pick(b.label, l.label, s.label), items: mergeItems(b.items, l.items, s.items) } : l);
    } else if (l) {
      // Não existe lá: ou é novo aqui, ou a outra pessoa removeu. Removido sem mudança daqui, some.
      if (!b || !same(l, b)) result.set(id, l);
    } else if (s) {
      // Mesma lógica do outro lado: novo lá, ou removido aqui sem a outra pessoa ter mexido.
      if (!b || !same(s, b)) result.set(id, s);
    }
  }

  // Ordem: a daqui, se a pessoa reordenou; senão a de lá. Os que faltarem entram depois do vizinho.
  const ids = (list: MassSlot[]) => list.map((s) => s.id);
  const primary = same(ids(local), ids(base)) ? server : local;
  const secondary = primary === local ? server : local;
  const order = ids(primary).filter((id) => result.has(id));
  for (const id of ids(secondary)) {
    if (!result.has(id) || order.includes(id)) continue;
    const i = ids(secondary).indexOf(id);
    const prev = ids(secondary).slice(0, i).reverse().find((x) => order.includes(x));
    order.splice(prev ? order.indexOf(prev) + 1 : 0, 0, id);
  }
  return order.map((id) => result.get(id)!);
}

export function mergeMass<T extends Content>(base: Content, local: T, server: Content): T {
  return {
    ...local,
    name: pick(base.name, local.name, server.name),
    date: pick(base.date, local.date, server.date),
    time: pick(base.time, local.time, server.time),
    season: pick(base.season, local.season, server.season),
    year: pick(base.year, local.year, server.year),
    slots: mergeSlots(base.slots, local.slots, server.slots),
  };
}
