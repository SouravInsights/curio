import { loadEnvFiles } from "./src/env";
import { defineConfig } from "drizzle-kit";

// drizzle-kit runs from a bare shell, so the config loads `.env` / `.env.local`
// itself. `loadEnvFiles` walks up to the repo root from wherever it is invoked.
loadEnvFiles();

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
