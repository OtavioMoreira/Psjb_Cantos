import { del, head, put } from "@vercel/blob";
import { generateClientTokenFromReadWriteToken } from "@vercel/blob/client";
import type { DirectUploadStorage } from "../interfaces/index.js";

/** Produção: Vercel Blob (CDN, URL pública). Precisa de BLOB_READ_WRITE_TOKEN no ambiente. */
export class VercelBlobStorage implements DirectUploadStorage {
  /** Id da store, que aparece no endereço público dos arquivos (<id>.public.blob.vercel-storage.com). */
  private readonly storeId: string;

  constructor(
    private readonly token: string,
    private readonly fetchFn: typeof fetch = fetch,
  ) {
    this.storeId = token.split("_")[3]?.toLowerCase() ?? "";
  }

  async put(path: string, data: Buffer, contentType: string) {
    // allowOverwrite: a migração dos arquivos antigos usa nomes fixos e pode rodar de novo.
    const blob = await put(path, data, { access: "public", contentType, token: this.token, addRandomSuffix: false, allowOverwrite: true });
    return blob.url;
  }

  async delete(url: string) {
    await del(url, { token: this.token });
  }

  /** Token de 10 min que só serve para gravar este caminho, com estes tipos e até este tamanho. */
  async createUploadToken(path: string, opts: { contentTypes: string[]; maxBytes: number }) {
    return generateClientTokenFromReadWriteToken({
      token: this.token,
      pathname: path,
      allowedContentTypes: opts.contentTypes,
      maximumSizeInBytes: opts.maxBytes,
      validUntil: Date.now() + 10 * 60 * 1000,
      addRandomSuffix: false,
      allowOverwrite: false,
    });
  }

  /** Caminho do arquivo se a URL é desta store; null se for de outro lugar. */
  pathOf(url: string) {
    try {
      const u = new URL(url);
      if (u.protocol !== "https:" || u.hostname !== `${this.storeId}.public.blob.vercel-storage.com`) return null;
      return decodeURIComponent(u.pathname.slice(1));
    } catch {
      return null;
    }
  }

  async inspect(url: string) {
    const meta = await head(url, { token: this.token });
    // Só os primeiros bytes: o tipo é conferido pela assinatura, não pelo nome nem pelo Content-Type.
    const res = await this.fetchFn(url, { headers: { range: "bytes=0-63" } });
    const firstBytes = Buffer.from(await res.arrayBuffer()).subarray(0, 64);
    return { size: meta.size, firstBytes };
  }
}
