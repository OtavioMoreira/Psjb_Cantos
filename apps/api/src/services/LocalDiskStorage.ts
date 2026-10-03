import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import type { FileStorage } from "../interfaces/index.js";

/** Desenvolvimento: grava em uploads/ e a API serve em /uploads. Na Vercel o disco é efêmero, então lá usa o Blob. */
export class LocalDiskStorage implements FileStorage {
  constructor(
    private readonly root: string,
    private readonly publicBaseUrl: string,
  ) {}

  // contentType não é usado no disco (o @fastify/static deduz pela extensão), mas faz parte do contrato.
  async put(relPath: string, data: Buffer, _contentType?: string) {
    const full = this.resolve(relPath);
    await mkdir(path.dirname(full), { recursive: true });
    await writeFile(full, data);
    return `${this.publicBaseUrl}/uploads/${relPath}`;
  }

  async delete(url: string) {
    const prefix = `${this.publicBaseUrl}/uploads/`;
    if (url.startsWith(prefix)) await rm(this.resolve(url.slice(prefix.length)), { force: true });
  }

  private resolve(relPath: string) {
    const full = path.resolve(this.root, relPath);
    if (!full.startsWith(path.resolve(this.root) + path.sep)) throw new Error("Caminho fora de uploads/");
    return full;
  }
}
