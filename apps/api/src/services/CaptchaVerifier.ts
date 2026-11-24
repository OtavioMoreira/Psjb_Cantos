import type { HumanVerifier } from "../interfaces/index.js";

const VERIFY_URL = {
  turnstile: "https://challenges.cloudflare.com/turnstile/v0/siteverify",
  recaptcha: "https://www.google.com/recaptcha/api/siteverify",
} as const;
export type CaptchaProvider = keyof typeof VERIFY_URL;

/**
 * Confere o token do desafio "não sou um robô" no provedor (Cloudflare Turnstile ou Google reCAPTCHA;
 * os dois usam o mesmo formato). Falha de rede conta como "não verificado".
 */
export class CaptchaVerifier implements HumanVerifier {
  readonly enabled = true;

  constructor(
    private readonly secret: string,
    private readonly provider: CaptchaProvider = "turnstile",
    private readonly fetchFn: typeof fetch = fetch,
  ) {}

  async verify(token: string, ip: string | null) {
    const body = new URLSearchParams({ secret: this.secret, response: token, ...(ip && { remoteip: ip }) });
    try {
      const res = await this.fetchFn(VERIFY_URL[this.provider], { method: "POST", body, signal: AbortSignal.timeout(8000) });
      if (!res.ok) return false;
      const json = (await res.json()) as { success?: boolean; score?: number };
      // reCAPTCHA v3 devolve uma nota de 0 a 1; abaixo de 0,5 é provável robô.
      return json.success === true && (json.score === undefined || json.score >= 0.5);
    } catch {
      return false;
    }
  }
}

/** Sem CAPTCHA_SECRET (desenvolvimento, testes ou antes de criar as chaves): ninguém precisa resolver o desafio. */
export class DisabledHumanVerifier implements HumanVerifier {
  readonly enabled = false;
  async verify() {
    return true;
  }
}
