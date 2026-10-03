import { del, put } from "@vercel/blob";
import type { FileStorage } from "../interfaces/index.js";

/** Produção: Vercel Blob (CDN, URL pública). Precisa de BLOB_READ_WRITE_TOKEN no ambiente. */
export class VercelBlobStorage implements FileStorage {
  constructor(private readonly token: string) {}

  async put(path: string, data: Buffer, contentType: string) {
    const blob = await put(path, data, { access: "public", contentType, token: this.token, addRandomSuffix: false });
    return blob.url;
  }

  async delete(url: string) {
    await del(url, { token: this.token });
  }
}
