import { and, desc, eq, ilike, inArray, or, sql } from "drizzle-orm";
import { db } from "@curio/core/db/index";
import { annotations, connections, documents } from "@curio/core/db/schema";
import { search, type SearchHit, type SearchMode } from "@curio/core/kb/search";

/**
 * The actions behind both surfaces — the in-app agent and the harness. Plain
 * async functions returning data, so an MCP tool, a CLI command and an AI SDK
 * tool all call the same code. No formatting, no model, no HTTP.
 */

export interface Scope {
  libraryId: number;
}

export interface SearchActionOptions {
  mode?: SearchMode;
  kind?: string;
  category?: string;
  limit?: number;
  documentId?: number;
}

/** Search the library. The one retrieval path. */
export function searchLibrary(scope: Scope, query: string, opts: SearchActionOptions = {}) {
  return search(query, { ...opts, libraryId: scope.libraryId });
}

/** A document's metadata, summary and topics. */
export async function getDocument(scope: Scope, documentId: number) {
  const [row] = await db
    .select({
      id: documents.id,
      externalId: documents.externalId,
      url: documents.url,
      title: documents.title,
      author: documents.author,
      kind: documents.kind,
      category: documents.category,
      summary: documents.summary,
      topics: documents.topics,
      wordCount: documents.wordCount,
      readState: documents.readState,
      readStatus: documents.readStatus,
    })
    .from(documents)
    .where(
      and(
        eq(documents.id, documentId),
        eq(documents.libraryId, scope.libraryId),
        sql`${documents.hiddenAt} is null`,
      ),
    )
    .limit(1);
  return row ?? null;
}

/**
 * Read a span of a document by line numbers. This is the reading harness's
 * `read_file`: a citation points at a span, and this opens it.
 */
export async function readPassage(
  scope: Scope,
  documentId: number,
  startLine?: number,
  endLine?: number,
) {
  const [row] = await db
    .select({ title: documents.title, url: documents.url, markdown: documents.markdown })
    .from(documents)
    .where(and(eq(documents.id, documentId), eq(documents.libraryId, scope.libraryId)))
    .limit(1);
  if (!row?.markdown) return null;

  const lines = row.markdown.split("\n");
  const from = Math.max(1, startLine ?? 1);
  const to = Math.min(lines.length, endLine ?? from + 40);
  return {
    documentId,
    title: row.title,
    url: row.url,
    startLine: from,
    endLine: to,
    text: lines.slice(from - 1, to).join("\n"),
  };
}

/** The most recently added documents, optionally filtered. */
export async function listLibrary(
  scope: Scope,
  opts: { kind?: string; readState?: string; limit?: number } = {},
) {
  const limit = opts.limit ?? 20;
  const where = [eq(documents.libraryId, scope.libraryId), sql`${documents.hiddenAt} is null`];
  if (opts.kind) where.push(eq(documents.kind, opts.kind));
  if (opts.readState) where.push(eq(documents.readState, opts.readState));

  return db
    .select({
      id: documents.id,
      externalId: documents.externalId,
      title: documents.title,
      url: documents.url,
      site: documents.site,
      author: documents.author,
      kind: documents.kind,
      category: documents.category,
      readState: documents.readState,
      wordCount: documents.wordCount,
      addedAt: documents.addedAt,
    })
    .from(documents)
    .where(and(...where))
    .orderBy(desc(documents.addedAt))
    .limit(limit);
}

/** A document with its markdown and live marks — exactly what the reader renders. */
export async function getDocumentForReader(scope: Scope, documentId: number) {
  // Both queries need only the id, so they run together. On a database that is
  // a network hop away, that is one round trip instead of two — and the hop is
  // the whole cost here.
  const [rows, marks] = await Promise.all([
    db
      .select()
      .from(documents)
      .where(and(eq(documents.id, documentId), eq(documents.libraryId, scope.libraryId)))
      .limit(1),
    db
      .select()
      .from(annotations)
      .where(
        and(
          eq(annotations.documentId, documentId),
          eq(annotations.libraryId, scope.libraryId),
          eq(annotations.stale, false),
        ),
      )
      .orderBy(annotations.createdAt),
  ]);

  const row = rows[0];
  if (!row) return null;
  return { ...row, annotations: marks };
}

