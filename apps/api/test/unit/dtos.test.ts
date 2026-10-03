import { describe, expect, it } from "vitest";
import { loginSchema } from "../../src/dtos/auth.dto.js";
import { createMassSchema, massBodySchema, massPatchSchema, shareBodySchema } from "../../src/dtos/mass.dto.js";
import { flagBodySchema, listSongsQuerySchema, songBodySchema } from "../../src/dtos/song.dto.js";
import { createUserSchema, listUsersQuerySchema } from "../../src/dtos/user.dto.js";
import { validate } from "../../src/http/validate.js";

const ok = <T>(r: { success: boolean; data?: T }) => (expect(r.success).toBe(true), r.data as T);
const fails = (r: { success: boolean }) => expect(r.success).toBe(false);

describe("Cadastro (createUserSchema)", () => {
  const base = { name: "Maria Souza", email: "Maria@Exemplo.com ", password: "senha1234" };

  it("normaliza o e-mail e transforma vazio em null", () => {
    expect(ok(createUserSchema.safeParse({ ...base, phone: "", movementId: null }))).toEqual({
      name: "Maria Souza",
      email: "maria@exemplo.com",
      password: "senha1234",
      phone: null,
      movementId: null,
    });
  });

  it("ignora campos que a pessoa não pode escolher (papel, status, id): sem mass assignment", () => {
    const data = ok(createUserSchema.safeParse({ ...base, roles: ["admin"], status: "active", id: "x", passwordHash: "y" }));
    expect(Object.keys(data as object).sort()).toEqual(["email", "movementId", "name", "password", "phone"]);
  });

  it.each([
    ["curta", "abc123"],
    ["sem número", "senhasenha"],
    ["sem letra", "12345678"],
    ["longa demais", "a1".repeat(101)],
  ])("senha %s é recusada", (_n, password) => fails(createUserSchema.safeParse({ ...base, password })));

  it("recusa nome curto, e-mail inválido e telefone com letras", () => {
    fails(createUserSchema.safeParse({ ...base, name: "Ma" }));
    fails(createUserSchema.safeParse({ ...base, email: "maria@" }));
    fails(createUserSchema.safeParse({ ...base, phone: "ligue-me" }));
    ok(createUserSchema.safeParse({ ...base, phone: "+55 (31) 99999-0000" }));
  });
});

describe("Login e filtros", () => {
  it("login normaliza o e-mail e liga 'manter conectado' por padrão", () => {
    expect(ok(loginSchema.safeParse({ email: " A@B.COM", password: "x" }))).toEqual({ email: "a@b.com", password: "x", remember: true });
    fails(loginSchema.safeParse({ email: "a@b.com", password: "" }));
  });
  it("filtros do admin só aceitam valores conhecidos", () => {
    fails(listUsersQuerySchema.safeParse({ status: "deleted" }));
    fails(listUsersQuerySchema.safeParse({ role: "root" }));
  });
});

