import { sql, type SQL } from "drizzle-orm";

/**
 * The pull cursor, shared by every synced table.
 *
 * A row is ordered by `(updated_at, id)`. The timestamp is carried at
 * Postgres's own microsecond precision via `to_char`, so two rows written in
 * the same millisecond can never be skipped or replayed forever; the id breaks
 * ties. The cursor is opaque to the client — never parse it, only echo it.
 */
export interface Cursor {
  ts: string;
  id: number;
}

export function parseCursor(cursor: string | null): Cursor | null {
  if (!cursor) return null;
  const split = cursor.lastIndexOf("|");
  if (split < 0) return null;
  const ts = cursor.slice(0, split);
  const id = Number(cursor.slice(split + 1));
  if (!ts || !Number.isFinite(id)) return null;
  return { ts, id };
}

export function formatCursor(ts: string, id: number): string {
  return `${ts}|${id}`;
}

/** The `to_char` expression that produces a cursor's timestamp half. */
export function cursorTimestamp(column: SQL | unknown): SQL<string> {
  return sql`to_char(${column}, 'YYYY-MM-DD"T"HH24:MI:SS.US OF')`;
}

/**
 * `(updated_at, id) > (cursor.ts, cursor.id)`, or `true` for a full pull.
 * Row comparison keeps the predicate on the table's `(library_id, updated_at,
 * id)` index.
 */
export function afterCursor(updatedAt: unknown, id: unknown, cursor: Cursor | null): SQL {
  if (!cursor) return sql`true`;
  return sql`(${updatedAt}, ${id}) > (${cursor.ts}::timestamptz, ${cursor.id})`;
}
