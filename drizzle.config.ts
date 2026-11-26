import { config as loadEnv } from "dotenv";
import { defineConfig } from "drizzle-kit";

// Neon writes `.env.local`; read both, local wins.
loadEnv({ path: ".env" });
loadEnv({ path: ".env.local", override: true });

/**
 * Migrations run over the **direct** connection. Neon's pooled endpoint is
 * PgBouncer in transaction mode, which does not persist session state and
 * breaks DDL setups — pooled migration failures never name pooling in their
 * error. `DATABASE_URL_UNPOOLED` is the direct string; fall back to the pooled
 * one for a plain Postgres that has only `DATABASE_URL`.
 */
const url = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL_UNPOOLED (or DATABASE_URL) is not set");

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: { url },
});
