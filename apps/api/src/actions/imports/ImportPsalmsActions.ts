import { createHash } from "node:crypto";
import { AppError } from "../../domain/errors.js";
import { celebrationKey, parseListingTitle, sheetToLyrics, songTitleFor, type ListingInfo } from "../../domain/psalmImport.js";
import { songSlug, type Song } from "../../domain/song.js";
import type {
  Clock,
  ExternalPsalm,
  FileStorage,
  FlagRepository,
  ImportItem,
  ImportItemData,
  ImportRepository,
  ImportRun,
  PdfReader,
  PsalmSource,
  SongRepository,
} from "../../interfaces/index.js";

type Deps = {
  psalmSource: PsalmSource;
  pdf: PdfReader;
  imports: ImportRepository;
  songs: SongRepository;
  flags: FlagRepository;
  storage: FileStorage;
  clock: Clock;
};

export type ImportOutcome = "created" | "linked" | "review" | "failed" | "skipped";

/** Sem texto no PDF (partitura escaneada), a letra precisa ser digitada antes de aprovar. */
const createdMessage = (song: Song, pdf: Buffer | null) =>
  song.lyrics.trim()
    ? "Canto novo, oculto até alguém aprovar."
    : pdf
      ? "PDF escaneado (imagem, sem texto): digite a letra no editor antes de aprovar. Canto oculto."
      : "Sem PDF na fonte: digite a letra no editor antes de aprovar. Canto oculto.";

