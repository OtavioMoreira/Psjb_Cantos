import { randomBytes } from "node:crypto";
import { AppError } from "../../domain/errors.js";
import { massAccess } from "../../domain/mass.js";
import { toMassDTO, type MassDTO } from "../../dtos/mass.dto.js";
import type { MassRepository } from "../../interfaces/index.js";
import { loadMass } from "./access.js";

type Deps = { masses: MassRepository };

/** Caminho do front que recebe o convite (o front monta a URL completa com o domínio). */
export const invitePath = (token: string) => `/convite?token=${token}`;

/** Gera o link de convite, ou devolve o que já existe (o link não muda a cada clique). Só o dono. */
export class CreateShareLinkAction {
  constructor(private readonly deps: Deps) {}
  async execute(userId: string, id: string): Promise<{ token: string; path: string }> {
    const { mass } = await loadMass(this.deps.masses, id, userId, { ownerOnly: true, action: "gerar o link de convite" });
    let token = mass.shareToken;
    if (!token) {
      token = randomBytes(24).toString("base64url"); // 192 bits: impossível de adivinhar
      await this.deps.masses.setShareToken(id, token);
    }
    return { token, path: invitePath(token) };
  }
}

/** Desativa o link: quem já entrou continua convidado, mas o link deixa de funcionar. Só o dono. */
export class RevokeShareLinkAction {
  constructor(private readonly deps: Deps) {}
  async execute(userId: string, id: string): Promise<void> {
    await loadMass(this.deps.masses, id, userId, { ownerOnly: true, action: "desativar o link de convite" });
    await this.deps.masses.setShareToken(id, null);
  }
}

/** Quem abriu o link (já logado) vira convidado. Dono ou quem já era convidado só recebe a missa. */
export class JoinMassAction {
  constructor(private readonly deps: Deps) {}
  async execute(userId: string, token: string): Promise<MassDTO> {
    const mass = await this.deps.masses.findByShareToken(token);
    if (!mass) throw new AppError("NOT_FOUND", "Este link de convite não é válido ou foi desativado. Peça um novo a quem montou a missa.");
    if (!massAccess(mass, userId)) await this.deps.masses.addShare(mass.id, userId);
    const updated = (await this.deps.masses.findById(mass.id))!;
    return toMassDTO(updated, userId);
  }
}
