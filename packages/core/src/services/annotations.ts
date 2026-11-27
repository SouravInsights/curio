import { and, asc, desc, eq, ilike, inArray, or, sql } from "drizzle-orm";
import { db } from "@curio/core/db/index";
import { annotations, connections, documents } from "@curio/core/db/schema";
import type { Scope } from "./scope";

/**
 * Marks, and the two ways they are written.
 *
 * The app writes through the outbox — the browser already holds the row, and
 * this module only has to make the server agree (`upsertAnnotation`,
 * `deleteAnnotation` by `client_id`). The agent and the harness write straight
 * through `saveAnnotation`, which mints the `client_id` server-side.
 *
 * A mark is never hard-deleted: `deleteAnnotation` writes a tombstone, so a
 * client that was asleep still learns the mark is gone on its next pull.
 */

export async function searchAnnotations(scope: Scope, query: string, limit = 20) {
  const q = `%${query}%`;
  return db
    .select({
      clientId: annotations.clientId,
      documentId: annotations.documentId,
      title: documents.title,
      kind: annotations.kind,
      quote: annotations.quote,
      body: annotations.body,
      hue: annotations.hue,
      startLine: annotations.startLine,
      endLine: annotations.endLine,
    })
    .from(annotations)
    .innerJoin(documents, eq(documents.id, annotations.documentId))
    .where(
      and(
        eq(annotations.libraryId, scope.libraryId),
        sql`${annotations.deletedAt} is null`,
        or(ilike(annotations.quote, q), ilike(annotations.body, q)),
      ),
    )
    .orderBy(desc(annotations.createdAt))
    .limit(limit);
}

/**
 * Write a highlight or a note onto a document span, minting the identity here.
 * The agent and the harness path — the app supplies its own `client_id`.
 */
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
    .returning({ id: annotations.id, clientId: annotations.clientId });
  return row!;
}

export interface AnnotationInput {
  clientId: string;
  documentId: number;
  kind?: "highlight" | "note";
  quote?: string;
  prefix?: string;
  suffix?: string;
  occurrence?: number;
  hue?: number;
  body?: string;
  startLine?: number;
  endLine?: number;
  stale?: boolean;
}

/**
 * The app's write: idempotent on `client_id`.
 *
 * A retried push must not create a second mark, so this is an upsert, not an
 * insert. `setWhere` pins the update to the caller's own library — a `client_id`
 * minted by someone else can never be rewritten through this path.
 */
export async function upsertAnnotation(scope: Scope, input: AnnotationInput) {
  const [row] = await db
    .insert(annotations)
    .values({
      clientId: input.clientId,
      documentId: input.documentId,
      libraryId: scope.libraryId,
      kind: input.kind ?? (input.body ? "note" : "highlight"),
      quote: input.quote ?? "",
      prefix: input.prefix ?? "",
      suffix: input.suffix ?? "",
      occurrence: input.occurrence ?? 0,
      body: input.body ?? "",
      startLine: input.startLine,
      endLine: input.endLine,
      hue: input.hue ?? 3,
      stale: input.stale ?? false,
    })
    .onConflictDoUpdate({
      target: annotations.clientId,
      set: {
        kind: sql`excluded.kind`,
        quote: sql`excluded.quote`,
        prefix: sql`excluded.prefix`,
        suffix: sql`excluded.suffix`,
        occurrence: sql`excluded.occurrence`,
        body: sql`excluded.body`,
        startLine: sql`excluded.start_line`,
        endLine: sql`excluded.end_line`,
        hue: sql`excluded.hue`,
        stale: sql`excluded.stale`,
        deletedAt: sql`null`,
        updatedAt: sql`now()`,
      },
      setWhere: eq(annotations.libraryId, scope.libraryId),
    })
    .returning({ id: annotations.id, clientId: annotations.clientId });
  return row ?? null;
}

/** Recolour a mark, by its client identity. */
export async function recolorAnnotation(scope: Scope, clientId: string, hue: number) {
  await db
    .update(annotations)
    .set({ hue, updatedAt: new Date() })
    .where(and(eq(annotations.clientId, clientId), eq(annotations.libraryId, scope.libraryId)));
}

/** Erase a mark — a tombstone, never a row delete. */
export async function deleteAnnotation(scope: Scope, clientId: string) {
  await db
    .update(annotations)
    .set({ deletedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(annotations.clientId, clientId), eq(annotations.libraryId, scope.libraryId)));
}

/**
 * Draw an edge between two documents — the agent's "these two connect".
 *
 * Annotation endpoints of an edge name a mark by its client id; they are
 * resolved to the server row here so the FK stays a bigint.
 */
