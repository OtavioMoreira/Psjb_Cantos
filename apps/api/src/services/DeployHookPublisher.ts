import type { SitePublisher } from "../interfaces/index.js";

/** Chama o Deploy Hook da Vercel (POST na URL secreta do hook). Sem URL, fica desligado. */
export class DeployHookPublisher implements SitePublisher {
  constructor(private readonly url: string | undefined) {}

  get enabled() {
    return Boolean(this.url);
  }

  async publish() {
    if (!this.url) return;
    const res = await fetch(this.url, { method: "POST" });
    if (!res.ok) throw new Error(`Deploy hook respondeu ${res.status}`);
  }
}
