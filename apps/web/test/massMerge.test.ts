import { describe, expect, it } from "vitest";
import { mergeMass } from "@/lib/massMerge";
import type { MassSlot } from "@/lib/types";

const slot = (id: string, songs: number[] = [], label = id): MassSlot => ({
  id,
  moment: "entrada",
  label,
  items: songs.map((songId) => ({ songId, transpose: 0 })),
});

const base = {
  name: "Missa das 19h",
  date: "2026-11-29",
  time: "19:00",
  season: "advento" as const,
  year: "A" as const,
  slots: [slot("entrada", [1]), slot("salmo"), slot("comunhao", [5])],
};
const songsOf = (m: { slots: MassSlot[] }) => Object.fromEntries(m.slots.map((s) => [s.id, s.items.map((i) => i.songId)]));

describe("Juntar alterações de duas pessoas na mesma missa", () => {
  it("cada um mexeu em um momento diferente: ficam as duas mudanças", () => {
    const local = { ...base, slots: [slot("entrada", [1, 2]), slot("salmo"), slot("comunhao", [5])] };
    const server = { ...base, slots: [slot("entrada", [1]), slot("salmo", [9]), slot("comunhao", [5])] };
    expect(songsOf(mergeMass(base, local, server))).toEqual({ entrada: [1, 2], salmo: [9], comunhao: [5] });
  });

  it("campos do cabeçalho: o que só um lado mudou, vale", () => {
    const local = { ...base, name: "Nome daqui" };
    const server = { ...base, time: "18:00" };
    expect(mergeMass(base, local, server)).toMatchObject({ name: "Nome daqui", time: "18:00" });
  });

  it("os dois mudaram o mesmo momento: vale a lista daqui + os cantos novos de lá", () => {
    const local = { ...base, slots: [slot("entrada", [2]), base.slots[1], base.slots[2]] }; // trocou o 1 pelo 2
    const server = { ...base, slots: [slot("entrada", [1, 3]), base.slots[1], base.slots[2]] }; // acrescentou o 3
    expect(songsOf(mergeMass(base, local, server)).entrada).toEqual([2, 3]);
  });

  it("tom mudado só lá entra; mudado aqui também, vale o daqui", () => {
    const server = { ...base, slots: [{ ...slot("entrada"), items: [{ songId: 1, transpose: 2 }] }, base.slots[1], base.slots[2]] };
    expect(mergeMass(base, base, server).slots[0].items[0].transpose).toBe(2);
    const local = { ...base, slots: [{ ...slot("entrada"), items: [{ songId: 1, transpose: -1 }] }, base.slots[1], base.slots[2]] };
    expect(mergeMass(base, local, server).slots[0].items[0].transpose).toBe(-1);
  });

  it("momento novo de cada lado entra na posição certa", () => {
    const local = { ...base, slots: [base.slots[0], slot("acao", [7], "Ação de graças"), base.slots[1], base.slots[2]] };
    const server = { ...base, slots: [...base.slots, slot("saida", [8])] };
    expect(mergeMass(base, local, server).slots.map((s) => s.id)).toEqual(["entrada", "acao", "salmo", "comunhao", "saida"]);
  });

  it("momento removido de um lado some, a não ser que o outro tenha mexido nele", () => {
    const local = { ...base, slots: [base.slots[0], base.slots[2]] }; // tirou o salmo
    expect(mergeMass(base, local, base).slots.map((s) => s.id)).toEqual(["entrada", "comunhao"]);
    const server = { ...base, slots: [base.slots[0], slot("salmo", [9]), base.slots[2]] }; // lá escolheram o salmo
    expect(mergeMass(base, local, server).slots.map((s) => s.id)).toEqual(["entrada", "salmo", "comunhao"]);
  });

  it("reordenação: vale a de quem reordenou", () => {
    const server = { ...base, slots: [base.slots[2], base.slots[0], base.slots[1]] };
    expect(mergeMass(base, base, server).slots.map((s) => s.id)).toEqual(["comunhao", "entrada", "salmo"]);
    const local = { ...base, slots: [base.slots[1], base.slots[0], base.slots[2]] };
    expect(mergeMass(base, local, server).slots.map((s) => s.id)).toEqual(["salmo", "entrada", "comunhao"]);
  });

  it("mantém os campos que não são conteúdo (id, dono) da cópia daqui", () => {
    const local = { ...base, id: "m1", ownerId: "u1" };
    expect(mergeMass(base, local, { ...base, name: "X" })).toMatchObject({ id: "m1", ownerId: "u1", name: "X" });
  });
});
