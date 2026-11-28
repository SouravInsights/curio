"use client";

import { useLiveQuery } from "dexie-react-hooks";
import type { CurioDb } from "./db";

export type MarkScope = "library" | "archived" | "all";

export interface LocalHighlight {
  clientId: string;
  documentId: number;
  title: string;
  kind: string;
  quote: string;
  body: string;
  hue: number;
  startLine: number | null;
  endLine: number | null;
  note: boolean;
}

/**
 * The library-wide marks, from the device.
 *
 * The marks are already local — the reader's own writes and the sync feed put
 * every one in IndexedDB — and the document rows are local too. So the
 * Highlights surface is a join over two local stores, not a request. It paints
 * on the first frame, works offline, and has no loading state to flash.
 *
 * The join is also the hidden filter: the sync drops a hidden document from the
 * items store, so a mark whose document is gone simply has nothing to join to
 * and never appears.
 */
export function useLocalHighlights(
  db: CurioDb | null,
  { query, scope }: { query: string; scope: MarkScope },
): LocalHighlight[] | undefined {
  return useLiveQuery(
    async () => {
      if (!db) return [];
      const [marks, items] = await Promise.all([db.annotations.toArray(), db.items.toArray()]);
      const byId = new Map(items.map((item) => [item.id, item]));
      const q = query.trim().toLowerCase();

      return marks
        .filter((mark) => !mark.deleted)
        .map((mark) => ({ mark, item: byId.get(mark.documentId) }))
        .filter(({ item }) => {
          if (!item) return false;
          if (scope === "all") return true;
          return scope === "archived"
            ? item.readState === "archived"
            : item.readState !== "archived";
        })
        .filter(
          ({ mark }) =>
            !q || mark.quote.toLowerCase().includes(q) || mark.body.toLowerCase().includes(q),
        )
        .sort((a, b) => b.mark.updatedAt - a.mark.updatedAt)
        .map(({ mark, item }) => ({
          clientId: mark.clientId,
          documentId: mark.documentId,
          title: item!.title,
          kind: mark.kind,
          quote: mark.quote,
          body: mark.body,
          hue: mark.hue,
          startLine: mark.startLine,
          endLine: mark.endLine,
          note: mark.kind === "note",
        }));
    },
    [db?.name, query, scope],
  );
}
