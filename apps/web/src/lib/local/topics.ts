"use client";

import { useLiveQuery } from "dexie-react-hooks";
import type { CurioDb } from "./db";

export interface LocalTopic {
  name: string;
  count: number;
}

/**
 * The subjects the library is made of, from the device.
 *
 * Every topic lives on a local `items` row, so the browse index is a scan over
 * rows already on disk — not a grouped query against the server. Same rule as
 * the marks: if the data has a local row, read the local row.
 */
export function useLocalTopics(db: CurioDb | null): LocalTopic[] | undefined {
  return useLiveQuery(
    async () => {
      if (!db) return [];
      const counts = new Map<string, number>();
      for (const item of await db.items.toArray()) {
        // Archived rows leave the library list, so they leave the index too.
        if (item.readState === "archived") continue;
        for (const topic of item.topics ?? []) {
          counts.set(topic, (counts.get(topic) ?? 0) + 1);
        }
      }
      return [...counts.entries()]
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
        .slice(0, 60);
    },
    [db?.name],
  );
}
