"use client";

import { useLiveQuery } from "dexie-react-hooks";
import type { CurioDb, LocalItem } from "./db";

/**
 * The library list, read from IndexedDB.
 *
 * Every filter is applied to rows already on the device, so switching views is
 * a repaint, not a request. The rows are seeded by the sync loop and updated by
 * the reader's own writes, so the list is the same object the reader edits.
 */

export interface ItemFilter {
  state?: string;
  sort?: "newest" | "oldest";
  favorite?: boolean;
  category?: string;
  topic?: string;
  kind?: string;
}

export interface LibraryCounts {
  all: number;
  unread: number;
  reading: number;
  read: number;
  archived: number;
  starred: number;
}

/** `undefined` until the first read lands, so the list can tell empty from loading. */
export function useLibraryItems(db: CurioDb | null, filter: ItemFilter): LocalItem[] | undefined {
  return useLiveQuery(
    async () => {
      if (!db) return [];
      const rows = await db.items.toArray();
      return rows.filter((row) => matches(row, filter)).sort(byAdded(filter.sort));
    },
    [db?.name, filter.state, filter.sort, filter.favorite, filter.category, filter.topic, filter.kind],
  );
}

export function useItem(db: CurioDb | null, id: number | null): LocalItem | null {
  return (
    useLiveQuery(
      async () => (db && id != null ? ((await db.items.get(id)) ?? null) : null),
      [db?.name, id],
      null,
    ) ?? null
  );
}

export function useLibraryCounts(db: CurioDb | null): LibraryCounts {
  return (
    useLiveQuery(
      async () => {
        const counts: LibraryCounts = {
          all: 0,
          unread: 0,
          reading: 0,
          read: 0,
          archived: 0,
          starred: 0,
        };
        if (!db) return counts;
        for (const row of await db.items.toArray()) {
          if (row.readState === "archived") {
            counts.archived += 1;
            continue;
          }
          counts.all += 1;
          if (row.favorite) counts.starred += 1;
          if (row.readState === "unread") counts.unread += 1;
          else if (row.readState === "reading") counts.reading += 1;
          else if (row.readState === "read") counts.read += 1;
        }
        return counts;
      },
      [db?.name],
      { all: 0, unread: 0, reading: 0, read: 0, archived: 0, starred: 0 } as LibraryCounts,
    ) ?? { all: 0, unread: 0, reading: 0, read: 0, archived: 0, starred: 0 }
  );
}

/** Write the reader's own fields locally and queue the patch. */
export async function patchItem(
  db: CurioDb,
  sync: { kick: () => void },
  id: number,
  patch: { readState?: string; favorite?: boolean },
): Promise<void> {
  await db.transaction("rw", db.items, db.outbox, async () => {
    const row = await db.items.get(id);
    if (!row) return;
    await db.items.update(id, { ...patch, updatedAt: Date.now() });
    await db.outbox.add({
      entity: "document",
      op: "patch",
      id: String(id),
      createdAt: Date.now(),
      attempts: 0,
    });
  });
  sync.kick();
}

function matches(row: LocalItem, filter: ItemFilter): boolean {
  if (filter.state === "starred") return row.readState !== "archived" && row.favorite;
  if (filter.state === "archived") return row.readState === "archived";
  if (row.readState === "archived") return false;
  if (filter.state && row.readState !== filter.state) return false;
  if (filter.favorite && !row.favorite) return false;
  if (filter.category && row.category !== filter.category) return false;
  if (filter.topic && !(row.topics ?? []).includes(filter.topic)) return false;
  if (filter.kind && row.kind !== filter.kind) return false;
  return true;
}

function byAdded(sort: ItemFilter["sort"]) {
  const direction = sort === "oldest" ? 1 : -1;
  return (a: LocalItem, b: LocalItem) => (a.addedAt - b.addedAt) * direction;
}
