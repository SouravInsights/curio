import { and, asc, desc, eq, ne, sql } from "drizzle-orm";
import { db } from "@curio/core/db/index";
import { annotations, documents } from "@curio/core/db/schema";
import type { Scope } from "./scope";

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

export async function listLibrary(
  scope: Scope,
  opts: {
    kind?: string;
    readState?: string;
    limit?: number;
    sort?: "newest" | "oldest";
    favorite?: boolean;
  } = {},
) {
  const limit = opts.limit ?? 20;
  const where = [eq(documents.libraryId, scope.libraryId), sql`${documents.hiddenAt} is null`];
  if (opts.kind) where.push(eq(documents.kind, opts.kind));
  // Archived rows leave the list; they are only returned when asked for by name.
  if (opts.readState) where.push(eq(documents.readState, opts.readState));
  else where.push(ne(documents.readState, "archived"));
  if (opts.favorite) where.push(eq(documents.favorite, true));

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
      favorite: documents.favorite,
      summary: documents.summary,
      topics: documents.topics,
      wordCount: documents.wordCount,
      addedAt: documents.addedAt,
    })
    .from(documents)
    .where(and(...where))
    .orderBy(opts.sort === "oldest" ? asc(documents.addedAt) : desc(documents.addedAt))
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

export async function libraryCounts(scope: Scope) {
  const rows = await db
    .select({ readState: documents.readState, n: sql<number>`count(*)::int` })
    .from(documents)
    .where(and(eq(documents.libraryId, scope.libraryId), sql`${documents.hiddenAt} is null`))
    .groupBy(documents.readState);

  const starred = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(documents)
    .where(
      and(
        eq(documents.libraryId, scope.libraryId),
        sql`${documents.hiddenAt} is null`,
        eq(documents.favorite, true),
      ),
    );

  const counts = { all: 0, unread: 0, reading: 0, read: 0, archived: 0, starred: starred[0]?.n ?? 0 };
  for (const row of rows) {
    if (row.readState !== "archived") counts.all += row.n;
    if (row.readState in counts) counts[row.readState as keyof typeof counts] = row.n;
  }
  return counts;
}

export async function setReadState(scope: Scope, documentId: number, readState: string) {
  await db
    .update(documents)
    .set({ readState, updatedAt: new Date() })
    .where(and(eq(documents.id, documentId), eq(documents.libraryId, scope.libraryId)));
}

/** Star a document, or unstar it. */

export async function setFavorite(scope: Scope, documentId: number, favorite: boolean) {
  await db
    .update(documents)
    .set({ favorite, updatedAt: new Date() })
    .where(and(eq(documents.id, documentId), eq(documents.libraryId, scope.libraryId)));
}

/** How many documents sit in each reading state — the "what next" number. */

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
