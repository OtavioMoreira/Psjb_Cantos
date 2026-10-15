import type { EmailMessage } from "../interfaces/index.js";

// Modelos dos e-mails transacionais. Funções puras: recebem os dados e devolvem assunto, HTML e texto.
// O HTML usa tabelas e estilos inline porque é o que os leitores de e-mail entendem.

const PARISH = "Paróquia Catedral São João Batista";
const GREEN = "#1F3D2B";
const IVORY = "#FAF7F0";
const MUTED = "#5C6B61";

export const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

const firstName = (name: string) => name.trim().split(/\s+/)[0] ?? name;

interface Layout {
  to: string;
  subject: string;
  /** Parágrafos em texto puro (escapados no HTML). */
  paragraphs: string[];
  action?: { label: string; url: string };
  /** Código em destaque (2FA). */
  code?: string;
  footnote: string;
}

function render({ to, subject, paragraphs, action, code, footnote }: Layout): EmailMessage {
  const p = (t: string) => `<p style="margin:0 0 16px;font-size:16px;line-height:1.5;color:#1d1d1b">${escapeHtml(t)}</p>`;
  const button = action
    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 24px"><tr><td style="border-radius:10px;background:${GREEN}">
<a href="${escapeHtml(action.url)}" style="display:inline-block;padding:14px 28px;font-size:16px;font-weight:600;color:#ffffff;text-decoration:none">${escapeHtml(action.label)}</a>
</td></tr></table>
<p style="margin:0 0 16px;font-size:13px;line-height:1.5;color:${MUTED}">Se o botão não funcionar, copie e cole no navegador:<br><a href="${escapeHtml(action.url)}" style="color:${GREEN};word-break:break-all">${escapeHtml(action.url)}</a></p>`
    : "";
  const codeBlock = code
    ? `<p style="margin:8px 0 24px;font-size:34px;font-weight:700;letter-spacing:8px;color:${GREEN};font-family:'Courier New',monospace">${escapeHtml(code)}</p>`
    : "";

  const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(subject)}</title></head>
<body style="margin:0;padding:0;background:${IVORY};font-family:Inter,Segoe UI,Helvetica,Arial,sans-serif">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${IVORY}"><tr><td align="center" style="padding:24px 16px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:16px;border:1px solid #e7e1d3">
<tr><td style="padding:24px 28px;border-bottom:3px solid #C9A24A">
<p style="margin:0;font-family:Georgia,'Times New Roman',serif;font-size:22px;font-weight:600;color:${GREEN}">Cantos PSJB</p>
<p style="margin:2px 0 0;font-size:13px;color:${MUTED}">${PARISH}</p>
</td></tr>
<tr><td style="padding:28px">
${paragraphs.map(p).join("\n")}
${codeBlock}${button}
<p style="margin:0;font-size:13px;line-height:1.5;color:${MUTED}">${escapeHtml(footnote)}</p>
</td></tr>
</table>
<p style="margin:16px 0 0;font-size:12px;color:${MUTED}">Quem canta reza duas vezes. (Sto. Agostinho)</p>
</td></tr></table>
</body></html>`;

  const text = [
    "Cantos PSJB · " + PARISH,
    "",
    ...paragraphs.flatMap((t) => [t, ""]),
    ...(code ? [code, ""] : []),
    ...(action ? [`${action.label}: ${action.url}`, ""] : []),
    footnote,
  ].join("\n");

  return { to, subject, html, text };
}

export function passwordResetEmail(d: { to: string; name: string; url: string }): EmailMessage {
  return render({
    to: d.to,
    subject: "Redefinir sua senha · Cantos PSJB",
    paragraphs: [`Olá, ${firstName(d.name)}!`, "Recebemos um pedido para criar uma nova senha para a sua conta no Cantos PSJB."],
    action: { label: "Criar nova senha", url: d.url },
    footnote: "O link vale por 1 hora e só pode ser usado uma vez. Se você não pediu, ignore este e-mail: sua senha continua a mesma.",
  });
}

export function inviteEmail(d: { to: string; name: string; invitedBy: string; url: string }): EmailMessage {
  return render({
    to: d.to,
    subject: "Você foi convidado para o Cantos PSJB",
    paragraphs: [
      `Olá, ${firstName(d.name)}!`,
      `${d.invitedBy} convidou você para o Cantos PSJB, o site de cantos da ${PARISH}. Lá você consulta letras e cifras, monta as missas e toca pelo tablet.`,
      "Para começar, crie a sua senha:",
    ],
    action: { label: "Criar minha senha", url: d.url },
    footnote: "O convite vale por 7 dias. Se você não esperava este e-mail, pode ignorá-lo.",
  });
}

export function emailChangeEmail(d: { to: string; name: string; url: string }): EmailMessage {
  return render({
    to: d.to,
    subject: "Confirme seu novo e-mail · Cantos PSJB",
    paragraphs: [`Olá, ${firstName(d.name)}!`, "Para usar este endereço como o novo e-mail da sua conta no Cantos PSJB, confirme pelo botão abaixo."],
    action: { label: "Confirmar novo e-mail", url: d.url },
    footnote: "O link vale por 24 horas. Até confirmar, o e-mail antigo continua valendo. Se você não pediu a troca, ignore este e-mail.",
  });
}

export function emailChangedEmail(d: { to: string; name: string; newEmail: string }): EmailMessage {
  return render({
    to: d.to,
    subject: "Seu e-mail foi alterado · Cantos PSJB",
    paragraphs: [`Olá, ${firstName(d.name)}!`, `O e-mail da sua conta no Cantos PSJB foi trocado para ${d.newEmail}. A partir de agora, entre com o novo endereço.`],
    footnote: "Se não foi você, procure a coordenação da paróquia o quanto antes.",
  });
}

export function loginCodeEmail(d: { to: string; name: string; code: string }): EmailMessage {
  return render({
    to: d.to,
    subject: `${d.code} é o seu código de acesso · Cantos PSJB`,
    paragraphs: [`Olá, ${firstName(d.name)}!`, "Use este código para terminar de entrar no Cantos PSJB:"],
    code: d.code,
    footnote: "O código vale por 10 minutos. Se não foi você que tentou entrar, troque sua senha: alguém pode estar usando ela.",
  });
}

export function accountActivatedEmail(d: { to: string; name: string; url: string }): EmailMessage {
  return render({
    to: d.to,
    subject: "Sua conta foi liberada · Cantos PSJB",
    paragraphs: [`Olá, ${firstName(d.name)}!`, "A coordenação liberou o seu acesso ao Cantos PSJB. Já dá para entrar com o e-mail e a senha do cadastro."],
    action: { label: "Entrar", url: d.url },
    footnote: "Esqueceu a senha? Na tela de entrar, use \"Esqueci a senha\".",
  });
}
