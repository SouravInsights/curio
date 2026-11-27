import { and, asc, desc, eq, ne, sql } from "drizzle-orm";
import { db } from "@curio/core/db/index";
import { annotations, documents } from "@curio/core/db/schema";
import type { Scope } from "./scope";
import { afterCursor, cursorTimestamp, formatCursor, parseCursor } from "./cursor";

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
    category?: string;
    topic?: string;
  } = {},
) {
  const limit = opts.limit ?? 20;
  const where = [eq(documents.libraryId, scope.libraryId), sql`${documents.hiddenAt} is null`];
  if (opts.kind) where.push(eq(documents.kind, opts.kind));
  // Archived rows leave the list; they are only returned when asked for by name.
  if (opts.readState) where.push(eq(documents.readState, opts.readState));
  else where.push(ne(documents.readState, "archived"));
  if (opts.favorite) where.push(eq(documents.favorite, true));
  if (opts.category) where.push(eq(documents.category, opts.category));
  // A topic is one member of the `topics` array; `@>` tests membership.
  if (opts.topic) where.push(sql`${documents.topics} @> array[${opts.topic}]::text[]`);

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

/**
 * The list-row projection the client keeps locally. One row per document,
 * carrying both the server's fields and the reader's own (read state, star).
 * `hidden` is the tombstone: a hidden document is dropped from the local store.
 */
export interface DocumentChange {
  id: number;
  externalId: string;
  title: string;
  url: string | null;
  site: string;
  author: string;
  kind: string;
  category: string | null;
  readState: string;
  favorite: boolean;
  summary: string | null;
  topics: string[] | null;
  wordCount: number | null;
  addedAt: number;
  hidden: boolean;
  updatedAt: number;
}

/** Documents changed since a cursor — the library list's pull feed. */
export async function pullDocuments(
  scope: Scope,
  cursor: string | null,
  limit = 500,
): Promise<{ changes: DocumentChange[]; cursor: string | null; hasMore: boolean }> {
  const parsed = parseCursor(cursor);
  const rows = await db
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
      hiddenAt: documents.hiddenAt,
      updatedAt: documents.updatedAt,
      cursorTs: cursorTimestamp(documents.updatedAt),
    })
    .from(documents)
    .where(and(eq(documents.libraryId, scope.libraryId), afterCursor(documents.updatedAt, documents.id, parsed)))
    .orderBy(asc(documents.updatedAt), asc(documents.id))
    .limit(limit);

  let next = cursor;
  const changes: DocumentChange[] = rows.map((row) => {
    next = formatCursor(row.cursorTs, row.id);
    return {
      id: row.id,
      externalId: row.externalId,
      title: row.title,
      url: row.url,
      site: row.site,
      author: row.author,
      kind: row.kind,
      category: row.category,
      readState: row.readState,
      favorite: row.favorite,
      summary: row.summary,
      topics: row.topics,
      wordCount: row.wordCount,
      addedAt: row.addedAt.getTime(),
      hidden: row.hiddenAt !== null,
      updatedAt: row.updatedAt.getTime(),
    };
  });

  return { changes, cursor: next, hasMore: rows.length === limit };
}

/** Apply the reader's own fields — the only document columns the client writes. */
export async function applyDocumentPatch(
  scope: Scope,
  id: number,
  patch: { readState?: string; favorite?: boolean },
) {
  const set: { readState?: string; favorite?: boolean; updatedAt: Date } = { updatedAt: new Date() };
  if (patch.readState !== undefined) set.readState = patch.readState;
  if (patch.favorite !== undefined) set.favorite = patch.favorite;
  await db
    .update(documents)
    .set(set)
    .where(and(eq(documents.id, id), eq(documents.libraryId, scope.libraryId)));
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
          sql`${annotations.deletedAt} is null`,
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

/**
 * The browse index: what the library is made of, not what is in it.
 *
 * Two levels, both already on the document row — the fixed `category` the
 * classifier assigns, and the freeform `topics` it writes. Counts come from one
 * grouped query each, so the page is two round trips regardless of size.
 */
export async function listTopics(scope: Scope) {
  // Archived rows leave the library list, so they leave the browse index too —
  // a count you can click through to and find nothing behind is a bug.
  const [categories, topicRows] = await Promise.all([
    db
      .select({ name: documents.category, count: sql<number>`count(*)::int` })
      .from(documents)
      .where(
        and(
          eq(documents.libraryId, scope.libraryId),
          sql`${documents.hiddenAt} is null`,
          sql`${documents.category} is not null`,
          ne(documents.readState, "archived"),
        ),
      )
      .groupBy(documents.category)
      .orderBy(desc(sql`count(*)`), asc(documents.category)),
    db.execute<{ name: string; count: number }>(sql`
      select t as name, count(*)::int as count
      from ${documents}, unnest(${documents.topics}) as t
      where ${documents.libraryId} = ${scope.libraryId}
        and ${documents.hiddenAt} is null
        and ${documents.readState} <> 'archived'
      group by t
      order by count desc, t asc
      limit 60
    `),
  ]);

  return {
    categories: categories.filter((row) => row.name !== null) as { name: string; count: number }[],
    topics: Array.from(topicRows),
  };
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
