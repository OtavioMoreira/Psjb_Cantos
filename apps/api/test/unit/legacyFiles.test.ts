import { describe, expect, it } from "vitest";
import { detectType, isLegacyUrl, legacyPath, mapLimit, pickSmaller, placeFiles, storagePath } from "../../src/database/legacyFiles.js";

describe("migração dos arquivos do site antigo", () => {
  it("reconhece só os links do site antigo", () => {
    expect(isLegacyUrl("https://cantos.psjb.org.br/uploads/audios/3/a.pdf")).toBe(true);
    expect(isLegacyUrl("https://x.public.blob.vercel-storage.com/songs/3/cifra-pdf-legado.pdf")).toBe(false);
    expect(isLegacyUrl("https://audiomack.com/psjb/song/x")).toBe(false);
    expect(isLegacyUrl(null)).toBe(false);
  });

  it("tira o caminho da URL, decodificando acentos e espaços", () => {
    expect(legacyPath("https://cantos.psjb.org.br/uploads/audios/253/200-CORDEIRO-DE-DEUS.pdf")).toBe(
      "uploads/audios/253/200-CORDEIRO-DE-DEUS.pdf",
    );
    expect(legacyPath("https://cantos.psjb.org.br/uploads/audios/9/Ave%20Maria%20-%20Gl%C3%B3ria.mp3")).toBe(
      "uploads/audios/9/Ave Maria - Glória.mp3",
    );
  });

  it("recusa caminhos que saem da pasta ou que não são do site antigo", () => {
    expect(() => legacyPath("https://cantos.psjb.org.br/uploads/%2E%2E/%2E%2E/etc/passwd")).toThrow();
    expect(() => legacyPath("https://cantos.psjb.org.br/")).toThrow();
    expect(() => legacyPath("https://outro.site/uploads/a.pdf")).toThrow();
  });

  it("dá um nome fixo por canto e tipo no storage novo", () => {
    expect(storagePath(253, "cifra-pdf", "pdf")).toBe("songs/253/cifra-pdf-legado.pdf");
    expect(storagePath(43, "audio", "mp3")).toBe("songs/43/audio-legado.mp3");
  });

  it("só fica com o áudio convertido quando ele é menor", () => {
    const original = Buffer.alloc(100);
    expect(pickSmaller(original, Buffer.alloc(40))).toEqual({ data: Buffer.alloc(40), converted: true });
    expect(pickSmaller(original, Buffer.alloc(120)).converted).toBe(false);
    expect(pickSmaller(original, Buffer.alloc(0)).converted).toBe(false);
    expect(pickSmaller(original, null).data).toBe(original);
  });

  it("processa tudo, na ordem, sem passar do limite de tarefas simultâneas", async () => {
    let running = 0;
    let peak = 0;
    const out = await mapLimit([1, 2, 3, 4, 5, 6, 7], 3, async (n) => {
      running++;
      peak = Math.max(peak, running);
      await new Promise((r) => setTimeout(r, 5));
      running--;
      return n * 2;
    });
    expect(out).toEqual([2, 4, 6, 8, 10, 12, 14]);
    expect(peak).toBe(3);
  });

  it("descobre o tipo real pelos bytes, inclusive os erros de cadastro do site antigo", () => {
    const b = (...parts: (string | number[])[]) =>
      Buffer.concat(parts.map((p) => (typeof p === "string" ? Buffer.from(p, "latin1") : Buffer.from(p))));
    expect(detectType(b("%PDF-1.7"))).toBe("pdf");
    expect(detectType(b("ID3\x03"))).toBe("mp3");
    expect(detectType(b([0xff, 0xfb, 0x90]))).toBe("mp3");
    expect(detectType(b([0x30, 0x26, 0xb2, 0x75, 0x8e]))).toBe("wma");
    expect(detectType(b("PK\x03\x04", "....[Content_Types].xml word/document.xml"))).toBe("docx");
    expect(detectType(b("PK\x03\x04", "planilha xl/workbook.xml"))).toBeNull();
    expect(detectType(b([0xff, 0xd8, 0xff, 0xe0]))).toBe("jpg");
    expect(detectType(b("\x89PNG"))).toBe("png");
    expect(detectType(b("<html>404</html>"))).toBeNull();
  });

  describe("campo de cada arquivo", () => {
    const pdf = (column: "cifra_pdf_url" | "partitura_pdf_url" | "audio_url", hash = "a") => ({ column, audio: false, hash });
    const mp3 = (column: "cifra_pdf_url" | "partitura_pdf_url" | "audio_url", hash = "m") => ({ column, audio: true, hash });

    it("mantém quem está no campo certo", () => {
      expect(placeFiles([pdf("cifra_pdf_url"), pdf("partitura_pdf_url", "b"), mp3("audio_url")])).toEqual([
        "cifra_pdf_url",
        "partitura_pdf_url",
        "audio_url",
      ]);
    });

    it("inverte áudio e PDF trocados entre si", () => {
      expect(placeFiles([mp3("cifra_pdf_url"), pdf("audio_url")])).toEqual(["audio_url", "cifra_pdf_url"]);
    });

    it("descarta o PDF do campo de áudio quando é cópia da cifra", () => {
      expect(placeFiles([pdf("cifra_pdf_url", "x"), pdf("audio_url", "x")])).toEqual(["cifra_pdf_url", null]);
    });

    it("leva um PDF diferente do campo de áudio para a partitura, se a cifra estiver ocupada", () => {
      expect(placeFiles([pdf("cifra_pdf_url", "x"), pdf("audio_url", "y")])).toEqual(["cifra_pdf_url", "partitura_pdf_url"]);
      expect(placeFiles([pdf("audio_url", "y")], ["cifra_pdf_url", "partitura_pdf_url"])).toEqual([null]);
    });
  });
});
