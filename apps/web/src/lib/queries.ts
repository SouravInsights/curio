"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as api from "@/lib/api";
import { clearPersistedCache } from "@/lib/persist";
import type { DocumentDetail, LibraryCounts, LibraryItem } from "@/lib/api";

/**
 * Server state, in one place.
 *
 * Every read is a query and every write is a mutation, which buys three things
 * that were hand-rolled before and are now declared once:
 *
 * - **Cache.** The same document asked for twice is fetched once, and a revisit
 *   is instant. That was a `Map` in a ref.
 * - **Prefetch.** `prefetchQuery` on hover, same cache. That was a bespoke
 *   `prefetchDocument`.
 * - **Optimistic writes.** `onMutate` paints, `onError` rolls back, `onSettled`
 *   reconciles. That was written out four times by hand.
 */

export interface LibraryFilter {
  state?: string;
  sort?: "newest" | "oldest";
  favorite?: boolean;
  category?: string;
  topic?: string;
}

interface LibraryData {
  documents: LibraryItem[];
  counts: LibraryCounts;
}

export const keys = {
  me: ["me"] as const,
  library: (filter: LibraryFilter) => ["library", filter] as const,
  libraries: ["library"] as const,
  document: (id: number) => ["document", id] as const,
  connections: (id: number) => ["connections", id] as const,
  search: (query: string) => ["search", query] as const,
  topics: ["topics"] as const,
  annotations: (query: string) => ["annotations", query] as const,
  annotationsRoot: ["annotations"] as const,
};

export function useMe() {
  return useQuery({ queryKey: keys.me, queryFn: () => api.me(), staleTime: 5 * 60_000 });
}

/**
 * `enabled` matters: without it this fires before sign-in, caches the 401, and
 * the list stays empty after a successful login.
 */
export function useLibrary(filter: LibraryFilter, enabled = true) {
  return useQuery({
    queryKey: keys.library(filter),
    queryFn: () => api.listDocuments(filter),
    enabled,
    // A filter change is a paint, not a page load. Keep the current rows up
    // while the next filter arrives, so the list never flashes a skeleton.
    placeholderData: keepPreviousData,
    staleTime: 60_000,
  });
}

export function useDocument(id: number | null) {
  return useQuery({
    queryKey: keys.document(id ?? -1),
    queryFn: () => api.getDocument(id as number),
    enabled: id !== null,
    // Reopening a document is instant. The prefetch warms the same cache.
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

/** Sign out and drop every cached answer — they belong to the old identity. */
export function useSignOut() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: () => api.signOut(),
    onSuccess: () => {
      // Mark `me` signed-out first, so the shell flips to SignIn on the next
      // render; then drop the rest, which belonged to the old identity.
      client.setQueryData(keys.me, null);
      client.removeQueries({ predicate: (query) => query.queryKey[0] !== "me" });
      // The memory cache is gone; the disk copy must go too, or the next person
      // on this device reads the previous identity's documents on cold start.
      void clearPersistedCache();
    },
  });
}

/** Warm a document before the click lands. */
export function usePrefetchDocument() {
  const client = useQueryClient();
  return (id: number) =>
    client.prefetchQuery({
      queryKey: keys.document(id),
      queryFn: () => api.getDocument(id),
      staleTime: 5 * 60_000,
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

/** Patch one document in the cache, and every cached list, in one move. */
function paint(
  client: ReturnType<typeof useQueryClient>,
  id: number,
  patch: Partial<LibraryItem & DocumentDetail>,
) {
  client.setQueryData<DocumentDetail>(keys.document(id), (doc) =>
    doc ? { ...doc, ...patch } : doc,
  );
  client.setQueriesData<LibraryData>({ queryKey: keys.libraries }, (data) =>
    data
      ? {
          ...data,
          documents: data.documents.map((row) => (row.id === id ? { ...row, ...patch } : row)),
        }
      : data,
  );
}

/** The previous values, so a failed write can be undone exactly. */
function snapshot(client: ReturnType<typeof useQueryClient>, id: number) {
  return {
    doc: client.getQueryData<DocumentDetail>(keys.document(id)),
    lists: client.getQueriesData<LibraryData>({ queryKey: keys.libraries }),
  };
}

function restore(
  client: ReturnType<typeof useQueryClient>,
  id: number,
  previous: ReturnType<typeof snapshot> | undefined,
) {
  if (!previous) return;
  client.setQueryData(keys.document(id), previous.doc);
  for (const [key, data] of previous.lists) client.setQueryData(key, data);
}

export function useSetFavorite() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, favorite }: { id: number; favorite: boolean }) =>
      api.setFavorite(id, favorite),
    onMutate: async ({ id, favorite }) => {
      const previous = snapshot(client, id);
      paint(client, id, { favorite });
      return previous;
    },
    onError: (_error, { id }, previous) => restore(client, id, previous),
    onSettled: () => client.invalidateQueries({ queryKey: keys.libraries }),
  });
}

export function useSetReadState() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, state }: { id: number; state: "unread" | "reading" | "read" }) =>
      api.setReadState(id, state),
    onMutate: async ({ id, state }) => {
      const previous = snapshot(client, id);
      paint(client, id, { readState: state });
      return previous;
    },
    onError: (_error, { id }, previous) => restore(client, id, previous),
    onSettled: () => client.invalidateQueries({ queryKey: keys.libraries }),
  });
}

/** Archiving removes the row, so the row goes before the request does. */
export function useArchive() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.archiveDocument(id),
    onMutate: async (id) => {
      const previous = snapshot(client, id);
      client.setQueriesData<LibraryData>({ queryKey: keys.libraries }, (data) =>
        data ? { ...data, documents: data.documents.filter((row) => row.id !== id) } : data,
      );
      return previous;
    },
    onError: (_error, id, previous) => restore(client, id, previous),
    onSettled: () => client.invalidateQueries({ queryKey: keys.libraries }),
  });
}

export function useUnarchive() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.setReadState(id, "unread"),
    onMutate: async (id) => {
      const previous = snapshot(client, id);
      paint(client, id, { readState: "unread" });
      return previous;
    },
    onError: (_error, id, previous) => restore(client, id, previous),
    onSettled: () => client.invalidateQueries({ queryKey: keys.libraries }),
  });
}

/**
 * Marks. The highlight engine paints the mark itself, so the mutation's only
 * job is to write and then reconcile the document's annotation list.
 */
export function useSaveAnnotation(documentId: number) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: Parameters<typeof api.saveAnnotation>[1]) =>
      api.saveAnnotation(documentId, input),
    onSettled: () => {
      void client.invalidateQueries({ queryKey: keys.document(documentId) });
      void client.invalidateQueries({ queryKey: keys.annotationsRoot });
    },
  });
}

export function useRecolorAnnotation(documentId: number) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, hue }: { id: number; hue: number }) => api.recolorAnnotation(id, hue),
    onSettled: () => {
      void client.invalidateQueries({ queryKey: keys.document(documentId) });
      void client.invalidateQueries({ queryKey: keys.annotationsRoot });
    },
  });
}

export function useDeleteAnnotation(documentId: number) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.deleteAnnotation(id),
    onSettled: () => {
      void client.invalidateQueries({ queryKey: keys.document(documentId) });
      void client.invalidateQueries({ queryKey: keys.annotationsRoot });
    },
  });
}

/** Adding a link reads the page server-side, so there is nothing to be optimistic about. */
export function useAddLink() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (url: string) => api.addLink(url),
    onSuccess: () => client.invalidateQueries({ queryKey: keys.libraries }),
  });
}
