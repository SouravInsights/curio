"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as api from "@/lib/api";
import type { Me, ReviewGrade } from "@/lib/api";
import { clearSnapshots, useSnapshottedQuery } from "@/lib/snapshot";

/**
 * **Server-computed** state.
 *
 * Search, the agent, the review queue, conversations and connections are
 * computed by the server and have no local row. Everything the reader owns — the
 * library list, read state, marks, topics — is local-first and lives in
 * `@/lib/local`, and paints on the first frame.
 *
 * The server-computed surfaces are read through `useSnapshottedQuery`: the last
 * answer is the first paint, and the request revalidates behind it. A repeat
 * visit shows what the reader saw last time, not a skeleton.
 */

export const keys = {
  me: ["me"] as const,
  search: (query: string) => ["search", query] as const,
  connections: (id: number) => ["connections", id] as const,
  reviews: ["reviews"] as const,
  thread: (documentId: number) => ["thread", documentId] as const,
  threads: ["threads"] as const,
  suggestions: ["suggestions"] as const,
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

/** The edges the agent drew from a document — the "More like this" tab. */
export function useConnections(id: number | null) {
  return useSnapshottedQuery(keys.connections(id ?? -1), () => api.getConnections(id as number), {
    enabled: id !== null,
  });
}

/** The marks due for recall. */
export function useReviews(enabled = true) {
  return useSnapshottedQuery(keys.reviews, () => api.listReviews(), { enabled });
}

/** Grade a card; refetch the queue so the next due mark takes its place. */
export function useGradeReview() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ clientId, grade }: { clientId: string; grade: ReviewGrade }) =>
      api.gradeReview(clientId, grade),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: keys.reviews });
    },
  });
}

/** The persisted conversation about a document — the co-reader's memory. */
export function useThread(documentId: number | null) {
  return useSnapshottedQuery(
    keys.thread(documentId ?? -1),
    () => api.getThread(documentId as number),
    { enabled: documentId !== null },
  );
}

/** Library-wide conversations, for the agent's destination. */
export function useThreads(enabled = true) {
  return useSnapshottedQuery(keys.threads, () => api.listThreads(), { enabled, staleTime: 15_000 });
}

/** One library-wide conversation, by id. */
export function useThreadById(id: number | null) {
  return useSnapshottedQuery(["thread", "by-id", id], () => api.getThreadById(id as number), {
    enabled: id !== null,
    staleTime: 15_000,
  });
}

/** Start a conversation, then open it. */
export function useCreateThread() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: () => api.createThread(),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: keys.threads });
    },
  });
}

/** Forget a conversation. */
export function useDeleteThread() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.deleteThread(id),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: keys.threads });
    },
  });
}

/** The ways into the reader's library, derived server-side from their topics. */
export function useSuggestions(enabled = true) {
  return useSnapshottedQuery(keys.suggestions, () => api.listSuggestions(), {
    enabled,
    staleTime: 5 * 60_000,
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
      // snapshots and the local databases are dropped too — they are the old
      // reader's answers.
      client.setQueryData(keys.me, null);
      writeCachedMe(null);
      clearSnapshots();
      client.removeQueries({ predicate: (query) => query.queryKey[0] !== "me" });
    },
  });
}
