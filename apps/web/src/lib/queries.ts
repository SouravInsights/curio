"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as api from "@/lib/api";
import type { Me } from "@/lib/api";

/**
 * **Server-only** state.
 *
 * Search, the agent, the topic index and connections have no local copy — they
 * are computed by the server and read once. Everything the reader owns (the
 * library list, read state, marks) is local-first and lives in `@/lib/local`.
 *
 * Nothing here is persisted. The disk cache that used to sit under this provider
 * is gone; a local row is a better cold start than a serialized cache blob, and
 * two stores for the same data was the confusion that replacing it removed.
 */

export const keys = {
  me: ["me"] as const,
  search: (query: string) => ["search", query] as const,
  topics: ["topics"] as const,
  annotations: (query: string) => ["annotations", query] as const,
  connections: (id: number) => ["connections", id] as const,
};

/** Where the last-known identity is kept, so a cold start offline still renders. */
const ME_KEY = "curio-me";

function readCachedMe(): Me | undefined {
  try {
    const raw = localStorage.getItem(ME_KEY);
    return raw ? (JSON.parse(raw) as Me) : undefined;
  } catch {
    return undefined;
  }
}

function writeCachedMe(me: Me | null): void {
  try {
    if (me) localStorage.setItem(ME_KEY, JSON.stringify(me));
    else localStorage.removeItem(ME_KEY);
  } catch {
    // private mode: the session still works, it just will not survive a reload
  }
}

/**
 * Identity.
 *
 * Seeded from the last successful answer, so an offline cold start renders the
 * app (and its local library) instead of the sign-in screen; the request then
 * revalidates in the background. A 401 clears the seed and signs the user out.
 * This is the same "trust local, verify with the next request" the reader uses.
 */
export function useMe() {
  return useQuery({
    queryKey: keys.me,
    queryFn: async () => {
      const me = await api.me();
      writeCachedMe(me);
      return me;
    },
    initialData: readCachedMe,
    // Treat the seed as old, so the first mount revalidates immediately: online
    // a stale session signs out, offline the error keeps the seeded identity.
    initialDataUpdatedAt: 0,
    staleTime: 5 * 60_000,
  });
}

/** Hybrid, falling back to literal text when no model is wired. */
export function useSearchResults(query: string, enabled = true) {
  const q = query.trim();
  return useQuery({
    queryKey: keys.search(q),
    queryFn: () => api.search(q, "hybrid").catch(() => api.search(q, "exact")),
    enabled: enabled && q.length > 0,
    placeholderData: keepPreviousData,
    staleTime: 60_000,
  });
}

/** The browse index: categories and topics with counts. */
export function useTopics(enabled = true) {
  return useQuery({
    queryKey: keys.topics,
    queryFn: () => api.listTopics(),
    enabled,
    staleTime: 5 * 60_000,
  });
}

/** Every mark in the library, for the Highlights surface. */
export function useAnnotations(query: string, enabled = true) {
  const q = query.trim();
  return useQuery({
    queryKey: keys.annotations(q),
    queryFn: () => api.listAnnotations(q || undefined),
    enabled,
    placeholderData: keepPreviousData,
    staleTime: 60_000,
  });
}

/** The edges the agent drew from a document — the "More like this" tab. */
export function useConnections(id: number | null) {
  return useQuery({
    queryKey: keys.connections(id ?? -1),
    queryFn: () => api.getConnections(id as number),
    enabled: id !== null,
  });
}

/**
 * Adding a link reads the page server-side, so there is nothing to be optimistic
 * about. The caller runs a sync pull afterwards to bring the new document into
 * the local list.
 */
export function useAddLink() {
  return useMutation({ mutationFn: (url: string) => api.addLink(url) });
}

/** Sign out and drop every cached answer — they belong to the old identity. */
export function useSignOut() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: () => api.signOut(),
    onSuccess: () => {
      // Mark `me` signed-out first, so the shell flips to SignIn on the next
      // render; then drop the rest, which belonged to the old identity. The
      // local databases are dropped by `LocalProvider` when identity clears.
      client.setQueryData(keys.me, null);
      writeCachedMe(null);
      client.removeQueries({ predicate: (query) => query.queryKey[0] !== "me" });
    },
  });
}
