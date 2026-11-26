import { and, desc, eq, ilike, inArray, or } from "drizzle-orm";
import { db } from "@curio/core/db/index";
import { annotations, connections, documents } from "@curio/core/db/schema";
import type { Scope } from "./scope";

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
      hue: annotations.hue,
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
