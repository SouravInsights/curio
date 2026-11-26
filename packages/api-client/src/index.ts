import {
  ApiError,
  type AnnotationSummary,
  type ApiErrorBody,
  type DocumentDetail,
  type LibraryItem,
  type Me,
  type SearchHit,
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
  const query = (params: Record<string, string | number | undefined>) => {
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
        params: { kind?: string; state?: string; limit?: number; sort?: "newest" | "oldest" } = {},
        init?: ApiFetchInit,
      ) =>
        client.request<{
          data: LibraryItem[];
          meta: { counts: Record<string, number> };
        }>(`/api/v1/library${query(params)}`, init),
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

      setReadState: (id: number, readState: string, init?: ApiFetchInit) =>
        client.request<{ data: { ok: boolean } }>(`/api/v1/documents/${id}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ readState }),
          ...init,
        }),

      get: (id: number, init?: ApiFetchInit) =>
        client.request<{ data: DocumentDetail }>(`/api/v1/documents/${id}`, init).then((r) => r.data),

      saveAnnotation: (
        id: number,
        input: {
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
          .request<{ data: { id: number } }>(`/api/v1/documents/${id}/annotations`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(input),
            ...init,
          })
          .then((r) => r.data),
    },

    annotations: {
      recolor: (id: number, hue: number, init?: ApiFetchInit) =>
        client.request<{ data: { ok: boolean } }>(`/api/v1/annotations/${id}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ hue }),
          ...init,
        }),

      remove: (id: number, init?: ApiFetchInit) =>
        client.request<{ data: { ok: boolean } }>(`/api/v1/annotations/${id}`, {
          method: "DELETE",
          ...init,
        }),

      list: (q?: string, init?: ApiFetchInit) =>
        client
          .request<{ data: AnnotationSummary[] }>(`/api/v1/annotations${query({ q })}`, init)
          .then((r) => r.data),
    },

    ask: {
      /** Returns the raw streaming response; the caller reads the deltas. */
      stream: (messages: unknown[], init?: ApiFetchInit) =>
        client.requestRaw("/api/v1/ask", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ messages }),
          ...init,
        }),
    },
  };
}

export type CurioApi = ReturnType<typeof createCurioApi>;
export { ApiError };
export type {
  Annotation,
  AnnotationSummary,
  ApiErrorBody,
  DocumentDetail,
  LibraryItem,
  Me,
  SearchHit,
} from "./types";
