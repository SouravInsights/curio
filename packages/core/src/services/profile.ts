import { eq } from "drizzle-orm";
import { db } from "@curio/core/db/index";
import { libraries } from "@curio/core/db/schema";
import type { Scope } from "./scope";

/**
 * The reader's profile.
 *
 * A short markdown portrait — interests, reading behaviour, taste, anti-interests,
 * pitching guidance — written by the `build-persona` skill and read by the agent.
 * It is a synthesis, not a fact: the value is produced by a model reading the
 * library, and stored here so personalization costs one lookup, not a re-scan.
 *
 * One profile per library, so it lives on `libraries` rather than in a table of
 * its own. Regenerating replaces it.
 */

export async function getProfile(scope: Scope): Promise<string | null> {
  const [row] = await db
    .select({ profile: libraries.profile })
    .from(libraries)
    .where(eq(libraries.id, scope.libraryId))
    .limit(1);
  return row?.profile ?? null;
}

export async function saveProfile(
  scope: Scope,
  content: string,
): Promise<{ updatedAt: Date }> {
  const updatedAt = new Date();
  await db
    .update(libraries)
    .set({ profile: content, profileUpdatedAt: updatedAt })
    .where(eq(libraries.id, scope.libraryId));
  return { updatedAt };
}
