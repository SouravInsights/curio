import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { env, required } from "@curio/core/config";
import * as schema from "./schema";

/**
 * One client, one schema.
 *
 * Constructing the client needs `DATABASE_URL`, so importing this module needs
 * it too. A build that has no database (the web's `next build`) supplies a
 * placeholder — see apps/web/Dockerfile — rather than this file growing a lazy
 * wrapper. The pool connects on first query, not here.
 */
let client: ReturnType<typeof postgres> | null = null;

export function sql() {
  if (!client) {
    const url = required("DATABASE_URL");
    client = postgres(url, {
      max: 10,
      onnotice: () => {},
      // A host that suspends — a Sprite — resumes with sockets the network
      // dropped while it was frozen. Recycling connections bounds how long a
      // dead one survives, and a short connect timeout turns a dial that hangs
      // into a failure the caller can retry.
      idle_timeout: 20,
      max_lifetime: 60 * 5,
      connect_timeout: 10,
      // Neon's pooled endpoint is PgBouncer in transaction mode, where named
      // prepared statements collide ("prepared statement \"s0\" already exists").
      // The direct URL keeps them; the pooled one disables them.
      prepare: !url.includes("-pooler"),
    });
  }
  return client;
}

export const db = drizzle(sql(), { schema });

export async function closeDb(): Promise<void> {
  await client?.end({ timeout: 5 });
  client = null;
}

export { schema };
export { env };

/** The Drizzle client type, for decorators and tests. */
export type Database = typeof db;
