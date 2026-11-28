import Dexie, { type Table } from "dexie";

/**
 * The local library: IndexedDB as the app's database, not a cache of the
 * server's.
 *
 * One database per identity (`curio-<userId>`), so the data physically cannot
 * belong to the wrong person. Everything the user authors lives here first; the
 * server is brought into agreement afterwards.
 *
 * Stores:
 * - `annotations` — highlights and notes, keyed by the client-minted id. This
 *   is what the reader renders and what a write mutates.
 * - `outbox` — the durable write log. A mutation appends a row; the sync loop
 *   flushes it and deletes the rows the server acknowledged. It survives a
 *   reload, which is the whole point: a highlight made offline is not lost.
 * - `meta` — the pull cursor and anything else that must persist across boots.
 */

export interface LocalAnnotation {
  /** The mark's identity. Client-minted, never the server's row id. */
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
  /** A tombstone stays in the store until it has synced, then it is dropped. */
  deleted: boolean;
  /** Epoch millis. Local clock for local writes; server time once pulled. */
  updatedAt: number;
}

/**
 * A document as the list needs it: the server's fields plus the reader's own
 * (read state, star). One row per document; every filter is an index scan.
 */
export interface LocalItem {
  id: number;
  externalId: string;
  title: string;
  url: string | null;
  site: string;
  author: string;
  kind: string;
  readState: string;
  favorite: boolean;
  readProgress: number;
  lastReadAt: number | null;
  summary: string | null;
  topics: string[] | null;
  questions: string[] | null;
  wordCount: number | null;
  addedAt: number;
  updatedAt: number;
}

export type OutboxEntity = "annotation" | "document";
export type OutboxOp = "upsert" | "delete" | "patch";

export interface OutboxRow {
  /** Local ordering. Auto-incremented, so it is always increasing per write. */
  seq?: number;
  entity: OutboxEntity;
  op: OutboxOp;
  /** The entity's client id. */
  id: string;
  createdAt: number;
  attempts: number;
}

export interface MetaRow {
  key: string;
  value: unknown;
}

export class CurioDb extends Dexie {
  annotations!: Table<LocalAnnotation, string>;
  items!: Table<LocalItem, number>;
  outbox!: Table<OutboxRow, number>;
  meta!: Table<MetaRow, string>;

  constructor(userId: string) {
    super(`curio-${userId}`);
    this.version(1).stores({
      annotations: "clientId, documentId, updatedAt, deleted",
      outbox: "++seq, entity, id",
      meta: "key",
    });
    // v2: the library list moves in, so a filter is a local index scan.
    this.version(2).stores({
      items: "id, readState, favorite, kind, category, addedAt, updatedAt",
    });
    // v3: the link-category taxonomy is retired; topics are the only browse axis.
    this.version(3).stores({
      items: "id, readState, favorite, kind, addedAt, updatedAt",
    });
  }
}

/** One open database per identity, reused across renders. */
const open = new Map<string, CurioDb>();

export function openDb(userId: string): CurioDb {
  let db = open.get(userId);
  if (!db) {
    db = new CurioDb(userId);
    open.set(userId, db);
  }
  return db;
}

/** Forget an identity's database — sign-out must not leave it behind. */
export async function dropDb(userId: string): Promise<void> {
  const db = open.get(userId);
  open.delete(userId);
  await db?.delete();
}

export const META_CURSOR = "sync.cursor";
export const META_ITEMS_CURSOR = "sync.items.cursor";