/** Hoje no fuso de Brasília (AAAA-MM-DD). */
const today = (now: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(now);
const addDays = (iso: string, n: number) => new Date(Date.parse(`${iso}T12:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
const sha256 = (b: Buffer) => createHash("sha256").update(b).digest("hex");
/** "Salmo 088" e "Salmo 88" → 88. */
const psalmNumberOf = (title: string) => Number(title.match(/salmo\s*0*(\d+)/i)?.[1]) || null;

/**
 * Regras compartilhadas pela rotina e pela revisão do admin. Contra duplicados, em camadas:
 * 1. o item da fonte (código do arquivo + data) só é processado uma vez;
 * 2. um canto do repertório com a mesma celebração, o mesmo tipo e o mesmo ano é reconhecido, não recriado;
 * 3. o mesmo PDF (SHA-256) de outro domingo vira o canto que a própria rotina criou para ele
 *    (vem depois da 2ª: a aclamação do Natal serve até o Batismo, mas cada festa já tem a sua no repertório);
 * 4. na dúvida (mais de um parecido, outro número de salmo, celebração desconhecida), vai para a revisão.
 */
class PsalmImporter {
  constructor(protected readonly deps: Deps) {}

  protected async flagIds() {
    const all = await this.deps.flags.list();
    const id = (group: string, slug: string) => all.find((f) => f.group === group && f.slug === slug)?.id;
    return { id, moment: (kind: ListingInfo["kind"]) => id("momento", kind) };
  }

  /** Salmos e aclamações do repertório ligados a uma celebração (os genéricos ficam de fora). */
  protected async candidates(info: ListingInfo): Promise<Song[]> {
    if (!info.key) return [];
    const ids = await this.flagIds();
    const momentId = ids.moment(info.kind);
    if (!momentId) return [];
    const { songs } = await this.deps.songs.list({ flagIds: [momentId], includeInactive: true, page: 1, pageSize: 2000 });
    return songs.filter((s) => {
      if (celebrationKey(s.title)?.key !== info.key) return false;
      const years = s.flags.filter((f) => f.group === "ano").map((f) => f.slug.toUpperCase());
      return !years.length || years.includes(info.year);
    });
  }

  /** Marca o canto também para a celebração deste item (tempo e ano), sem tirar nada. */
  protected async addCelebrationFlags(song: Song, info: ListingInfo) {
    const ids = await this.flagIds();
    const wanted = [ids.moment(info.kind), info.season && ids.id("tempo", info.season), ids.id("ano", info.year)].filter((x): x is number => Boolean(x));
    const current = song.flags.map((f) => f.id);
    const missing = wanted.filter((id) => !current.includes(id));
    if (!missing.length) return;
    await this.deps.songs.update(
      song.id,
      { number: song.number, slug: song.slug, title: song.title, composer: song.composer, key: song.key, lyrics: song.lyrics, media: song.media, flagIds: [...current, ...missing], active: song.active },
      null,
    );
  }

  /** Cria o canto (oculto, aguardando aprovação) com a letra do PDF, a partitura e o áudio copiados. */
  protected async createSong(item: ExternalPsalm, info: ListingInfo, pdf: Buffer | null): Promise<Song> {
    const ids = await this.flagIds();
    const sheet = pdf ? sheetToLyrics(await this.deps.pdf.lines(pdf), info.kind) : null;
    const title = songTitleFor(info);
    const flagIds = [ids.moment(info.kind), info.season && ids.id("tempo", info.season), ids.id("ano", info.year)].filter((x): x is number => Boolean(x));
    const base = { number: null, title, composer: sheet?.composer ?? null, key: sheet?.key ?? null, lyrics: sheet?.lyrics ?? "", flagIds, active: false };
    const data = {
      ...base,
      media: { audio: null, audiomack: null, cifraPdf: null, partituraPdf: null },
      source: { name: this.deps.psalmSource.name, url: this.deps.psalmSource.url },
    };
    let song: Song;
    try {
      song = await this.deps.songs.create({ ...data, slug: songSlug(title, null) }, null);
    } catch (err) {
      if (!(err instanceof AppError && err.code === "SONG_TAKEN")) throw err;
      song = await this.deps.songs.create({ ...data, slug: songSlug(`${title} ${item.date}`, null) }, null);
    }
    if (pdf) {
      const url = await this.deps.storage.put(`songs/${song.id}/partitura-pdf-diocese.pdf`, pdf, "application/pdf");
      song = (await this.deps.songs.setMedia(song.id, "partituraPdf", url, null))!;
    }
    if (item.audioUrl) {
      const audio = await this.deps.psalmSource.download(item.audioUrl);
      const url = await this.deps.storage.put(`songs/${song.id}/audio-diocese.mp3`, audio, "audio/mpeg");
      song = (await this.deps.songs.setMedia(song.id, "audio", url, null))!;
    }
    return song;
  }

  protected base(item: ExternalPsalm, info: ListingInfo, hash: string | null): Omit<ImportItemData, "status" | "songId" | "candidateSongIds" | "message"> {
    return { source: this.deps.psalmSource.id, externalId: item.externalId, title: item.title, kind: info.kind, celebrationDate: item.date, pdfUrl: item.pdfUrl, audioUrl: item.audioUrl, pdfHash: hash };
  }

  /** Decide e grava o que fazer com um item novo. */
  protected async process(item: ExternalPsalm): Promise<ImportItem> {
    const info = parseListingTitle(item.title, item.date);
    const pdf = item.pdfUrl ? await this.deps.psalmSource.download(item.pdfUrl) : null;
    const hash = pdf ? sha256(pdf) : null;
    const save = (status: ImportItem["status"], songId: number | null, message: string | null, candidateSongIds: number[] = []) =>
      this.deps.imports.saveItem({ ...this.base(item, info, hash), status, songId, candidateSongIds, message });

    // 2. Já existe no repertório (mesma celebração, mesmo tipo, mesmo ano)?
    const found = await this.candidates(info);
    if (found.length) {
      const sameNumber = info.psalmNumber ? found.filter((s) => psalmNumberOf(s.title) === info.psalmNumber) : found;
      if (sameNumber.length === 1) return save("linked", sameNumber[0].id, `Já estava no repertório: "${sameNumber[0].title}".`);
      // 4. Na dúvida, uma pessoa decide.
      const why = sameNumber.length ? "Há mais de um canto parecido no repertório." : "Há um canto para esta celebração, mas com outro salmo.";
      return save("review", null, why, found.map((s) => s.id));
    }

    // 3. O mesmo PDF já virou um canto criado por esta rotina (outro domingo): é o mesmo canto.
    const sameFile = hash ? await this.deps.imports.songIdByPdfHash(this.deps.psalmSource.id, hash) : null;
    if (sameFile) {
      const song = await this.deps.songs.findById(sameFile);
      if (song) {
        await this.addCelebrationFlags(song, info);
        return save("linked", song.id, `Mesmo PDF de "${song.title}".`);
      }
    }
    if (!info.key) return save("review", null, "Não reconheci o domingo ou a festa no título.");

    const song = await this.createSong(item, info, pdf);
    return save("created", song.id, createdMessage(song, pdf));
  }
}

/** Rotina (cron de segunda a quinta, ou o botão "Buscar agora"): itens de hoje até `days` dias adiante. */
export class ImportPsalmsAction extends PsalmImporter {
  async execute({ trigger, days = 10 }: { trigger: ImportRun["trigger"]; days?: number }) {
    const runId = await this.deps.imports.startRun(this.deps.psalmSource.id, trigger);
    const summary: Record<ImportOutcome, number> = { created: 0, linked: 0, review: 0, failed: 0, skipped: 0 };
    const results: { title: string; date: string; outcome: ImportOutcome; songId: number | null; message: string | null }[] = [];
    try {
      const from = today(this.deps.clock.now());
      const until = addDays(from, days);
      const list = (await this.deps.psalmSource.listUpcoming()).filter((i) => i.date >= from && i.date <= until);
      for (const item of list) {
        // 1. Já processado antes: não faz nada (só tenta de novo o que falhou).
        const known = await this.deps.imports.findItem(this.deps.psalmSource.id, item.externalId);
        if (known && known.status !== "failed") {
          summary.skipped++;
          results.push({ title: item.title, date: item.date, outcome: "skipped", songId: known.songId, message: null });
          continue;
        }
        try {
          const saved = await this.process(item);
          summary[saved.status as ImportOutcome]++;
          results.push({ title: item.title, date: item.date, outcome: saved.status as ImportOutcome, songId: saved.songId, message: saved.message });
        } catch (err) {
          const message = (err as Error).message.slice(0, 500);
          const info = parseListingTitle(item.title, item.date);
          await this.deps.imports.saveItem({ ...this.base(item, info, null), status: "failed", songId: null, candidateSongIds: [], message });
          summary.failed++;
          results.push({ title: item.title, date: item.date, outcome: "failed", songId: null, message });
        }
      }
      await this.deps.imports.finishRun(runId, summary, null);
    } catch (err) {
      await this.deps.imports.finishRun(runId, summary, (err as Error).message.slice(0, 500));
      throw new AppError("IMPORT_FAILED", `Não foi possível ler a fonte de salmos: ${(err as Error).message}`);
    }
    return { runId, summary, items: results };
  }
}

export class ListImportsAction {
  constructor(private readonly deps: Pick<Deps, "imports">) {}
  async execute(opts: { status?: ImportItem["status"] }) {
    const [items, runs] = await Promise.all([this.deps.imports.listItems({ status: opts.status, limit: 200 }), this.deps.imports.listRuns(10)]);
    return { items, runs };
  }
}

/** Revisão do admin: "é este canto" (link), "é um canto novo" (create) ou "ignorar". */
export class ResolveImportAction extends PsalmImporter {
  async execute(id: number, decision: { action: "link"; songId: number } | { action: "create" } | { action: "ignore" }) {
    const item = await this.deps.imports.getItem(id);
    if (!item) throw new AppError("NOT_FOUND", "Item de importação não encontrado.");
    if (item.status === "created" || item.status === "linked")
      throw new AppError("IMPORT_RESOLVED", "Este item já foi resolvido.");
    const external: ExternalPsalm = { externalId: item.externalId, title: item.title, date: item.celebrationDate, pdfUrl: item.pdfUrl, audioUrl: item.audioUrl };
    const info = parseListingTitle(item.title, item.celebrationDate);
    const save = (status: ImportItem["status"], songId: number | null, message: string) =>
      this.deps.imports.saveItem({ ...this.base(external, info, item.pdfHash), status, songId, candidateSongIds: item.candidateSongIds, message });

    if (decision.action === "ignore") return save("ignored", null, "Ignorado na revisão.");
    if (decision.action === "link") {
      const song = await this.deps.songs.findById(decision.songId);
      if (!song) throw new AppError("NOT_FOUND", "Canto não encontrado.");
      await this.addCelebrationFlags(song, info);
      return save("linked", song.id, `Ligado na revisão a "${song.title}".`);
    }
    const pdf = item.pdfUrl ? await this.deps.psalmSource.download(item.pdfUrl) : null;
    const song = await this.createSong(external, info, pdf);
    return save("created", song.id, `Criado na revisão. ${createdMessage(song, pdf)}`);
  }
}
