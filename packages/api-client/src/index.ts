import {
  ApiError,
  type AnnotationChange,
  type AnnotationSummary,
  type ApiErrorBody,
  type Connections,
  type DocumentChange,
  type DocumentDetail,
  type LibraryItem,
  type Me,
  type ReviewCard,
  type ReviewGrade,
  type ReviewStats,
  type SearchHit,
  type SyncMutation,
  type ThreadMessage,
  type ThreadSummary,
  type TopicCount,
} from "./types";

/**
 * A typed client for the Curio API.
 *
 * Deliberately thin: one `request` helper, one method per endpoint, no
 * framework. The web wraps these with its own state; a native client calls them
 * directly. Nothing here validates or authorises — the API is the only place
 * that does.
 */

/** `next` is Next.js's cache hint; a non-Next runtime ignores it. */
export type ApiFetchInit = RequestInit & {
  next?: { revalidate?: number | false; tags?: string[] };
};

export type ApiFetch = (input: string, init?: ApiFetchInit) => Promise<Response>;

export interface ApiClientOptions {
  /** Origin of the API. Empty string means same-origin (the Next rewrite). */
  baseUrl: string;
  /** Override `fetch` (tests, or a customised runtime). */
  fetch?: ApiFetch;
  /** Per-request headers: the session cookie on the server, a bearer token on native. */
  headers?: () => HeadersInit | Promise<HeadersInit>;
  /** `include` in the browser so the session cookie is sent. */
  credentials?: RequestCredentials;
  /** Init applied to every request before the per-call init. */
  defaultInit?: ApiFetchInit;
}

export function createApiClient(options: ApiClientOptions) {
  const baseUrl = options.baseUrl.replace(/\/+$/, "");
  const doFetch: ApiFetch = options.fetch ?? ((input, init) => fetch(input, init));

  /** The raw response — for a caller that streams it (the agent). */
  async function requestRaw(path: string, init?: ApiFetchInit): Promise<Response> {
    const headers = new Headers(init?.headers);
    if (options.headers) {
      new Headers(await options.headers()).forEach((value, key) => headers.set(key, value));
    }

    const response = await doFetch(`${baseUrl}${path}`, {
      ...options.defaultInit,
      ...init,
      headers,
      credentials: options.credentials,
    });

    if (!response.ok) {
      let body: ApiErrorBody | null = null;
      try {
        body = (await response.json()) as ApiErrorBody;
      } catch {
        body = null;
      }
      throw new ApiError(response.status, body);
    }

    return response;
  }

  async function request<T>(path: string, init?: ApiFetchInit): Promise<T> {
    const response = await requestRaw(path, init);
    if (response.status === 204) return undefined as T;
    return (await response.json()) as T;
  }

  return { request, requestRaw };
}

