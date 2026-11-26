import { Hono } from "hono";
import { cors } from "hono/cors";
import { serve } from "@hono/node-server";
import { desc, eq } from "drizzle-orm";
import { auth } from "@/auth/index.ts";
import { env } from "@/config.ts";
import { db, closeDb } from "@/db/index.ts";
import { documents, libraries } from "@/db/schema.ts";
import { runAgent } from "@/agent/agent.ts";
import { listLibrary, searchLibrary } from "@/agent/actions.ts";
import { libraryForUser } from "@/harness/scope.ts";
import type { Scope } from "@/agent/actions.ts";

/**
 * The app's HTTP surface.
 *
 * Auth is better-auth's, mounted whole at `/api/auth/*` — sign-up, sign-in,
 * sessions, sign-out and the bearer-token flow all come from the library, not
 * from code here. Every app route resolves the session to a user, then the user
 * to a library, so no route handles an id from the client.
 */

const app = new Hono();

app.use("*", cors({ origin: (origin) => origin, credentials: true }));

// better-auth owns this prefix.
app.on(["POST", "GET"], "/api/auth/*", (c) => auth.handler(c.req.raw));

app.get("/health", (c) => c.json({ ok: true }));

/** Resolve the caller to a library, creating the user's first one on demand. */
async function resolve(c: {
  req: { raw: Request };
  json: (body: unknown, status?: 401 | 403 | 500) => Response;
}): Promise<{ scope: Scope; userId: string } | Response> {
  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  if (!session) return c.json({ error: "unauthorized" }, 401);

  const existing = await libraryForUser(session.user.id);
  if (existing) return { scope: { libraryId: existing }, userId: session.user.id };

  const [row] = await db
    .insert(libraries)
    .values({ userId: session.user.id, name: "My library" })
    .returning({ id: libraries.id });
  return { scope: { libraryId: row!.id }, userId: session.user.id };
}

app.get("/api/me", async (c) => {
  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  if (!session) return c.json({ error: "unauthorized" }, 401);
  return c.json({ data: { id: session.user.id, email: session.user.email, name: session.user.name } });
});

app.get("/api/search", async (c) => {
  const resolved = await resolve(c);
  if (resolved instanceof Response) return resolved;

  const query = c.req.query("q") ?? "";
  if (!query) return c.json({ error: "q is required" }, 400);
  const mode = (c.req.query("mode") as "hybrid" | "semantic" | "exact" | undefined) ?? "hybrid";
  const hits = await searchLibrary(resolved.scope, query, {
    mode,
    kind: c.req.query("kind") ?? undefined,
    limit: Number(c.req.query("limit") ?? 8),
  });
  return c.json({ data: hits });
});

app.get("/api/documents", async (c) => {
  const resolved = await resolve(c);
  if (resolved instanceof Response) return resolved;
  const rows = await listLibrary(resolved.scope, {
    kind: c.req.query("kind") ?? undefined,
    readState: c.req.query("state") ?? undefined,
    limit: Number(c.req.query("limit") ?? 30),
  });
  return c.json({ data: rows });
});

/** One document's stored markdown + annotations — what the reader renders. */
app.get("/api/documents/:id", async (c) => {
  const resolved = await resolve(c);
  if (resolved instanceof Response) return resolved;
  const id = Number(c.req.param("id"));
  const [row] = await db.select().from(documents).where(eq(documents.id, id)).limit(1);
  if (!row || row.libraryId !== resolved.scope.libraryId) {
    return c.json({ error: "not found" }, 404);
  }
  return c.json({ data: row });
});

/** The agent. Streams a UIMessage response, exactly like the app expects. */
app.post("/api/ask", async (c) => {
  const resolved = await resolve(c);
  if (resolved instanceof Response) return resolved;

  const body = (await c.req.json().catch(() => null)) as { messages?: unknown[] } | null;
  if (!body?.messages?.length) return c.json({ error: "messages is required" }, 400);

  const result = await runAgent(body.messages as Parameters<typeof runAgent>[0], resolved.scope);
  return result.toUIMessageStreamResponse();
});

/** The reading list, newest first — a plain JSON view for the app shell. */
app.get("/api/library", async (c) => {
  const resolved = await resolve(c);
  if (resolved instanceof Response) return resolved;
  const rows = await db
    .select({
      id: documents.id,
      title: documents.title,
      kind: documents.kind,
      readState: documents.readState,
      addedAt: documents.addedAt,
    })
    .from(documents)
    .where(eq(documents.libraryId, resolved.scope.libraryId))
    .orderBy(desc(documents.addedAt))
    .limit(50);
  return c.json({ data: rows });
});

const port = env.PORT;
const server = serve({ fetch: app.fetch, port }, () => {
  console.log(`curio listening on http://localhost:${port}`);
});

async function shutdown(): Promise<void> {
  server.close();
  await closeDb();
  process.exit(0);
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

export { app };
