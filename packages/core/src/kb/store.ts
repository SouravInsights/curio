import { createHash } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "@curio/core/db/index";
import { documents, passages } from "@curio/core/db/schema";
import type { PageRead } from "./read";
import { chunkMarkdown, type ChunkUnit } from "./chunk";
import { embedTexts, embeddingModeFor, type EmbeddingMode } from "./embed";
import { understandPage, PROMPT_VERSION } from "./understand";
import { getPage, isHtml } from "./get";
import { readPage } from "./read";

/**
 * store — every write the pipeline makes, plus buildDocument, the one
 * orchestrator. Anyone asking "where does X get written?" starts here.
 *
 * `links` to `documents`. The four verbs and every rule are unchanged:
 * stages skip when their columns are set, one bad page never stops a run, a
 * changed page re-understands, and passages are replaced wholesale.
 */

/** Below this many words a document reads as `thin`: a paywall, a JS shell, a stub. */
export const THIN_WORDS = 200;

const INSERT_BATCH = 50;

const sha256 = (text: string) => createHash("sha256").update(text).digest("hex");

export interface DocumentRow {
  id: number;
  url: string | null;
  externalId: string;
  title: string;
  description: string;
  kind: string;
  markdown: string | null;
  contentHash: string | null;
  summary: string | null;
  promptVersion?: number | null;
}

/** Write the read stage's outcome. Returns the status and whether text changed. */
export async function saveRead(
  doc: DocumentRow,
  read: PageRead | null,
): Promise<{ status: "ok" | "thin" | "failed"; changed: boolean }> {
  if (!read) {
    await db
      .update(documents)
      .set({ readStatus: "failed", updatedAt: new Date() })
      .where(eq(documents.id, doc.id));
    return { status: "failed", changed: false };
  }

  const contentHash = sha256(read.markdown);
  const changed = contentHash !== doc.contentHash;

  await db
    .update(documents)
    .set({
      markdown: read.markdown,
      wordCount: read.wordCount,
      contentHash,
      readStatus: read.wordCount < THIN_WORDS ? "thin" : "ok",
      updatedAt: new Date(),
      ...(read.title && !doc.title ? { title: read.title } : {}),
      ...(read.description ? { description: read.description } : {}),
      ...(read.author ? { author: read.author } : {}),
      ...(read.site ? { site: read.site } : {}),
    })
    .where(eq(documents.id, doc.id));

  return { status: read.wordCount < THIN_WORDS ? "thin" : "ok", changed };
}

/** Write the understand stage's outcome. */
export async function saveUnderstand(
  doc: DocumentRow,
  result: { topics: string[]; summary: string },
): Promise<void> {
  await db
    .update(documents)
    .set({
      topics: result.topics,
      summary: result.summary,
      promptVersion: PROMPT_VERSION,
      updatedAt: new Date(),
    })
    .where(eq(documents.id, doc.id));
}

interface PassageInput {
  content: string;
  unitType: "summary" | "prose" | "code";
  heading: string | null;
  tokenCount: number;
  embeddingText: string;
  startOffset: number;
  endOffset: number;
  startLine: number;
  endLine: number;
}

/**
 * Embed and store a document's passages — its summary first (always), then its
 * content units when the mode is `full`. Passages are replaced wholesale: a page
 * that got shorter can't leave a stale tail.
 */
export async function savePassages(
  doc: DocumentRow,
  opts: { summary: string; units?: ChunkUnit[]; title: string },
): Promise<number> {
  const summary: PassageInput = {
    content: opts.summary,
    unitType: "summary",
    heading: null,
    tokenCount: Math.ceil(opts.summary.split(/\s+/).length * 1.3),
    embeddingText: `${opts.title}: ${opts.summary}`,
    // A summary is model-written, not a span of the markdown — no line anchor.
    startOffset: 0,
    endOffset: 0,
    startLine: 0,
    endLine: 0,
  };

  const rows: PassageInput[] = [
    summary,
    ...(opts.units ?? []).map((u) => ({
      content: u.content,
      unitType: u.unitType as "prose" | "code",
      heading: u.heading,
      tokenCount: u.tokenCount,
      embeddingText: u.embeddingText,
      startOffset: u.startOffset,
      endOffset: u.endOffset,
      startLine: u.startLine,
      endLine: u.endLine,
    })),
  ];

  const embeddings = await embedTexts(rows.map((r) => r.embeddingText));

  await db.delete(passages).where(eq(passages.documentId, doc.id));
  for (let i = 0; i < rows.length; i += INSERT_BATCH) {
    await db.insert(passages).values(
      rows.slice(i, i + INSERT_BATCH).map((row, j) => ({
        documentId: doc.id,
        idx: i + j,
        content: row.content,
        tokenCount: Math.min(row.tokenCount, 32767),
        unitType: row.unitType,
        heading: row.heading,
        startOffset: row.startOffset,
        endOffset: row.endOffset,
        startLine: row.startLine,
        endLine: row.endLine,
        embedding: embeddings[i + j]!,
      })),
    );
  }

  return rows.length;
}