export function createCurioApi(options: ApiClientOptions) {
  const client = createApiClient(options);
  const query = (params: Record<string, string | number | boolean | undefined>) => {
    const search = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null) search.set(key, String(value));
    }
    const qs = search.toString();
    return qs ? `?${qs}` : "";
  };

  return {
    request: client.request,

    me: {
      get: (init?: ApiFetchInit) =>
        client.request<{ data: Me }>("/api/v1/me", init).then((r) => r.data),
    },

    library: {
      list: (
        params: {
          kind?: string;
          state?: string;
          limit?: number;
          sort?: "newest" | "oldest";
          favorite?: boolean;
          topic?: string;
        } = {},
        init?: ApiFetchInit,
      ) =>
        client.request<{
          data: LibraryItem[];
          meta: { counts: Record<string, number> };
        }>(`/api/v1/library${query(params)}`, init),
    },

    topics: {
      /** The subjects in the library, with counts — the browse index. */
      list: (init?: ApiFetchInit) =>
        client
          .request<{ data: TopicCount[] }>("/api/v1/topics", init)
          .then((r) => r.data),
    },

    search: {
      query: (
        params: { q: string; mode?: "hybrid" | "semantic" | "exact"; kind?: string; limit?: number },
        init?: ApiFetchInit,
      ) =>
        client
          .request<{ data: SearchHit[] }>(`/api/v1/search${query(params)}`, init)
          .then((r) => r.data),
    },

    documents: {
      /** Add a link; the API reads it and returns the new document. */
      create: (input: { url: string; kind?: string }, init?: ApiFetchInit) =>
        client
          .request<{ data: { id: number; created: boolean; read: string } }>("/api/v1/documents", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(input),
            ...init,
          })
          .then((r) => r.data),

      list: (
        params: { kind?: string; state?: string; limit?: number; sort?: "newest" | "oldest" } = {},
        init?: ApiFetchInit,
      ) =>
        client
          .request<{ data: LibraryItem[] }>(`/api/v1/documents${query(params)}`, init)
          .then((r) => r.data),

      patch: (
        id: number,
        body: { readState?: string; favorite?: boolean; readProgress?: number },
        init?: ApiFetchInit,
      ) =>
        client.request<{ data: { ok: boolean } }>(`/api/v1/documents/${id}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
          ...init,
        }),

      get: (id: number, init?: ApiFetchInit) =>
        client.request<{ data: DocumentDetail }>(`/api/v1/documents/${id}`, init).then((r) => r.data),

      /** Just the stored markdown, for the reader's content cache. */
      body: (id: number, init?: ApiFetchInit) =>
        client
          .request<{ data: { markdown: string | null } }>(`/api/v1/documents/${id}/body`, init)
          .then((r) => r.data),

      /** Edges the agent drew to other documents, in both directions. */
      connections: (id: number, init?: ApiFetchInit) =>
        client
          .request<{ data: Connections }>(`/api/v1/documents/${id}/connections`, init)
          .then((r) => r.data),

      saveAnnotation: (
        id: number,
        input: {
          clientId?: string;
          quote?: string;
          prefix?: string;
          suffix?: string;
          occurrence?: number;
          hue?: number;
          startLine?: number;
          endLine?: number;
          body?: string;
          kind?: "highlight" | "note";
        },
        init?: ApiFetchInit,
      ) =>
        client
          .request<{ data: { id: number; clientId: string } }>(
            `/api/v1/documents/${id}/annotations`,
            {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify(input),
              ...init,
            },
          )
          .then((r) => r.data),
    },

    annotations: {
      /** Addressed by the mark's client-minted identity, not the Postgres row. */
      recolor: (clientId: string, hue: number, init?: ApiFetchInit) =>
        client.request<{ data: { ok: boolean } }>(`/api/v1/annotations/${clientId}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ hue }),
          ...init,
        }),

      remove: (clientId: string, init?: ApiFetchInit) =>
        client.request<{ data: { ok: boolean } }>(`/api/v1/annotations/${clientId}`, {
          method: "DELETE",
          ...init,
        }),

      list: (
        params: { q?: string; archived?: "library" | "archived" | "all" } = {},
        init?: ApiFetchInit,
      ) =>
        client
          .request<{ data: AnnotationSummary[] }>(`/api/v1/annotations${query(params)}`, init)
          .then((r) => r.data),
    },

    reviews: {
      /** The marks due for recall, with the counts. */
      list: (init?: ApiFetchInit) =>
        client
          .request<{ data: { cards: ReviewCard[]; stats: ReviewStats } }>("/api/v1/reviews", init)
          .then((r) => r.data),

      grade: (clientId: string, grade: ReviewGrade, init?: ApiFetchInit) =>
        client
          .request<{ data: { clientId: string; interval: number; dueAt: string } }>(
            `/api/v1/reviews/${clientId}`,
            {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ grade }),
              ...init,
            },
          )
          .then((r) => r.data),
    },

    sync: {
      /** Apply a batch of local mutations. Idempotent on each mutation's id. */
      push: (
        mutations: SyncMutation[],
        init?: ApiFetchInit,
      ) =>
        client
          .request<{
            data: {
              applied: number[];
              failed: { seq: number; code: string; message: string }[];
            };
          }>("/api/v1/sync/push", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ mutations }),
            ...init,
          })
          .then((r) => r.data),

      /** Annotation changes since a cursor. Null cursor is a full pull. */
      pullAnnotations: (cursor: string | null, init?: ApiFetchInit) =>
        client
          .request<{
            data: { cursor: string | null; hasMore: boolean; annotations: AnnotationChange[] };
          }>(`/api/v1/sync/pull${query({ entity: "annotation", cursor: cursor ?? undefined })}`, init)
          .then((r) => r.data),

      /** Document (library list) changes since a cursor. */
      pullDocuments: (cursor: string | null, init?: ApiFetchInit) =>
        client
          .request<{
            data: { cursor: string | null; hasMore: boolean; documents: DocumentChange[] };
          }>(`/api/v1/sync/pull${query({ entity: "document", cursor: cursor ?? undefined })}`, init)
          .then((r) => r.data),
    },

    ask: {
      /** Returns the raw streaming response; the caller reads the deltas. */
      stream: (
        input: { message: unknown; threadId?: number; documentId?: number },
        init?: ApiFetchInit,
      ) =>
        client.requestRaw("/api/v1/ask", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(input),
          ...init,
        }),
    },

    threads: {
      /** Library-wide conversations, newest activity first. */
      list: (init?: ApiFetchInit) =>
        client.request<{ data: ThreadSummary[] }>("/api/v1/threads", init).then((r) => r.data),

      /** Start a library-wide conversation. */
      create: (init?: ApiFetchInit) =>
        client
          .request<{ data: { id: number } }>("/api/v1/threads", { method: "POST", ...init })
          .then((r) => r.data),

      get: (id: number, init?: ApiFetchInit) =>
        client
          .request<{
            data: { id: number; documentId: number | null; title: string; messages: ThreadMessage[] };
          }>(`/api/v1/threads/${id}`, init)
          .then((r) => r.data),

      remove: (id: number, init?: ApiFetchInit) =>
        client.request<{ data: { ok: boolean } }>(`/api/v1/threads/${id}`, {
          method: "DELETE",
          ...init,
        }),

      /** The co-reader conversation beside one document. */
      byDocument: (documentId: number, init?: ApiFetchInit) =>
        client
          .request<{ data: { threadId: number | null; messages: ThreadMessage[] } }>(
            `/api/v1/threads/by-document/${documentId}`,
            init,
          )
          .then((r) => r.data),

      clearDocument: (documentId: number, init?: ApiFetchInit) =>
        client.request<{ data: { ok: boolean } }>(`/api/v1/threads/by-document/${documentId}`, {
          method: "DELETE",
          ...init,
        }),
    },

    suggestions: {
      /** Question chips derived from the reader's own library. */
      list: (init?: ApiFetchInit) =>
        client.request<{ data: string[] }>("/api/v1/suggestions", init).then((r) => r.data),
    },
  };
}

export type CurioApi = ReturnType<typeof createCurioApi>;
export { ApiError };
export type {
  Annotation,
  AnnotationChange,
  AnnotationSummary,
  DocumentChange,
  ApiErrorBody,
  ConnectedDocument,
  ConnectionEdge,
  Connections,
  DocumentDetail,
  LibraryItem,
  Me,
  ReviewCard,
  ReviewGrade,
  ReviewStats,
  SearchHit,
  SyncMutation,
  ThreadMessage,
  ThreadSummary,
  TopicCount,
} from "./types";
