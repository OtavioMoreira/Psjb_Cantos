import type { EmailMessage, EmailSender } from "../interfaces/index.js";

/**
 * E-mail que não sai: sem RESEND_API_KEY (desenvolvimento) ou com EMAIL_ENABLED=false.
 * Em desenvolvimento mostra o texto no terminal, com o link ou o código, para dar para seguir o fluxo.
 * Em produção registra só o destinatário e o assunto: links e códigos não podem ficar nos logs.
 */
export class ConsoleEmailSender implements EmailSender {
  constructor(private readonly options: { showContent: boolean } = { showContent: true }) {}

  async send(message: EmailMessage) {
    const header = `✉️  E-mail não enviado (sem RESEND_API_KEY ou com EMAIL_ENABLED=false)\nPara: ${message.to}\nAssunto: ${message.subject}`;
    console.info(this.options.showContent ? `\n${header}\n\n${message.text}\n` : header);
  }
}
