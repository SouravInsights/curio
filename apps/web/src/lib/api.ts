/**
 * The app's only door to the server. Same-origin in production; Vite proxies
 * `/api` in dev, so every call sends the session cookie without extra setup.
 */

export interface LibraryItem {
  id: number;
  title: string;
  url: string | null;
  site: string;
  author: string;
  kind: string;
  category: string | null;
  readState: string;
  addedAt: string;
  wordCount?: number | null;
}

export interface Annotation {
  id: number;
  documentId: number;
  kind: "highlight" | "note";
  quote: string;
  prefix: string;
  suffix: string;
  occurrence: number;
  hue: number;
  body: string;
  startLine: number | null;
  endLine: number | null;
}

export interface DocumentDetail {
  id: number;
  externalId: string;
  url: string | null;
  title: string;
  author: string;
  site: string;
  kind: string;
  category: string | null;
  summary: string | null;
  topics: string[] | null;
  wordCount: number | null;
  readState: string;
  markdown: string | null;
  annotations: Annotation[];
}

export interface SearchHit {
  documentId: number;
  title: string;
  url: string | null;
  kind: string;
  passages: { content: string; startLine: number; endLine: number }[];
}

async function json<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    credentials: "include",
    headers: { "content-type": "application/json" },
    ...init,
  });
  if (res.status === 401) throw new Unauthorized();
  if (!res.ok) throw new Error((await res.text().catch(() => "")) || `HTTP ${res.status}`);
  return (await res.json()) as T;
}

export class Unauthorized extends Error {}

export interface Me {
  id: string;
  email: string;
  name: string;
}

export async function me(): Promise<Me | null> {
  const res = await fetch("/api/v1/me", { credentials: "include" });
  if (!res.ok) return null;
  return ((await res.json()) as { data: Me }).data;
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

export function listDocuments(): Promise<LibraryItem[]> {
  return json<{ data: LibraryItem[] }>("/api/v1/library").then((r) => r.data);
}

export function getDocument(id: number): Promise<DocumentDetail> {
  return json<{ data: DocumentDetail }>(`/api/v1/documents/${id}`).then((r) => r.data);
}

export function saveAnnotation(
  documentId: number,
  input: Partial<Annotation> & { quote: string },
): Promise<{ id: number }> {
  return json<{ data: { id: number } }>(`/api/v1/documents/${documentId}/annotations`, {
    method: "POST",
    body: JSON.stringify(input),
  }).then((r) => r.data);
}

export function search(query: string, mode: "hybrid" | "exact" = "hybrid"): Promise<SearchHit[]> {
  return json<{ data: SearchHit[] }>(
    `/api/v1/search?q=${encodeURIComponent(query)}&mode=${mode}`,
  ).then((r) => r.data);
}

/**
 * Ask the agent. The endpoint streams a UIMessage response; this reads the
 * text deltas out of it. Returns the whole answer.
 */
export async function ask(
  question: string,
  onDelta: (text: string) => void,
): Promise<void> {
  const res = await fetch("/api/v1/ask", {
    method: "POST",
    credentials: "include",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ messages: [{ id: "q", role: "user", parts: [{ type: "text", text: question }] }] }),
  });
  if (!res.ok || !res.body) {
    throw new Error((await res.text().catch(() => "")) || `HTTP ${res.status}`);
  }

  const reader = res.body.getReader();
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
