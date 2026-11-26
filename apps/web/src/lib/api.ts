import {
  ApiError,
  createCurioApi,
  type Annotation,
  type AnnotationSummary,
  type DocumentDetail,
  type LibraryItem,
  type Me,
  type SearchHit,
} from "@curio/api-client";

export type { Annotation, AnnotationSummary, DocumentDetail, LibraryItem, Me, SearchHit };

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

export const listDocuments = (): Promise<LibraryItem[]> => api.library.list();

export const getDocument = (id: number): Promise<DocumentDetail> => api.documents.get(id);

/** Paste a link: the API fetches and reads it with the pipeline. */
export const addLink = (url: string): Promise<{ id: number; read: string }> =>
  api.documents.create({ url });

export const saveAnnotation = (
  documentId: number,
  input: Parameters<typeof api.documents.saveAnnotation>[1],
): Promise<{ id: number }> => api.documents.saveAnnotation(documentId, input);

export const archiveDocument = (id: number): Promise<unknown> =>
  api.documents.setReadState(id, "archived");

export const recolorAnnotation = (id: number, hue: number): Promise<unknown> =>
  api.annotations.recolor(id, hue);

export const deleteAnnotation = (id: number): Promise<unknown> => api.annotations.remove(id);

export const search = (query: string, mode: "hybrid" | "exact" = "hybrid"): Promise<SearchHit[]> =>
  api.search.query({ q: query, mode });

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
