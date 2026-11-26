import { fromNodeHeaders } from "better-auth/node";
import type { FastifyRequest } from "fastify";
import { auth } from "@curio/core/auth/index";
import { db } from "@curio/core/db/index";
import { libraries } from "@curio/core/db/schema";
import { libraryForUser } from "@curio/core/harness/scope";
import type { Scope } from "@curio/core/agent/actions";

/**
 * Request → library. The session is read from the cookie (or a bearer token for
 * MCP clients); the user resolves to their library, created on first use. No
 * route trusts a client-sent id — this is the only place identity becomes a
 * scope, and the auth plugin runs it once per request.
 */
export interface AuthContext {
  user: { id: string; email: string; name: string };
  scope: Scope;
}

/**
 * A user's library id does not change, so it is cached for a minute. This
 * removes the second of the two per-request queries; the cookie cache above
 * removes the first.
 */
const libraryCache = new Map<string, { id: number; at: number }>();
const LIBRARY_TTL_MS = 60_000;

export async function resolveAuth(request: FastifyRequest): Promise<AuthContext | null> {
  const session = await auth.api.getSession({ headers: fromNodeHeaders(request.headers) });
  if (!session) return null;

  const cached = libraryCache.get(session.user.id);
  if (cached && Date.now() - cached.at < LIBRARY_TTL_MS) {
    return { user: session.user, scope: { libraryId: cached.id } };
  }

  const existing = await libraryForUser(session.user.id);
  if (existing) {
    libraryCache.set(session.user.id, { id: existing, at: Date.now() });
    return { user: session.user, scope: { libraryId: existing } };
  }

  const [row] = await db
    .insert(libraries)
    .values({ userId: session.user.id, name: "My library" })
    .returning({ id: libraries.id });
  libraryCache.set(session.user.id, { id: row!.id, at: Date.now() });
  return { user: session.user, scope: { libraryId: row!.id } };
}
