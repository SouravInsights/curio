import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "API · Curio",
  description:
    "The HTTP API behind Curio and the MCP server, so your own agent can read the same library.",
};

const API = process.env.API_PUBLIC_URL ?? "http://localhost:8787";

const ENDPOINTS: { method: string; path: string; what: string }[] = [
  { method: "GET", path: "/api/v1/library", what: "The reading list, with counts per state. Filter by kind, state, category or topic." },
  { method: "GET", path: "/api/v1/topics", what: "Categories and topics in the library, with counts." },
  { method: "POST", path: "/api/v1/documents", what: "Add a link: fetch, read, summarise, embed." },
  { method: "GET", path: "/api/v1/documents/:id", what: "One document: its markdown and its marks." },
  { method: "GET", path: "/api/v1/documents/:id/connections", what: "Documents this one is connected to." },
  { method: "PATCH", path: "/api/v1/documents/:id", what: "Change its reading state or its star." },
  { method: "POST", path: "/api/v1/documents/:id/annotations", what: "Save a highlight or a note." },
  { method: "PATCH", path: "/api/v1/annotations/:id", what: "Recolour a mark." },
  { method: "DELETE", path: "/api/v1/annotations/:id", what: "Erase a mark." },
  { method: "GET", path: "/api/v1/search", what: "Hybrid search: meaning fused with full text." },
  { method: "GET", path: "/api/v1/annotations", what: "Search your highlights and notes." },
  { method: "POST", path: "/api/v1/ask", what: "Ask the agent. Streams an answer that cites lines." },
  { method: "GET", path: "/api/v1/me", what: "The signed-in reader." },
];

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="type-heading">{title}</h2>
      {children}
    </section>
  );
}

/** How to reach the library from somewhere that isn't this app. */
export default function DocsPage() {
  return (
    <main className="mx-auto flex max-w-[720px] flex-col gap-10 px-6 py-16">
      <header className="flex flex-col gap-2">
        <Link href="/" className="type-caption text-faint-foreground hover:underline">
          ← Library
        </Link>
        <h1 className="type-display">The API</h1>
        <p className="type-body text-muted-foreground">
          Everything the app does goes through this API, and it is the same API your own agent can
          use. Auth is the session cookie, or a bearer token for a machine.
        </p>
      </header>

      <Section title="Endpoints">
        <ul className="flex flex-col">
          {ENDPOINTS.map((endpoint) => (
            <li
              key={`${endpoint.method} ${endpoint.path}`}
              className="flex flex-col gap-1 border-b border-border py-3 sm:flex-row sm:items-baseline sm:gap-4"
            >
              <code className="type-caption w-[62px] shrink-0 font-mono text-foreground">
                {endpoint.method}
              </code>
              <code className="type-caption shrink-0 font-mono text-foreground">
                {endpoint.path}
              </code>
              <span className="type-caption">{endpoint.what}</span>
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Reference">
        <p className="type-body text-muted-foreground">
          The routes declare their request and response schemas, and the reference is generated from
          those — so it cannot drift from what the API actually accepts.
        </p>
        <p className="type-caption">
          <a
            className="text-foreground underline underline-offset-4"
            href={`${API}/docs`}
            target="_blank"
            rel="noreferrer"
          >
            Open the reference
          </a>{" "}
          ·{" "}
          <a
            className="text-foreground underline underline-offset-4"
            href={`${API}/docs/openapi.json`}
            target="_blank"
            rel="noreferrer"
          >
            openapi.json
          </a>
        </p>
      </Section>

      <Section title="MCP">
        <p className="type-body text-muted-foreground">
          The same tools the in-app agent uses — <code>search_library</code>,{" "}
          <code>read_passage</code>, <code>list_library</code>, <code>search_annotations</code>,{" "}
          <code>save_annotation</code>, <code>connect</code> — are exposed over MCP, so pi, Codex,
          Claude Code or Cursor can read this library mid-task.
        </p>
        <pre className="type-caption overflow-x-auto rounded-[var(--radius-card)] border border-border bg-card p-4 font-mono">
          {`{
  "mcpServers": {
    "curio": {
      "url": "${API}/mcp",
      "headers": { "Authorization": "Bearer <session-token>" }
    }
  }
}`}
        </pre>
        <p className="type-caption">
          A local client can skip the token by running the stdio server instead:{" "}
          <code className="font-mono">bun run mcp</code>.
        </p>
      </Section>
    </main>
  );
}
