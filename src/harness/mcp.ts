import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { KINDS } from "@/kb/kinds.ts";
import type { Scope } from "@/agent/actions.ts";
import {
  connectDocuments,
  getDocument,
  listLibrary,
  readPassage,
  saveAnnotation,
  searchAnnotations,
  searchLibrary,
} from "@/agent/actions.ts";
import { SYSTEM_PROMPT } from "@/agent/prompt.ts";

/**
 * The library as an MCP server — so pi, Codex, Claude Code or Cursor can read
 * and write it mid-task.
 *
 * Defined once and mounted twice: this stdio server for a local client (via the
 * CLI), and the HTTP endpoint in `src/server` for a remote one. The tools call
 * the same `actions` the in-app agent does, so there is one retrieval path.
 *
 * `register` exists for a compiler reason, not a design one: the SDK's own
 * `registerTool` infers a type so deep that `tsc` runs out of heap (TS2589 /
 * OOM). This wrapper keeps the handler's args typed from the zod shape while
 * calling the SDK through a narrow signature. Validation is unchanged — the SDK
 * still parses the input with zod at runtime.
 */

const NAME = "curio";
const VERSION = "0.1.0";

type TextResult = { content: { type: "text"; text: string }[] };
type ToolConfig = { title?: string; description?: string; inputSchema: Record<string, unknown> };

const text = (value: unknown): TextResult["content"] => [
  {
    type: "text",
    text: typeof value === "string" ? value : JSON.stringify(value, null, 2),
  },
];

function register<S extends z.ZodRawShape>(
  server: McpServer,
  name: string,
  config: { title?: string; description?: string; inputSchema: S },
  handler: (args: z.infer<z.ZodObject<S>>) => Promise<TextResult>,
): void {
  const call = server.registerTool as unknown as (
    n: string,
    c: ToolConfig,
    h: (args: unknown) => Promise<TextResult>,
  ) => void;
  call(name, config, handler as (args: unknown) => Promise<TextResult>);
}

export function createCurioServer(scope: Scope): McpServer {
  const server = new McpServer({ name: NAME, version: VERSION });

  register(
    server,
    "search_library",
    {
      title: "Search the reading library",
      description:
        "Search everything the reader has imported — articles, newsletters, books, " +
        "PDFs — by meaning and by literal text. Returns documents with the matched " +
        "passages and their line spans, so anything quoted can be cited precisely. " +
        "Use mode 'exact' for a literal phrase or rare proper noun.",
      inputSchema: {
        query: z.string().describe("What to look for, in plain words"),
        mode: z.enum(["hybrid", "semantic", "exact"]).optional(),
        kind: z.enum(KINDS).optional(),
        limit: z.number().int().min(1).max(20).optional(),
      },
    },
    async ({ query, mode, kind, limit }) => {
      const hits = await searchLibrary(scope, query, { mode, kind, limit: limit ?? 8 });
      if (hits.length === 0) {
        return { content: text(`Nothing in the library matches "${query}". Say so rather than guessing.`) };
      }
      const body = hits
        .map((hit, i) =>
          [
            `${i + 1}. ${hit.title} [document ${hit.documentId}]${hit.url ? ` — ${hit.url}` : ""}`,
            ...hit.passages.map(
              (p) =>
                `   lines ${p.startLine}-${p.endLine}: ${p.content.replace(/\s+/g, " ").slice(0, 600)}`,
            ),
          ].join("\n"),
        )
        .join("\n\n");
      return { content: text(`${hits.length} result(s) for "${query}":\n\n${body}`) };
    },
  );

  register(
    server,
    "read_passage",
    {
      title: "Read a span",
      description:
        "Read a document's text by line span. Use line numbers a search returned " +
        "to quote exactly, or to read around them.",
      inputSchema: {
        documentId: z.number().int(),
        startLine: z.number().int().optional(),
        endLine: z.number().int().optional(),
      },
    },
    async ({ documentId, startLine, endLine }) => {
      const result = await readPassage(scope, documentId, startLine, endLine);
      if (!result) return { content: text("No such document, or it has no stored text.") };
      return {
        content: text(`${result.title} — lines ${result.startLine}-${result.endLine}\n\n${result.text}`),
      };
    },
  );

  register(
    server,
    "list_library",
    {
      title: "List recent reading",
      description: "Recently added documents, optionally by kind or reading state.",
      inputSchema: {
        kind: z.enum(KINDS).optional(),
        readState: z.enum(["unread", "reading", "read", "archived"]).optional(),
        limit: z.number().int().min(1).max(50).optional(),
      },
    },
    async (input) => ({ content: text(await listLibrary(scope, input)) }),
  );

  register(
    server,
    "search_annotations",
    {
      title: "Search highlights and notes",
      description: "The reader's own highlights and notes, matched on quote or body.",
      inputSchema: { query: z.string(), limit: z.number().int().min(1).max(50).optional() },
    },
    async ({ query, limit }) => ({ content: text(await searchAnnotations(scope, query, limit ?? 20)) }),
  );

  register(
    server,
    "get_document",
    {
      title: "Document metadata",
      description: "A document's metadata, summary and topics.",
      inputSchema: { documentId: z.number().int() },
    },
    async ({ documentId }) => {
      const doc = await getDocument(scope, documentId);
      return { content: text(doc ?? "No such document.") };
    },
  );

  register(
    server,
    "save_annotation",
    {
      title: "Save a highlight or note",
      description: "Write a highlight or note onto a document span.",
      inputSchema: {
        documentId: z.number().int(),
        quote: z.string().optional(),
        body: z.string().optional(),
        startLine: z.number().int().optional(),
        endLine: z.number().int().optional(),
        kind: z.enum(["highlight", "note"]).optional(),
      },
    },
    async (input) => ({ content: text(await saveAnnotation(scope, input)) }),
  );

  register(
    server,
    "connect",
    {
      title: "Connect two documents",
      description:
        "Record that two documents agree, contradict, or extend each other. Call it " +
        "after reading both spans and finding the link.",
      inputSchema: {
        fromDocumentId: z.number().int(),
        toDocumentId: z.number().int(),
        kind: z.enum(["agrees", "contradicts", "extends", "references", "related"]).optional(),
        note: z.string().optional(),
      },
    },
    async (input) => ({ content: text(await connectDocuments(scope, input)) }),
  );

  // The agent's own instructions, exposed as a resource so a client can align
  // its behaviour with the in-app agent.
  server.registerResource(
    "instructions",
    "curio://instructions",
    { title: "Curio agent instructions", mimeType: "text/plain" },
    async (uri) => ({ contents: [{ uri: uri.href, text: SYSTEM_PROMPT }] }),
  );

  return server;
}

/** Serve over stdio — the local client path (pi, Claude Code, Cursor). */
export async function serveStdio(scope: Scope): Promise<void> {
  const server = createCurioServer(scope);
  await server.connect(new StdioServerTransport());
}
