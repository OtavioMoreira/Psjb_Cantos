import { AppError } from "../../domain/errors.js";
import type { SitePublisher } from "../../interfaces/index.js";

/**
 * Admin pede para o site ser gerado de novo. As páginas de cantos são estáticas (rápidas e
 * disponíveis offline no Modo Missa), então alterações de cantos e flags só aparecem depois do build.
 */
export class PublishSiteAction {
  constructor(private readonly deps: { site: SitePublisher }) {}

  async execute(): Promise<void> {
    if (!this.deps.site.enabled)
      throw new AppError("NOT_CONFIGURED", "A publicação automática não está configurada (SITE_DEPLOY_HOOK_URL).");
    try {
      await this.deps.site.publish();
    } catch {
      throw new AppError("NOT_CONFIGURED", "Não foi possível pedir a publicação agora. Tente de novo em instantes.");
    }
  }
}
