import { and, eq, isNull, or, sql } from "drizzle-orm";
import { db } from "@/db/index.ts";
import { documents } from "@/db/schema.ts";
import type { Kind } from "@/kb/kinds.ts";
import { buildDocument, type DocumentRow } from "@/kb/store.ts";
import type { ImportedDocument } from "./types.ts";

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
