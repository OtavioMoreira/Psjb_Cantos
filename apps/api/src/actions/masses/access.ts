import { AppError } from "../../domain/errors.js";
import { massAccess, type Mass, type MassAccess } from "../../domain/mass.js";
import type { MassRepository } from "../../interfaces/index.js";

/**
 * Carrega a missa e confere a permissão. Sem acesso: 403 (regra §7: "403 para quem não é dono nem convidado").
 * Com `ownerOnly`, quem só recebeu a missa também leva 403 (excluir e compartilhar).
 */
export async function loadMass(
  masses: MassRepository,
  id: string,
  userId: string,
  opts: { ownerOnly?: boolean; action?: string } = {},
): Promise<{ mass: Mass; access: MassAccess }> {
  const mass = await masses.findById(id);
  if (!mass) throw new AppError("NOT_FOUND", "Missa não encontrada.");
  const access = massAccess(mass, userId);
  if (!access) throw new AppError("FORBIDDEN", "Você não tem acesso a esta missa.");
  if (opts.ownerOnly && access !== "owner")
    throw new AppError("FORBIDDEN", `Só quem criou a missa pode ${opts.action ?? "fazer isso"}.`);
  return { mass, access };
}
