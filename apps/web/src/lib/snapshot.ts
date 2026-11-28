"use client";

import { useEffect } from "react";
import { useQuery, type QueryKey } from "@tanstack/react-query";

const PREFIX = "curio-snapshot:";
/** The same key `useMe` writes. The snapshot reads it to namespace by identity. */
const ME_KEY = "curio-me";

/**
 * The signed-in reader, so one person's snapshot can never paint for another.
 * Query keys do not carry the user — `["reviews"]` is the same key for everyone
 * — so the storage key does.
 */
function scope(): string {
  try {
    const raw = localStorage.getItem(ME_KEY);
    if (!raw) return "anon";
    return (JSON.parse(raw) as { id?: string }).id ?? "anon";
  } catch {
    return "anon";
  }
}

function storageKey(id: string): string {
  return `${PREFIX}${scope()}:${id}`;
}

function read<T>(id: string): { data: T; at: number } | null {
  try {
    const raw = localStorage.getItem(storageKey(id));
    return raw ? (JSON.parse(raw) as { data: T; at: number }) : null;
  } catch {
    return null;
  }
}

function write<T>(id: string, data: T): void {
  try {
    localStorage.setItem(storageKey(id), JSON.stringify({ data, at: Date.now() }));
  } catch {
    // private mode or quota — the snapshot is a nicety, not a source of truth
  }
}

/**
 * A server-computed query that paints from its last answer.
 *
 * The library list, the marks and the topics are local rows, so they paint on
 * the first frame. Review, chats, suggestions and connections are computed on
 * the server and have no local row of their own. Without this they show a
 * skeleton on every cold start for something the reader saw a minute ago.
 *
 * The last answer is the initial data, stamped with when it arrived, so the
 * query is already stale and revalidates behind the paint. The snapshot is a
 * cache, never a source of truth: the server's answer always wins the moment it
 * lands.
 */
export function useSnapshottedQuery<T>(
  key: QueryKey,
  queryFn: () => Promise<T>,
  options: { staleTime?: number; enabled?: boolean } = {},
) {
  const id = JSON.stringify(key);
  const snapshot = read<T>(id);
  const query = useQuery<T>({
    queryKey: key,
    queryFn,
    initialData: snapshot?.data,
    initialDataUpdatedAt: snapshot?.at,
    staleTime: options.staleTime ?? 30_000,
    enabled: options.enabled ?? true,
  });

  useEffect(() => {
    if (query.data !== undefined) write(id, query.data);
  }, [id, query.data]);

  return query;
}

/** Forget every snapshot — a sign-out must not leave the old reader's answers. */
export function clearSnapshots(): void {
  try {
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith(PREFIX)) localStorage.removeItem(key);
    }
  } catch {
    // private mode: nothing was written
  }
}
