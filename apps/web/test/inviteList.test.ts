import { describe, expect, it } from "vitest";
import { parseInviteList } from "../src/lib/inviteList";

describe("parseInviteList (Convidar vários)", () => {
  it("aceita os formatos comuns de planilha e de e-mail", () => {
    const { people, problems } = parseInviteList(
      [
        "Maria Souza; Maria@Gmail.com",
        "João da Silva <joao@psjb.org.br>",
        "ana@x.com, Ana Paula Reis",
        "Pedro Lima\tpedro@x.com",
        "Carla Dias - carla@x.com",
      ].join("\n"),
    );
    expect(problems).toEqual([]);
    expect(people).toEqual([
      { name: "Maria Souza", email: "maria@gmail.com", guessed: false },
      { name: "João da Silva", email: "joao@psjb.org.br", guessed: false },
      { name: "Ana Paula Reis", email: "ana@x.com", guessed: false },
      { name: "Pedro Lima", email: "pedro@x.com", guessed: false },
      { name: "Carla Dias", email: "carla@x.com", guessed: false },
    ]);
  });

  it("sem nome, tira o nome do e-mail e marca como adivinhado", () => {
    const { people } = parseInviteList("maria.souza92@gmail.com\njose_carlos@x.com");
    expect(people).toEqual([
      { name: "Maria Souza", email: "maria.souza92@gmail.com", guessed: true },
      { name: "Jose Carlos", email: "jose_carlos@x.com", guessed: true },
    ]);
  });

  it("pula linhas vazias e o cabeçalho; aponta linha sem e-mail, repetida ou sem nome possível", () => {
    const { people, problems } = parseInviteList("Nome;E-mail\n\nBia Lima;bia@x.com\nsem email aqui\nBia L.;BIA@x.com\nab@x.com");
    expect(people.map((p) => p.email)).toEqual(["bia@x.com"]);
    expect(problems.map((p) => [p.line, p.reason])).toEqual([
      [4, "Sem e-mail."],
      [5, "E-mail repetido na lista."],
      [6, "Informe o nome (3 letras ou mais)."],
    ]);
  });
});