describe("Missa (massBodySchema)", () => {
  const slot = (over: object = {}) => ({ id: "s1", moment: "entrada", label: "Entrada", items: [{ songId: 1, transpose: 0 }], ...over });

  it("tudo é opcional e vem com padrão", () => {
    expect(ok(massBodySchema.safeParse({}))).toEqual({ name: "", date: null, time: null, season: null, year: null, slots: [] });
  });

  it("tom de −6 a +5 (regra da transposição)", () => {
    ok(massBodySchema.safeParse({ slots: [slot({ items: [{ songId: 1, transpose: -6 }, { songId: 2, transpose: 5 }] })] }));
    fails(massBodySchema.safeParse({ slots: [slot({ items: [{ songId: 1, transpose: 6 }] })] }));
    fails(massBodySchema.safeParse({ slots: [slot({ items: [{ songId: 1, transpose: -7 }] })] }));
    fails(massBodySchema.safeParse({ slots: [slot({ items: [{ songId: 1, transpose: 1.5 }] })] }));
  });

  it("data aaaa-mm-dd válida e horário HH:mm", () => {
    ok(massBodySchema.safeParse({ date: "2028-02-29", time: "23:59" }));
    fails(massBodySchema.safeParse({ date: "2026-02-30" }));
    fails(massBodySchema.safeParse({ date: "11/10/2026" }));
    fails(massBodySchema.safeParse({ time: "24:00" }));
    fails(massBodySchema.safeParse({ time: "7h" }));
  });

  it("recusa momento desconhecido, ids de momento repetidos e limites (40 momentos, 10 cantos)", () => {
    fails(massBodySchema.safeParse({ slots: [slot({ moment: "abertura" })] }));
    fails(massBodySchema.safeParse({ slots: [slot(), slot()] }));
    fails(massBodySchema.safeParse({ slots: Array.from({ length: 41 }, (_, i) => slot({ id: `s${i}` })) }));
    fails(massBodySchema.safeParse({ slots: [slot({ items: Array.from({ length: 11 }, (_, i) => ({ songId: i + 1, transpose: 0 })) })] }));
    ok(massBodySchema.safeParse({ slots: [slot({ moment: "extra", label: "Ação de graças" })] }));
  });

  it("PATCH exige ao menos um campo; o dono não pode ser trocado pelo corpo", () => {
    fails(massPatchSchema.safeParse({}));
    expect(ok(massPatchSchema.safeParse({ name: "X", owner: { id: "outro" }, ownerId: "outro" }))).toEqual({ name: "X" });
  });

  it("id do front precisa ser UUID; compartilhar só com UUIDs", () => {
    fails(createMassSchema.safeParse({ id: "abc" }));
    ok(createMassSchema.safeParse({ id: "6f1c2b8e-4c5d-4e7f-9a1b-2c3d4e5f6a7b" }));
    fails(shareBodySchema.safeParse({ userIds: ["'; DROP TABLE users; --"] }));
  });
});

describe("Canto e flag", () => {
  it("tom aceita extensões (C7, F#m7, Bb) e recusa lixo", () => {
    for (const key of ["D", "Em", "F#m", "Bb", "C7", "D9", "F#m7"]) ok(songBodySchema.safeParse({ title: "X", key }));
    for (const key of ["H", "do", "", "C 7"]) fails(songBodySchema.safeParse({ title: "X", key }));
  });
  it("slug e URLs de mídia validados", () => {
    fails(songBodySchema.safeParse({ title: "X", slug: "Com Maiúscula" }));
    fails(songBodySchema.safeParse({ title: "X", media: { audio: "javascript:alert(1)" } }));
    fails(songBodySchema.safeParse({ title: "" }));
  });
  it("?flags=1,a,2,-3 vira [1, 2]", () => {
    expect(ok(listSongsQuerySchema.safeParse({ flags: "1,a,2,-3" }))).toMatchObject({ flagIds: [1, 2], page: 1, pageSize: 50 });
    fails(listSongsQuerySchema.safeParse({ pageSize: "1000" }));
  });
  it("flag: grupo conhecido, slug sem espaço e cor #RRGGBB", () => {
    ok(flagBodySchema.safeParse({ group: "ano", slug: "A", name: "Ano A" }));
    fails(flagBodySchema.safeParse({ group: "cor", slug: "A", name: "X" }));
    fails(flagBodySchema.safeParse({ group: "ano", slug: "a b", name: "X" }));
    fails(flagBodySchema.safeParse({ group: "ano", slug: "a", name: "X", color: "red" }));
  });
});

describe("validate()", () => {
  it("vira 400 com a primeira mensagem de cada campo", () => {
    try {
      validate(createUserSchema, { name: "A", email: "x", password: "1" });
      expect.unreachable();
    } catch (err) {
      expect(err).toMatchObject({ code: "VALIDATION_ERROR", status: 400, details: { fields: { name: expect.any(String), email: "E-mail inválido.", password: expect.any(String) } } });
    }
  });
  it("corpo ausente conta como objeto vazio", () => {
    expect(validate(massBodySchema, undefined)).toMatchObject({ slots: [] });
  });
});
