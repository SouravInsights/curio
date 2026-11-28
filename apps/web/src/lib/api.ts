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
  type ReviewCard,
  type ReviewGrade,
  type ReviewStats,
  type SearchHit,
  type SyncMutation,
  type ThreadMessage,
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
  ReviewCard,
  ReviewGrade,
  ReviewStats,
  SearchHit,
  SyncMutation,
  ThreadMessage,
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

/** The marks due for recall, and the counts. */
export const listReviews = (): Promise<{ cards: ReviewCard[]; stats: ReviewStats }> =>
  api.reviews.list();

/** Grade a recall card; the server schedules when it returns. */
export const gradeReview = (clientId: string, grade: ReviewGrade) =>
  api.reviews.grade(clientId, grade);

/** A document's conversation so far. */
export const getThread = (
  documentId: number,
): Promise<{ threadId: number | null; messages: ThreadMessage[] }> => api.threads.get(documentId);

/** Forget a document's conversation. */
export const clearThread = (documentId: number) => api.threads.clear(documentId);

/**
 * Ask the agent. The endpoint streams a UIMessage response; this reads the text
 * deltas out of it, and the citations out of the tool results.
 *
 * Citations come from tool output, never from the model's prose. A document or
 * line the retrieval did not return cannot appear as a source — the same
 * structural guarantee the agent loop makes on the server.
 */
export interface AgentSource {
  documentId: number;
  title: string;
  startLine: number;
  endLine: number;
  /** The first words of the actual span, so the source is recognisable. */
  snippet: string;
}

export interface AskHandlers {
  onDelta?: (text: string) => void;
  onSources?: (sources: AgentSource[]) => void;
}

/** Keep a source preview to one readable line; the text itself is a click away. */
function snippetOf(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.replace(/\s+/g, " ").trim().slice(0, 160);
}

/** The citations a tool's output carries, normalized to line spans. */
function citationsFrom(tool: string | undefined, output: unknown): AgentSource[] {
  if (!output || typeof output !== "object") return [];
  const o = output as Record<string, unknown>;

  if (tool === "search_library") {
    const matches = Array.isArray(o.matches) ? o.matches : [];
    return matches.flatMap((raw) => {
      const doc = raw as {
        documentId?: number;
        title?: string;
        passages?: { startLine?: number; endLine?: number; text?: string }[];
      };
      if (typeof doc.documentId !== "number") return [];
      return (doc.passages ?? [])
        .filter((p) => typeof p.startLine === "number" && p.startLine > 0)
        .map((p) => ({
          documentId: doc.documentId!,
          title: doc.title ?? "",
          startLine: p.startLine!,
          endLine: p.endLine ?? p.startLine!,
          snippet: snippetOf(p.text),
        }));
    });
  }

  if (tool === "read_passage") {
    if (typeof o.documentId !== "number" || typeof o.startLine !== "number") return [];
    return [
      {
        documentId: o.documentId,
        title: typeof o.title === "string" ? o.title : "",
        startLine: o.startLine,
        endLine: typeof o.endLine === "number" ? o.endLine : o.startLine,
        snippet: snippetOf(o.text),
      },
    ];
  }

  if (tool === "search_annotations") {
    const annotations = Array.isArray(o.annotations) ? o.annotations : [];
    return annotations.flatMap((raw) => {
      const ann = raw as {
        documentId?: number;
        title?: string;
        quote?: string;
        startLine?: number | null;
        endLine?: number | null;
      };
      if (typeof ann.documentId !== "number" || typeof ann.startLine !== "number") return [];
      return [
        {
          documentId: ann.documentId,
          title: ann.title ?? "",
          startLine: ann.startLine,
          endLine: ann.endLine ?? ann.startLine,
          snippet: snippetOf(ann.quote),
        },
      ];
    });
  }

  return [];
}

export async function ask(
  documentId: number,
  question: string,
  handlers: AskHandlers = {},
): Promise<void> {
  const res = await api.ask.stream({
    documentId,
    message: {
      id: crypto.randomUUID(),
      role: "user",
      parts: [{ type: "text", text: question }],
    },
  });

  const reader = res.body?.getReader();
  if (!reader) return;

  const decoder = new TextDecoder();
  let buffer = "";
  // A tool's name rides on its input chunk; the output chunk carries only the
  // call id. Track the pair so a result can be read as the tool that made it.
  const toolNames = new Map<string, string>();
  const sources = new Map<string, AgentSource>();
  const emit = () => handlers.onSources?.([...sources.values()]);

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
      let part: {
        type?: string;
        delta?: string;
        toolCallId?: string;
        toolName?: string;
        output?: unknown;
      };
      try {
        part = JSON.parse(payload);
      } catch {
        continue; // keep-alives and non-JSON frames
      }
      if (part.type === "text-delta" && part.delta) {
        handlers.onDelta?.(part.delta);
      } else if (part.type === "tool-input-available" && part.toolCallId && part.toolName) {
        toolNames.set(part.toolCallId, part.toolName);
      } else if (part.type === "tool-output-available" && part.toolCallId) {
        for (const source of citationsFrom(toolNames.get(part.toolCallId), part.output)) {
          sources.set(`${source.documentId}:${source.startLine}:${source.endLine}`, source);
        }
        emit();
      }
    }
  }
}