export async function connectDocuments(
  scope: Scope,
  input: {
    fromDocumentId: number;
    toDocumentId: number;
    kind?: string;
    note?: string;
    fromAnnotationId?: string;
    toAnnotationId?: string;
  },
) {
  const resolved = await resolveAnnotationIds(scope, [
    input.fromAnnotationId,
    input.toAnnotationId,
  ]);
  const [row] = await db
    .insert(connections)
    .values({
      libraryId: scope.libraryId,
      fromDocumentId: input.fromDocumentId,
      toDocumentId: input.toDocumentId,
      kind: input.kind ?? "related",
      note: input.note ?? "",
      fromAnnotationId: input.fromAnnotationId ? (resolved.get(input.fromAnnotationId) ?? null) : null,
      toAnnotationId: input.toAnnotationId ? (resolved.get(input.toAnnotationId) ?? null) : null,
    })
    .returning({ id: connections.id });
  return row!;
}

async function resolveAnnotationIds(scope: Scope, clientIds: (string | undefined)[]) {
  const wanted = clientIds.filter((id): id is string => Boolean(id));
  const out = new Map<string, number>();
  if (!wanted.length) return out;
  const rows = await db
    .select({ id: annotations.id, clientId: annotations.clientId })
    .from(annotations)
    .where(and(eq(annotations.libraryId, scope.libraryId), inArray(annotations.clientId, wanted)));
  for (const row of rows) out.set(row.clientId, row.id);
  return out;
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

// ── the sync feed ─────────────────────────────────────────────────────────────

/** One row of the pull, plus the precise cursor built from it. */
export interface AnnotationChange {
  clientId: string;
  documentId: number;
  kind: "highlight" | "note";
  quote: string;
  prefix: string;
  suffix: string;
  occurrence: number;
  hue: number;
  body: string;
  startLine: number | null;
  endLine: number | null;
  stale: boolean;
  deleted: boolean;
  updatedAt: number;
}

/**
 * Changes in a library, ordered by `(updated_at, id)`.
 *
 * The cursor is opaque and carries Postgres's own microsecond timestamp, so two
 * rows written in the same millisecond can never be skipped or replayed
 * forever. Row comparison keeps it on the `(library_id, updated_at, id)` index.
 */
export async function pullAnnotations(
  scope: Scope,
  cursor: string | null,
  limit = 500,
): Promise<{ changes: AnnotationChange[]; cursor: string | null; hasMore: boolean }> {
  const parsed = parseCursor(cursor);
  const rows = await db
    .select({
      id: annotations.id,
      clientId: annotations.clientId,
      documentId: annotations.documentId,
      kind: annotations.kind,
      quote: annotations.quote,
      prefix: annotations.prefix,
      suffix: annotations.suffix,
      occurrence: annotations.occurrence,
      hue: annotations.hue,
      body: annotations.body,
      startLine: annotations.startLine,
      endLine: annotations.endLine,
      stale: annotations.stale,
      deletedAt: annotations.deletedAt,
      updatedAt: annotations.updatedAt,
      cursorTs: sql<string>`to_char(${annotations.updatedAt}, 'YYYY-MM-DD"T"HH24:MI:SS.US OF')`,
    })
    .from(annotations)
    .where(
      and(
        eq(annotations.libraryId, scope.libraryId),
        parsed
          ? sql`(${annotations.updatedAt}, ${annotations.id}) > (${parsed.ts}::timestamptz, ${parsed.id})`
          : sql`true`,
      ),
    )
    .orderBy(asc(annotations.updatedAt), asc(annotations.id))
    .limit(limit);

  let next = cursor;
  const changes: AnnotationChange[] = rows.map((row) => {
    next = `${row.cursorTs}|${row.id}`;
    return {
    clientId: row.clientId,
    documentId: row.documentId,
    kind: row.kind as "highlight" | "note",
    quote: row.quote,
    prefix: row.prefix,
    suffix: row.suffix,
    occurrence: row.occurrence,
    hue: row.hue,
    body: row.body,
    startLine: row.startLine,
    endLine: row.endLine,
    stale: row.stale,
    deleted: row.deletedAt !== null,
    updatedAt: row.updatedAt.getTime(),
    };
  });

  return { changes, cursor: next, hasMore: rows.length === limit };
}

function parseCursor(cursor: string | null): { ts: string; id: number } | null {
  if (!cursor) return null;
  const split = cursor.lastIndexOf("|");
  if (split < 0) return null;
  const ts = cursor.slice(0, split);
  const id = Number(cursor.slice(split + 1));
  if (!ts || !Number.isFinite(id)) return null;
  return { ts, id };
}
