"use client";

import { useLiveQuery } from "dexie-react-hooks";
import type { CreatePayload } from "@curio/ui/components/highlight/highlight";
import type { CurioDb, LocalAnnotation } from "./db";

/**
 * The reader's marks, read from IndexedDB.
 *
 * A mark is a local row first and a server row later, so every read is a live
 * query and every write is a store write plus an outbox entry. React repaints
 * from the store, which is why a highlight appears with no network and no
 * optimistic-paint dance.
 */

/** Live marks for one document, oldest first. Nothing deleted, nothing stale. */
export function useDocumentMarks(db: CurioDb | null, documentId: number | null) {
  return (
    useLiveQuery(
      async () => {
        if (!db || documentId == null) return [];
        const rows = await db.annotations.where("documentId").equals(documentId).toArray();
        return rows
          .filter((row) => !row.deleted)
          .sort((a, b) => a.occurrence - b.occurrence || a.updatedAt - b.updatedAt);
      },
      [db?.name, documentId],
      [] as LocalAnnotation[],
    ) ?? []
  );
}

export interface NewMark extends CreatePayload {
  documentId: number;
  kind?: "highlight" | "note";
}

/**
 * Write a new mark. The client mints the id up front, so the row has a stable
 * name before the server has seen it — that is what makes an offline mark
 * durable and its push idempotent. Returns the id immediately.
 */
export async function createMark(
  db: CurioDb,
  sync: { kick: () => void },
  input: NewMark,
): Promise<string> {
  const clientId = crypto.randomUUID();
  const now = Date.now();
  await db.transaction("rw", db.annotations, db.outbox, async () => {
    await db.annotations.put({
      clientId,
      documentId: input.documentId,
      kind: input.kind ?? "highlight",
      quote: input.quote,
      prefix: input.prefix,
      suffix: input.suffix,
      occurrence: input.occurrence,
      hue: input.hue,
      body: "",
      startLine: null,
      endLine: null,
      deleted: false,
      updatedAt: now,
    });
    await db.outbox.add({
      entity: "annotation",
      op: "upsert",
      id: clientId,
      createdAt: now,
      attempts: 0,
    });
  });
  sync.kick();
  return clientId;
}

/** Recolour a mark in place and queue the change. */
export async function recolorMark(
  db: CurioDb,
  sync: { kick: () => void },
  clientId: string,
  hue: number,
): Promise<void> {
  await db.transaction("rw", db.annotations, db.outbox, async () => {
    const row = await db.annotations.get(clientId);
    if (!row) return;
    await db.annotations.update(clientId, { hue, updatedAt: Date.now() });
    await db.outbox.add({
      entity: "annotation",
      op: "upsert",
      id: clientId,
      createdAt: Date.now(),
      attempts: 0,
    });
  });
  sync.kick();
}

/** Remove a mark. A tombstone, so another device learns it is gone. */
export async function removeMark(
  db: CurioDb,
  sync: { kick: () => void },
  clientId: string,
): Promise<void> {
  await db.transaction("rw", db.annotations, db.outbox, async () => {
    await db.annotations.update(clientId, { deleted: true, updatedAt: Date.now() });
    await db.outbox.add({
      entity: "annotation",
      op: "delete",
      id: clientId,
      createdAt: Date.now(),
      attempts: 0,
    });
  });
  sync.kick();
}
