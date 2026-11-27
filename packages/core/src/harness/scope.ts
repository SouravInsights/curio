import { db } from "@curio/core/db/index";
import { libraries } from "@curio/core/db/schema";
import { env } from "@curio/core/config";
import type { Scope } from "@curio/core/services/scope";

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
  const fromEnv = Number(env.CURIO_LIBRARY_ID);
  if (Number.isInteger(fromEnv) && fromEnv > 0) return { libraryId: fromEnv };

  const [first] = await db.select({ id: libraries.id }).from(libraries).limit(1);
  if (!first) {
    throw new Error("No library yet. Create a user + library, or set CURIO_LIBRARY_ID.");
  }
  return { libraryId: first.id };
}

/**
 * The library a better-auth user owns, created on first use.
 *
 * The insert is also the lookup: the schema allows one library per user, so the
 * conflict returns the row already there. `set` repeats the conflict column
 * because a no-op update is what makes `returning` yield the existing row.
 */
export async function ensureLibraryForUser(userId: string): Promise<number> {
  const [row] = await db
    .insert(libraries)
    .values({ userId })
    .onConflictDoUpdate({ target: libraries.userId, set: { userId } })
    .returning({ id: libraries.id });
  return row!.id;
}
