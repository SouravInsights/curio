import { fromNodeHeaders } from "better-auth/node";
import type { FastifyRequest } from "fastify";
import { auth } from "@curio/core/auth/index";
import { ensureLibraryForUser } from "@curio/core/harness/scope";
import type { Scope } from "@curio/core/services/scope";

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
 * A user's library id never changes, so the first lookup is kept for the life
 * of the process. The session itself already travels in a signed cookie, which
 * makes this the only query a request costs.
 */
const libraryIds = new Map<string, number>();

export async function resolveAuth(request: FastifyRequest): Promise<AuthContext | null> {
  const session = await auth.api.getSession({ headers: fromNodeHeaders(request.headers) });
  if (!session) return null;

  let libraryId = libraryIds.get(session.user.id);
  if (libraryId === undefined) {
    libraryId = await ensureLibraryForUser(session.user.id);
    libraryIds.set(session.user.id, libraryId);
  }

  return { user: session.user, scope: { libraryId } };
}
