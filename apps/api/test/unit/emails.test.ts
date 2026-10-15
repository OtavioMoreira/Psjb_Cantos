import { describe, expect, it } from "vitest";
import { escapeHtml, inviteEmail, loginCodeEmail, passwordResetEmail } from "../../src/emails/templates.js";
import { ResendEmailSender } from "../../src/services/ResendEmailSender.js";

describe("Modelos de e-mail", () => {
  it("escapa o nome da pessoa no HTML (o nome vem do cadastro)", () => {
    const m = inviteEmail({ to: "a@x.com", name: '<img src=x onerror="alert(1)">', invitedBy: "Pe. João & equipe", url: "https://site/x?token=abc" });
    expect(m.html).not.toContain("<img src=x");
    expect(m.html).toContain("&lt;img");
    expect(m.html).toContain("Pe. João &amp; equipe");
    expect(escapeHtml(`"'<>&`)).toBe("&quot;&#39;&lt;&gt;&amp;");
  });

  it("traz o link no HTML e no texto, com o primeiro nome", () => {
    const m = passwordResetEmail({ to: "a@x.com", name: "Maria  das Dores", url: "https://site/redefinir-senha?token=abc" });
    expect(m.text).toContain("Olá, Maria!");
    expect(m.text).toContain("https://site/redefinir-senha?token=abc");
    expect(m.html).toContain('href="https://site/redefinir-senha?token=abc"');
    expect(m.text).toMatch(/1 hora/);
  });

  it("o código do 2FA vai no assunto e no corpo", () => {
    const m = loginCodeEmail({ to: "a@x.com", name: "Ana", code: "123456" });
    expect(m.subject).toMatch(/^123456 /);
    expect(m.text).toContain("123456");
    expect(m.text).toMatch(/10 minutos/);
  });
});

describe("ResendEmailSender", () => {
  it("chama a API do Resend com a chave e o remetente", async () => {
    const calls: { url: string; init: RequestInit }[] = [];
    const fake = (async (url: string, init: RequestInit) => {
      calls.push({ url, init });
      return new Response(JSON.stringify({ id: "1" }), { status: 200 });
    }) as unknown as typeof fetch;
    await new ResendEmailSender("re_123", "Cantos <no-reply@psjb.org.br>", fake).send({ to: "a@x.com", subject: "S", html: "<p>h</p>", text: "t" });
    expect(calls[0].url).toBe("https://api.resend.com/emails");
    expect((calls[0].init.headers as Record<string, string>).authorization).toBe("Bearer re_123");
    expect(JSON.parse(calls[0].init.body as string)).toEqual({ from: "Cantos <no-reply@psjb.org.br>", to: ["a@x.com"], subject: "S", html: "<p>h</p>", text: "t" });
  });

  it("erro do Resend vira exceção (quem chama decide se mostra)", async () => {
    const fake = (async () => new Response("domínio não verificado", { status: 403 })) as unknown as typeof fetch;
    await expect(new ResendEmailSender("re_123", "x@y.z", fake).send({ to: "a@x.com", subject: "S", html: "", text: "" })).rejects.toThrow(/403/);
  });
});
