import { describe, expect, it } from "vitest";
import { massAccess } from "../../src/domain/mass.js";
import { songSlug } from "../../src/domain/song.js";
import { hasRole, normalizeEmail } from "../../src/domain/user.js";
import { AppError } from "../../src/domain/errors.js";

describe("songSlug (regra do site: NNN-titulo)", () => {
  it.each([
    ["A feliz espera", 1, "001-a-feliz-espera"],
    ["Ó Vem, Senhor, Não Tardes!", 7, "007-o-vem-senhor-nao-tardes"],
    ["Natal (dia) - Salmo 97", null, "natal-dia-salmo-97"],
    ["  Espaços   e---hífens  ", 120, "120-espacos-e-hifens"],
    ["Ação de Graças: Coração", 1234, "1234-acao-de-gracas-coracao"],
  ])("%s / %s → %s", (title, number, slug) => {
    expect(songSlug(title, number)).toBe(slug);
  });

  it("título só com símbolos ainda gera um slug válido", () => {
    expect(songSlug("!!!", null)).toBe("canto");
    expect(songSlug("x".repeat(500), null).length).toBeLessThanOrEqual(160);
  });
});

describe("massAccess", () => {
  const m = { owner: { id: "dono", name: "Dono", photoUrl: null }, sharedWith: [{ id: "conv", name: "Convidado", photoUrl: null }] };
  it("dono, convidado ou ninguém", () => {
    expect(massAccess(m, "dono")).toBe("owner");
    expect(massAccess(m, "conv")).toBe("shared");
    expect(massAccess(m, "outro")).toBeNull();
    expect(massAccess(m, "")).toBeNull();
  });
});

describe("usuário", () => {
  it("normalizeEmail tira espaços e caixa", () => {
    expect(normalizeEmail("  Ana.Lima@Exemplo.COM ")).toBe("ana.lima@exemplo.com");
  });
  it("hasRole", () => {
    expect(hasRole({ roles: ["admin", "musico"] }, "admin")).toBe(true);
    expect(hasRole({ roles: ["musico"] }, "admin")).toBe(false);
  });
});

describe("AppError", () => {
  it.each([
    ["VALIDATION_ERROR", 400],
    ["INVALID_CREDENTIALS", 401],
    ["UNAUTHORIZED", 401],
    ["ACCOUNT_PENDING", 403],
    ["FORBIDDEN", 403],
    ["NOT_FOUND", 404],
    ["EMAIL_TAKEN", 409],
    ["SONG_IN_USE", 409],
    ["INVALID_FILE", 415],
  ] as const)("%s → HTTP %i", (code, status) => {
    expect(new AppError(code, "x").status).toBe(status);
  });
});
