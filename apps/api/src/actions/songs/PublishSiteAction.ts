import { AppError } from "../../domain/errors.js";
import type { SitePublisher, SiteState, SiteStateRepository, UserRepository } from "../../interfaces/index.js";

export interface SiteStatusDTO {
  /** false = publicação não configurada neste ambiente (sem SITE_DEPLOY_HOOK_URL). */
  enabled: boolean;
  /** Há mudanças em cantos ou flags depois do último "Publicar no site". */
  pending: boolean;
  contentChangedAt: string;
  publishedAt: string | null;
  publishedBy: string | null;
}

const toStatus = (enabled: boolean, s: SiteState): SiteStatusDTO => ({
  enabled,
  pending: !s.publishedAt || s.contentChangedAt > s.publishedAt,
  contentChangedAt: s.contentChangedAt.toISOString(),
  publishedAt: s.publishedAt?.toISOString() ?? null,
  publishedBy: s.publishedByName,
});

type Deps = { site: SitePublisher; siteState: SiteStateRepository; users: UserRepository };

/**
 * Admin pede para o site ser gerado de novo. As páginas de cantos são estáticas (rápidas e
 * disponíveis offline no Modo Missa), então alterações de cantos e flags só aparecem depois do build.
 */
export class PublishSiteAction {
  constructor(private readonly deps: Deps) {}

  async execute(userId: string): Promise<SiteStatusDTO> {
    if (!this.deps.site.enabled)
      throw new AppError("NOT_CONFIGURED", "A publicação automática não está configurada (SITE_DEPLOY_HOOK_URL).");
    try {
      await this.deps.site.publish();
    } catch {
      throw new AppError("NOT_CONFIGURED", "Não foi possível pedir a publicação agora. Tente de novo em instantes.");
    }
    const user = await this.deps.users.findById(userId);
    return toStatus(true, await this.deps.siteState.markPublished(user?.name ?? "Administrador"));
  }
}

/** "Há alterações não publicadas": mostrado no admin de cantos e de flags. */
export class GetSiteStatusAction {
  constructor(private readonly deps: Deps) {}

  async execute(): Promise<SiteStatusDTO> {
    return toStatus(this.deps.site.enabled, await this.deps.siteState.get());
  }
}
