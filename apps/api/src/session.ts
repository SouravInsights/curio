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

export async function resolveAuth(request: FastifyRequest): Promise<AuthContext | null> {
  const session = await auth.api.getSession({ headers: fromNodeHeaders(request.headers) });
  if (!session) return null;

  const existing = await libraryForUser(session.user.id);
  if (existing) return { user: session.user, scope: { libraryId: existing } };

  const [row] = await db
    .insert(libraries)
    .values({ userId: session.user.id, name: "My library" })
    .returning({ id: libraries.id });
  return { user: session.user, scope: { libraryId: row!.id } };
}
