import { createHash, randomBytes, randomUUID } from "node:crypto";
import { jwtVerify, SignJWT } from "jose";
import { AppError } from "../domain/errors.js";
import { ROLES, type Role } from "../domain/user.js";
import type { AccessTokenPayload, TokenService } from "../interfaces/index.js";

const ISSUER = "psjb-cantos-api";
const AUDIENCE = "psjb-cantos-web";

export class JoseTokenService implements TokenService {
  private readonly key: Uint8Array;

  constructor(
    secret: string,
    private readonly ttlSeconds: number,
  ) {
    this.key = new TextEncoder().encode(secret);
  }

  async signAccessToken({ userId, roles }: AccessTokenPayload) {
    const token = await new SignJWT({ roles })
      .setProtectedHeader({ alg: "HS256" })
      .setSubject(userId)
      .setJti(randomUUID())
      .setIssuer(ISSUER)
      .setAudience(AUDIENCE)
      .setIssuedAt()
      .setExpirationTime(`${this.ttlSeconds}s`)
      .sign(this.key);
    return { token, expiresIn: this.ttlSeconds };
  }

  async verifyAccessToken(token: string): Promise<AccessTokenPayload> {
    try {
      const { payload } = await jwtVerify(token, this.key, { issuer: ISSUER, audience: AUDIENCE, algorithms: ["HS256"] });
      const roles = Array.isArray(payload.roles) ? payload.roles.filter((r): r is Role => ROLES.includes(r as Role)) : [];
      if (!payload.sub) throw new Error("sem sub");
      return { userId: payload.sub, roles };
    } catch {
      throw new AppError("UNAUTHORIZED", "Sessão expirada. Entre de novo.");
    }
  }

  generateRefreshToken() {
    const token = randomBytes(32).toString("base64url");
    return { token, hash: this.hashRefreshToken(token) };
  }

  // SHA-256 basta aqui: o token tem 256 bits aleatórios, então não há o que "quebrar" por dicionário.
  hashRefreshToken(token: string) {
    return createHash("sha256").update(token).digest("hex");
  }
}
