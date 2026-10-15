import type { EmailMessage, EmailSender } from "../interfaces/index.js";

/**
 * Sem RESEND_API_KEY (desenvolvimento): o e-mail não sai, só aparece no terminal da API,
 * com o link ou o código, para dar para seguir o fluxo.
 */
export class ConsoleEmailSender implements EmailSender {
  async send(message: EmailMessage) {
    console.info(`\n✉️  E-mail (não enviado: falta RESEND_API_KEY)\nPara: ${message.to}\nAssunto: ${message.subject}\n\n${message.text}\n`);
  }
}
