import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { KINDS } from "@curio/core/kb/kinds";
import type { Scope } from "@curio/core/services/scope";
import { getDocument, listLibrary, listTopics, readPassage, setReadState } from "@curio/core/services/library";
import {
  connectDocuments,
  saveAnnotation,
  searchAnnotations,
} from "@curio/core/services/annotations";
import { searchLibrary } from "@curio/core/services/search";
import { addLink, saveNote } from "@curio/core/imports/ingest";
import { getProfile, saveProfile } from "@curio/core/services/profile";
import { SYSTEM_PROMPT } from "@curio/core/agent/prompt";
import { readingSkills } from "@curio/core/agent/skills";

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
 * calling the SDK through a narrow signature. `.bind(server)` matters —
 * `registerTool` is a class method and reads `this._registeredTools`; called
 * detached it throws on the first tool. Validation is unchanged — the SDK still
 * parses the input with zod at runtime.
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
  const call = server.registerTool.bind(server) as unknown as (
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
      title: "Highlights and notes",
      description:
        "The reader's own highlights and notes. Pass `documentId` for everything " +
        "they marked in one piece; pass `query` to match quote or body; omit both " +
        "for the most recent marks.",
      inputSchema: {
        query: z.string().optional(),
        documentId: z.number().int().optional(),
        limit: z.number().int().min(1).max(100).optional(),
      },
    },
    async (input) => ({ content: text(await searchAnnotations(scope, input)) }),
  );

  register(
    server,
    "list_topics",
    {
      title: "Categories and topics",
      description:
        "The shape of the library: every category and topic with its count. Use it " +
        "to see what the reader reads about, or to browse by subject.",
      inputSchema: {},
    },
    async () => ({ content: text(await listTopics(scope)) }),
  );

  register(
    server,
    "save_document",
    {
      title: "Save a link",
      description:
        "Add a URL to the library and read it: fetch, extract, classify, summarise, " +
        "embed. Use it when the reader asks to save something for later.",
      inputSchema: {
        url: z.string().describe("The page to save"),
        kind: z.enum(KINDS).optional(),
      },
    },
    async ({ url, kind }) => ({ content: text(await addLink(scope.libraryId, url, { kind })) }),
  );

  register(
    server,
    "save_note",
    {
      title: "Save a note",
      description:
        "Save a piece of writing as a note in the library. It becomes a document " +
        "the reader can open, search and cite — for a review, a digest, or a plan.",
      inputSchema: {
        title: z.string().describe("The note's title"),
        markdown: z.string().describe("The note's full text, as markdown"),
      },
    },
    async ({ title, markdown }) => ({
      content: text(await saveNote(scope.libraryId, { title, markdown })),
    }),
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

  register(
    server,
    "set_read_state",
    {
      title: "Set reading state",
      description:
        "Mark a document unread, reading, read, or archived. Use it to apply a " +
        "triage order once the reader agrees.",
      inputSchema: {
        documentId: z.number().int(),
        state: z.enum(["unread", "reading", "read", "archived"]),
      },
    },
    async ({ documentId, state }) => {
      await setReadState(scope, documentId, state);
      return { content: text({ documentId, readState: state }) };
    },
  );

  register(
    server,
    "get_persona",
    {
      title: "The reader's profile",
      description:
        "The reader's profile: a short portrait of their interests, reading " +
        "behaviour and taste. Read it at the start of a personalized skill.",
      inputSchema: {},
    },
    async () => ({ content: text({ profile: await getProfile(scope) }) }),
  );

  register(
    server,
    "save_persona",
    {
      title: "Save the reader's profile",
      description:
        "Write the reader's profile. The full markdown portrait replaces the " +
        "previous one. The build-persona skill writes it here.",
      inputSchema: { content: z.string().describe("The full profile, as markdown") },
    },
    async ({ content }) => ({ content: text(await saveProfile(scope, content)) }),
  );

  // The agent's own instructions, exposed as a resource so a client can align
  // its behaviour with the in-app agent.
  server.registerResource(
    "instructions",
    "curio://instructions",
    { title: "Curio agent instructions", mimeType: "text/plain" },
    async (uri) => ({ contents: [{ uri: uri.href, text: SYSTEM_PROMPT }] }),
  );

  // Each reading skill is an MCP prompt, so a client can offer "Triage" as a
  // command and get the same playbook the in-app agent loads.
  for (const skill of readingSkills()) {
    server.registerPrompt(
      `skill_${skill.name}`,
      { description: skill.description },
      () => ({
        description: skill.description,
        messages: [{ role: "user", content: { type: "text", text: skill.body } }],
      }),
    );
  }

  return server;
}

/** Serve over stdio — the local client path (pi, Claude Code, Cursor). */
export async function serveStdio(scope: Scope): Promise<void> {
  const server = createCurioServer(scope);
  await server.connect(new StdioServerTransport());
}
