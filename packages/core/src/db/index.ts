import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { env, required } from "@curio/core/config";
import * as schema from "./schema";

/**
 * One client, one schema. Lazy on purpose so importing a type never needs a
 * live connection (the CLI helps the build step).
 */
let client: ReturnType<typeof postgres> | null = null;

export function sql() {
  if (!client) {
    const url = required("DATABASE_URL");
    client = postgres(url, {
      max: 10,
      onnotice: () => {},
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
