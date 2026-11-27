import {
  ApiError,
  createCurioApi,
  type Annotation,
  type AnnotationChange,
  type AnnotationSummary,
  type Connections,
  type DocumentChange,
  type DocumentDetail,
  type LibraryItem,
  type Me,
  type SearchHit,
  type SyncMutation,
  type TopicCount,
} from "@curio/api-client";

export type {
  Annotation,
  AnnotationChange,
  AnnotationSummary,
  Connections,
  DocumentChange,
  DocumentDetail,
  LibraryItem,
  Me,
  SearchHit,
  SyncMutation,
  TopicCount,
};

/**
 * The web's one door to the API. The endpoints live in `@curio/api-client`, so
 * the web owns no fetch of its own — only the two things the client cannot own:
 * the auth endpoints (they set the cookie on this origin) and reading the
 * agent's stream.
 *
 * `baseUrl: ""` means same-origin: Next forwards `/api/*` to the API, which
 * keeps the session cookie working without CORS or SameSite=None.
 */
const api = createCurioApi({ baseUrl: "", credentials: "include" });

export async function me(): Promise<Me | null> {
  try {
    return await api.me.get();
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) return null;
    throw error;
  }
}

export async function signIn(email: string, password: string): Promise<void> {
  const res = await fetch("/api/auth/sign-in/email", {
    method: "POST",
    credentials: "include",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) throw new Error("Wrong email or password.");
}

export async function signUp(email: string, password: string, name: string): Promise<void> {
  const res = await fetch("/api/auth/sign-up/email", {
    method: "POST",
    credentials: "include",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password, name }),
  });
  if (!res.ok) throw new Error("Could not create the account.");
}

/** Clear the session cookie. better-auth owns the endpoint; we own the call. */
export async function signOut(): Promise<void> {
  await fetch("/api/auth/sign-out", { method: "POST", credentials: "include" });
}

export interface LibraryCounts {
  all: number;
  unread: number;
  reading: number;
  read: number;
  archived: number;
  starred: number;
}

export const listDocuments = (params: {
  state?: string;
  kind?: string;
  sort?: "newest" | "oldest";
  favorite?: boolean;
  category?: string;
  topic?: string;
} = {}): Promise<{ documents: LibraryItem[]; counts: LibraryCounts }> =>
  api.library.list(params).then((r) => {
    const c = r.meta?.counts ?? {};
    return {
      documents: r.data,
      counts: {
        all: c.all ?? 0,
        unread: c.unread ?? 0,
        reading: c.reading ?? 0,
        read: c.read ?? 0,
        archived: c.archived ?? 0,
        starred: c.starred ?? 0,
      },
    };
  });

export const getDocument = (id: number): Promise<DocumentDetail> => api.documents.get(id);

/** Just the stored markdown — the content cache's fetch. */
export const getBody = (id: number): Promise<{ markdown: string | null }> => api.documents.body(id);

/** Edges the agent drew from this document to others, in both directions. */
export const getConnections = (id: number): Promise<Connections> => api.documents.connections(id);

/** Paste a link: the API fetches and reads it with the pipeline. */
export const addLink = (url: string): Promise<{ id: number; read: string }> =>
  api.documents.create({ url });

export const saveAnnotation = (
  documentId: number,
  input: Parameters<typeof api.documents.saveAnnotation>[1],
): Promise<{ id: number }> => api.documents.saveAnnotation(documentId, input);

export const markRead = (id: number, state: "read" | "unread"): Promise<unknown> =>
  api.documents.patch(id, { readState: state });

export const setFavorite = (id: number, favorite: boolean): Promise<unknown> =>
  api.documents.patch(id, { favorite });

export const setReadState = (id: number, state: "unread" | "reading" | "read" | "archived"): Promise<unknown> =>
  api.documents.patch(id, { readState: state });

export const archiveDocument = (id: number): Promise<unknown> => setReadState(id, "archived");

export const recolorAnnotation = (clientId: string, hue: number): Promise<unknown> =>
  api.annotations.recolor(clientId, hue);

export const deleteAnnotation = (clientId: string): Promise<unknown> =>
  api.annotations.remove(clientId);

/** The outbox → server. Idempotent on each mutation. */
export const syncPush = (mutations: SyncMutation[]) => api.sync.push(mutations);

/** The server → local feed, per entity. A null cursor is a full pull. */
export const syncPullAnnotations = (
  cursor: string | null,
): Promise<{ cursor: string | null; hasMore: boolean; annotations: AnnotationChange[] }> =>
  api.sync.pullAnnotations(cursor);

export const syncPullDocuments = (
  cursor: string | null,
): Promise<{ cursor: string | null; hasMore: boolean; documents: DocumentChange[] }> =>
  api.sync.pullDocuments(cursor);

export const search = (query: string, mode: "hybrid" | "exact" = "hybrid"): Promise<SearchHit[]> =>
  api.search.query({ q: query, mode });

/** Every category and topic in the library, with counts — the browse index. */
export const listTopics = (): Promise<{ categories: TopicCount[]; topics: TopicCount[] }> =>
  api.topics.list();

/** Every highlight and note, newest first, optionally filtered by text. */
export const listAnnotations = (q?: string): Promise<AnnotationSummary[]> =>
  api.annotations.list(q);

/**
 * Ask the agent. The endpoint streams a UIMessage response; this reads the text
 * deltas out of it and returns the whole answer.
 */
export async function ask(question: string, onDelta: (text: string) => void): Promise<void> {
  const res = await api.ask.stream([
    { id: "q", role: "user", parts: [{ type: "text", text: question }] },
  ]);

  const reader = res.body?.getReader();
  if (!reader) return;

  const decoder = new TextDecoder();
  let buffer = "";

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data:")) continue;
      const payload = trimmed.slice(5).trim();
      if (!payload || payload === "[DONE]") continue;
      try {
        const part = JSON.parse(payload) as { type?: string; delta?: string };
        if (part.type === "text-delta" && part.delta) onDelta(part.delta);
      } catch {
        // ignore keep-alives and non-JSON frames
      }
    }
  }
}
