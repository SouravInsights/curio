import { and, eq, isNull, or, sql } from "drizzle-orm";
import { db } from "@curio/core/db/index";
import { documents } from "@curio/core/db/schema";
import type { Kind } from "@curio/core/kb/kinds";
import { buildDocument, type DocumentRow } from "@curio/core/kb/store";
import { webExternalId } from "@curio/core/lib/identity";
import type { ImportedDocument } from "./types";

/**
 * Insert or update a document, then run it through the pipeline.
 *
 * Dedupe is by `(library_id, external_id)`: the database rejects a second row
 * for the same reading, so importing a list twice is a no-op and a bookmark that
 * is also an article stays one document. Idempotent by construction.
 */

export async function addDocument(
  libraryId: number,
  input: {
    kind: Kind;
    externalId: string;
    sourceId?: number | null;
    url?: string;
    title?: string;
    author?: string;
    description?: string;
    markdown?: string;
    addedAt?: Date;
  },
): Promise<{ id: number; created: boolean }> {
  const [existing] = await db
    .select({ id: documents.id })
    .from(documents)
    .where(and(eq(documents.libraryId, libraryId), eq(documents.externalId, input.externalId)))
    .limit(1);

  if (existing) {
    await db
      .update(documents)
      .set({
        ...(input.title ? { title: input.title } : {}),
        ...(input.url ? { url: input.url } : {}),
        ...(input.markdown ? { markdown: input.markdown } : {}),
        updatedAt: new Date(),
      })
      .where(eq(documents.id, existing.id));
    return { id: existing.id, created: false };
  }

  const [row] = await db
    .insert(documents)
    .values({
      libraryId,
      sourceId: input.sourceId ?? null,
      kind: input.kind,
      externalId: input.externalId,
      url: input.url ?? null,
      title: input.title ?? "",
      author: input.author ?? "",
      description: input.description ?? "",
      markdown: input.markdown ?? null,
      addedAt: input.addedAt ?? new Date(),
    })
    .returning({ id: documents.id });
  return { id: row!.id, created: true };
}

/** Import many documents, then build each. Returns counts. */
export async function importDocuments(
  libraryId: number,
  sourceId: number | null,
  docs: ImportedDocument[],
  opts: { build?: boolean; knownTopics?: string[]; winningSpellings?: Record<string, string> } = {},
): Promise<{ added: number; skipped: number; built: number }> {
  let added = 0;
  let skipped = 0;
  let built = 0;

  for (const doc of docs) {
    const { id, created } = await addDocument(libraryId, { ...doc, sourceId });
    if (created) added++;
    else skipped++;

    if (opts.build !== false) {
      const row = await documentRow(id);
      if (row) {
        await buildDocument(row, {
          knownTopics: opts.knownTopics,
          winningSpellings: opts.winningSpellings,
        });
        built++;
      }
    }
  }

  return { added, skipped, built };
}

/** The pipeline's view of a document. */
export async function documentRow(id: number): Promise<DocumentRow | null> {
  const [row] = await db
    .select({
      id: documents.id,
      url: documents.url,
      externalId: documents.externalId,
      title: documents.title,
      description: documents.description,
      kind: documents.kind,
      markdown: documents.markdown,
      contentHash: documents.contentHash,
      category: documents.category,
      summary: documents.summary,
      promptVersion: documents.promptVersion,
      sourceKind: sql<string | null>`null`,
    })
    .from(documents)
    .where(eq(documents.id, id))
    .limit(1);

  if (!row) return null;
  return { ...row, sourceKind: row.sourceKind ?? null };
}

/** Documents the pipeline still has work for: unread, or never understood. */
export async function pendingDocuments(limit: number): Promise<DocumentRow[]> {
  const rows = await db
    .select({
      id: documents.id,
      url: documents.url,
      externalId: documents.externalId,
      title: documents.title,
      description: documents.description,
      kind: documents.kind,
      markdown: documents.markdown,
      contentHash: documents.contentHash,
      category: documents.category,
      summary: documents.summary,
      promptVersion: documents.promptVersion,
    })
    .from(documents)
    .where(
      and(
        isNull(documents.hiddenAt),
        or(eq(documents.readStatus, "pending"), isNull(documents.summary)),
      ),
    )
    .limit(limit);

  return rows.map((r) => ({ ...r, sourceKind: null }));
}

/**
 * Add one link and read it.
 *
 * The four verbs run for this single row right away: `get → read` (defuddle)
 * always, then `understand → embed` best-effort. A missing model key must not
 * cost you the article: the markdown is stored and readable either way, and the
 * summary is written when the pipeline next runs with a key.
 */
/**
 * Save a note the reader (or the agent) wrote, as a document in the library.
 *
 * A note is a reading item like any other: it gets an identity, its markdown is
 * stored, and the pipeline understands and embeds it so it is searchable and can
 * be cited. The text is already here, so the read stage is skipped; a missing
 * model key costs the summary, not the note.
 */
export async function saveNote(
  libraryId: number,
  input: { title: string; markdown: string },
): Promise<{ id: number; passages: number }> {
  const { id } = await addDocument(libraryId, {
    kind: "note",
    externalId: `note:${crypto.randomUUID()}`,
    title: input.title,
    markdown: input.markdown,
  });
  const row = await documentRow(id);
  if (!row) return { id, passages: 0 };
  try {
    const outcome = await buildDocument(row, {});
    return { id, passages: outcome.passages };
  } catch {
    // No model key: the note is stored and full-text searchable anyway.
    return { id, passages: 0 };
  }
}

export async function addLink(
  libraryId: number,
  url: string,
  opts: { kind?: Kind; category?: string } = {},
): Promise<{
  id: number;
  created: boolean;
  read: string;
  understood: boolean;
  passages: number;
  note?: string;
}> {
  const { id, created } = await addDocument(libraryId, {
    kind: opts.kind ?? "article",
    externalId: webExternalId(url),
    url,
  });

  const row = await documentRow(id);
  if (!row) return { id, created, read: "failed", understood: false, passages: 0 };

  try {
    const outcome = await buildDocument(row, {});
    return {
      id,
      created,
      read: outcome.read,
      understood: outcome.understood,
      passages: outcome.passages,
    };
  } catch (error) {
    // Understand/embed failed (usually no model key). The read stands.
    return {
      id,
      created,
      read: "ok",
      understood: false,
      passages: 0,
      note: error instanceof Error ? error.message : "understand failed",
    };
  }
}