export interface BuildOptions {
  force?: boolean;
  /** Render thin pages headlessly and re-read (needs Chrome). */
  render?: boolean;
  /** Topics already in use — passed to describe as the vocabulary leash. */
  knownTopics?: string[];
  winningSpellings?: Record<string, string>;
  /** Owner overrides keyed by externalId; always win for model-classified rows. */
  overrides?: Record<string, { topics?: string[]; summary?: string }>;
  onStage?: (stage: BuildStage, detail?: string) => void;
}

export type BuildStage = "get" | "read" | "understand" | "embed";

export interface BuildOutcome {
  read: "ok" | "thin" | "failed" | "skipped";
  understood: boolean;
  passages: number;
  changed: boolean;
  readDetail?: string;
}

/**
 * The four verbs for one document: get → read → understand → embed.
 * Stages skip themselves when their columns are set, unless `force`.
 * Never throws — one bad page must not stop a run.
 */
export async function buildDocument(
  doc: DocumentRow,
  opts: BuildOptions = {},
): Promise<BuildOutcome> {
  let read: PageRead | null = null;
  let readStatus: BuildOutcome["read"] = "skipped";
  let readDetail: string | undefined;
  let changed = false;
  let passageCount = 0;

  const needsRead = opts.force || !doc.markdown;
  if (needsRead && doc.url) {
    opts.onStage?.("get");
    const got = await getPage(doc.url);
    if (!got.ok) {
      readDetail = got.reason;
    } else if (!isHtml(got.contentType)) {
      readDetail = `not html (${got.contentType || "no content-type"})`;
    } else {
      opts.onStage?.("read");
      read = await readPage(got.html, got.finalUrl);
      readDetail = read
        ? `${read.wordCount} words`
        : `no content after parse (${got.html.length} chars fetched)`;
    }

    if (opts.render && (read === null || read.wordCount < THIN_WORDS)) {
      const { renderHtml } = await import("./render");
      const rendered = await renderHtml(doc.url).catch(() => null);
      if (rendered?.html) {
        const renderedRead = await readPage(rendered.html, doc.url);
        if (renderedRead && renderedRead.wordCount > (read?.wordCount ?? 0)) {
          read = renderedRead;
          readDetail = `${renderedRead.wordCount} words (rendered)`;
        }
      }
    }

    const saved = await saveRead(doc, read);
    readStatus = saved.status;
    changed = saved.changed;

    // A document no method could read stays answerable at the smallest honest
    // level: its title + description as the single passage.
    if (saved.status === "failed" && (doc.title || doc.description)) {
      passageCount = await savePassages(doc, {
        title: doc.title || doc.externalId,
        summary: [doc.title, doc.description].filter(Boolean).join("\n\n"),
      });
    }
    doc.markdown = read?.markdown ?? null;
    doc.contentHash = read ? sha256(read.markdown) : doc.contentHash;
    if (read?.title && !doc.title) doc.title = read.title;
  }

  let understood = false;
  const needsUnderstand =
    doc.markdown &&
    (!doc.summary || doc.promptVersion !== PROMPT_VERSION || (opts.force && changed));

  if (needsUnderstand) {
    opts.onStage?.("understand", "describe");

    const result = await understandPage({
      url: doc.url ?? "",
      title: doc.title,
      description: doc.description,
      author: "",
      markdown: doc.markdown!,
      knownTopics: opts.knownTopics ?? [],
      winningSpellings: opts.winningSpellings ?? {},
    });

    const override = opts.overrides?.[doc.externalId];
    await saveUnderstand(doc, override ? { ...result, ...override } : result);
    doc.summary = result.summary;
    understood = true;
  }

  const ready = Boolean(doc.summary);
  const needsEmbed = ready && (understood || changed);
  if (needsEmbed) {
    const mode: EmbeddingMode = embeddingModeFor(doc.kind);
    const units =
      mode === "full" && doc.markdown ? chunkMarkdown(doc.markdown, { title: doc.title }) : [];
    opts.onStage?.("embed", `${units.length + 1} passages`);
    passageCount = await savePassages(doc, {
      title: doc.title || doc.externalId,
      summary: doc.summary!,
      units,
    });
  }

  return { read: readStatus, understood, passages: passageCount, changed, readDetail };
}
