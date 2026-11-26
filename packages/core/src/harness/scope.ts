import { eq } from "drizzle-orm";
import { db } from "@curio/core/db/index";
import { libraries } from "@curio/core/db/schema";
import type { Scope } from "@curio/core/agent/actions";

/**
 * Which library a non-HTTP caller is acting on.
 *
 * The app always knows (it has a session). The CLI and a stdio MCP client do
 * not, so they read `CURIO_LIBRARY_ID`, or fall back to the first library. The
 * HTTP MCP endpoint does it properly: the bearer token resolves to a user, and
 * the user resolves to their library.
 */
export async function resolveScope(explicitId?: number): Promise<Scope> {
  if (explicitId && Number.isInteger(explicitId)) return { libraryId: explicitId };
  const fromEnv = Number(process.env.CURIO_LIBRARY_ID);
  if (Number.isInteger(fromEnv) && fromEnv > 0) return { libraryId: fromEnv };

  const [first] = await db.select({ id: libraries.id }).from(libraries).limit(1);
  if (!first) {
    throw new Error("No library yet. Create a user + library, or set CURIO_LIBRARY_ID.");
  }
  return { libraryId: first.id };
}

/** The library a better-auth user owns. */
export async function libraryForUser(userId: string): Promise<number | null> {
  const [row] = await db
    .select({ id: libraries.id })
    .from(libraries)
    .where(eq(libraries.userId, userId))
    .limit(1);
  return row?.id ?? null;
}