/** What you wrote in the margins: highlights and notes. */
export async function searchAnnotations(scope: Scope, query: string, limit = 20) {
  const q = `%${query}%`;
  return db
    .select({
      id: annotations.id,
      documentId: annotations.documentId,
      title: documents.title,
      kind: annotations.kind,
      quote: annotations.quote,
      body: annotations.body,
      startLine: annotations.startLine,
      endLine: annotations.endLine,
    })
    .from(annotations)
    .innerJoin(documents, eq(documents.id, annotations.documentId))
    .where(
      and(
        eq(annotations.libraryId, scope.libraryId),
        or(ilike(annotations.quote, q), ilike(annotations.body, q)),
      ),
    )
    .orderBy(desc(annotations.createdAt))
    .limit(limit);
}

/** Write a highlight or a note onto a document span. */
export async function saveAnnotation(
  scope: Scope,
  input: {
    documentId: number;
    quote?: string;
    body?: string;
    startLine?: number;
    endLine?: number;
    hue?: number;
    kind?: "highlight" | "note";
  },
) {
  const [row] = await db
    .insert(annotations)
    .values({
      documentId: input.documentId,
      libraryId: scope.libraryId,
      kind: input.kind ?? (input.body ? "note" : "highlight"),
      quote: input.quote ?? "",
      body: input.body ?? "",
      startLine: input.startLine,
      endLine: input.endLine,
      hue: input.hue ?? 3,
    })
    .returning({ id: annotations.id });
  return row!;
}

/** Draw an edge between two documents — the agent's "these two connect". */
export async function connectDocuments(
  scope: Scope,
  input: {
    fromDocumentId: number;
    toDocumentId: number;
    kind?: string;
    note?: string;
    fromAnnotationId?: number;
    toAnnotationId?: number;
  },
) {
  const [row] = await db
    .insert(connections)
    .values({
      libraryId: scope.libraryId,
      fromDocumentId: input.fromDocumentId,
      toDocumentId: input.toDocumentId,
      kind: input.kind ?? "related",
      note: input.note ?? "",
      fromAnnotationId: input.fromAnnotationId,
      toAnnotationId: input.toAnnotationId,
    })
    .returning({ id: connections.id });
  return row!;
}

/** Documents that cite or are cited by a document, for the connect tool. */
export async function connectionsFor(scope: Scope, documentId: number) {
  const rows = await db
    .select({
      id: connections.id,
      fromDocumentId: connections.fromDocumentId,
      toDocumentId: connections.toDocumentId,
      kind: connections.kind,
      note: connections.note,
    })
    .from(connections)
    .where(
      and(
        eq(connections.libraryId, scope.libraryId),
        or(eq(connections.fromDocumentId, documentId), eq(connections.toDocumentId, documentId)),
      ),
    )
    .limit(50);

  const ids = new Set<number>();
  for (const row of rows) {
    if (row.fromDocumentId !== documentId) ids.add(row.fromDocumentId);
    if (row.toDocumentId !== documentId) ids.add(row.toDocumentId);
  }
  const others = ids.size
    ? await db
        .select({ id: documents.id, title: documents.title, url: documents.url })
        .from(documents)
        .where(inArray(documents.id, [...ids]))
    : [];

  return { edges: rows, documents: others };
}

export type { SearchHit };

/** Recolour an existing mark. */
export async function recolorAnnotation(scope: Scope, id: number, hue: number) {
  await db
    .update(annotations)
    .set({ hue })
    .where(and(eq(annotations.id, id), eq(annotations.libraryId, scope.libraryId)));
}

/** Erase a mark. */
export async function deleteAnnotation(scope: Scope, id: number) {
  await db
    .delete(annotations)
    .where(and(eq(annotations.id, id), eq(annotations.libraryId, scope.libraryId)));
}

/** Move a document along its reading state: unread · reading · read · archived. */
export async function setReadState(scope: Scope, documentId: number, readState: string) {
  await db
    .update(documents)
    .set({ readState, updatedAt: new Date() })
    .where(and(eq(documents.id, documentId), eq(documents.libraryId, scope.libraryId)));
}
