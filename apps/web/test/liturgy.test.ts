import { describe, expect, it } from "vitest";
import { formatNumber, liturgicalSeason, liturgicalYear } from "@/lib/liturgy";

// O editor cria as datas com "T12:00:00" (meio-dia local). Os testes usam o mesmo formato.
const at = (iso: string) => new Date(`${iso}T12:00:00`);

describe("Tempo litúrgico pela data (regra §6 da skill)", () => {
  it.each([
    // 2025-26 (Ano A): Advento começa em 30/11/2025
    ["2025-11-29", "tempo-comum"], // sábado antes do 1º Domingo do Advento
    ["2025-11-30", "advento"],
    ["2025-12-24", "advento"],
    ["2025-12-25", "natal"],
    ["2026-01-01", "natal"],
    ["2026-01-11", "natal"], // Batismo do Senhor: último dia do Natal
    ["2026-01-12", "tempo-comum"],
    ["2026-02-17", "tempo-comum"], // terça de carnaval
    ["2026-02-18", "quaresma"], // Quarta-feira de Cinzas
    ["2026-04-04", "quaresma"], // Sábado Santo
    ["2026-04-05", "pascoa"], // Páscoa
    ["2026-05-24", "pascoa"], // Pentecostes: último dia da Páscoa
    ["2026-05-25", "tempo-comum"],
    ["2026-11-28", "tempo-comum"],
    ["2026-11-29", "advento"], // 1º Domingo do Advento de 2026
  ])("%s → %s", (iso, season) => {
    expect(liturgicalSeason(at(iso))).toBe(season);
  });

  it("vale a qualquer hora do dia (meia-noite e fim do dia)", () => {
    expect(liturgicalSeason(new Date(2026, 4, 24, 0, 0))).toBe("pascoa");
    expect(liturgicalSeason(new Date(2026, 4, 24, 23, 59))).toBe("pascoa");
    expect(liturgicalSeason(new Date(2026, 0, 11, 19, 0))).toBe("natal");
  });

  it("Natal no domingo (2022): Advento começa 4 domingos antes, em 27/11", () => {
    expect(liturgicalSeason(at("2022-11-26"))).toBe("tempo-comum");
    expect(liturgicalSeason(at("2022-11-27"))).toBe("advento");
  });

  it("Páscoa em outras datas (algoritmo de Meeus)", () => {
    expect(liturgicalSeason(at("2027-03-28"))).toBe("pascoa"); // Páscoa 2027
    expect(liturgicalSeason(at("2027-03-27"))).toBe("quaresma");
    expect(liturgicalSeason(at("2038-04-25"))).toBe("pascoa"); // Páscoa mais tardia possível
  });
});

describe("Ano litúrgico A/B/C (começa no Advento)", () => {
  it.each([
    ["2025-11-29", "C"], // ainda 2024-25
    ["2025-11-30", "A"], // 2025-26
    ["2026-06-15", "A"],
    ["2026-11-29", "B"], // 2026-27
    ["2027-12-24", "C"], // 2027-28
  ])("%s → Ano %s", (iso, year) => {
    expect(liturgicalYear(at(iso))).toBe(year);
  });
});

describe("Número do canto", () => {
  it("sempre com 3 dígitos; sem número, null", () => {
    expect(formatNumber(1)).toBe("Nº 001");
    expect(formatNumber(45)).toBe("Nº 045");
    expect(formatNumber(1234)).toBe("Nº 1234");
    expect(formatNumber(null)).toBeNull();
  });
});
