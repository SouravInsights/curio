import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { config as loadEnv } from "dotenv";

/**
 * Env files live at the repo root, but this package runs from several cwds
 * (apps/api, packages/core, the repo root). Walk up to find them rather than
 * hardcoding a relative path per entry point. `.env` first, then `.env.local`
 * overrides it (Neon writes `.env.local`).
 */
function findUp(name: string, start = process.cwd()): string | null {
  let dir = start;
  for (let i = 0; i < 6; i++) {
    const candidate = join(dir, name);
    if (existsSync(candidate)) return candidate;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

const base = findUp(".env");
const local = findUp(".env.local");
if (base) loadEnv({ path: base });
if (local) loadEnv({ path: local, override: true });

/**
 * The one place environment is read. Everything else imports from here, so a
 * deploy surface names its inputs once and no module reaches into process.env.
 *
 * Nothing throws at import time: a script that never opens the DB should not
 * die because DATABASE_URL is unset. Required values are asserted where used.
 */

/**
 * A value from the environment, without the quotes some writers leave on it.
 * `neon env pull` writes `DATABASE_URL="postgres://…"`; dotenv strips the quotes
 * and `docker --env-file` / Fly do not, so the same file produces a working app
 * locally and `ERR_INVALID_URL` in a container. Strip them here instead.
 */
function str(value: string | undefined): string {
  const trimmed = (value ?? "").trim();
  const quoted =
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"));
  return quoted ? trimmed.slice(1, -1) : trimmed;
}

function num(value: string | undefined, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export const env = {
  DATABASE_URL: str(process.env.DATABASE_URL),
  OPENROUTER_API_KEY: str(process.env.OPENROUTER_API_KEY),
  /** On a Sprite: the OpenRouter connector gateway base. Replaces the key. */
  SPRITES_GATEWAY_URL: str(process.env.SPRITES_GATEWAY_URL),
  EMBEDDING_DIM: num(process.env.EMBEDDING_DIM, 1536),
  PORT: num(process.env.PORT, 8787),
  /** better-auth signing secret. `openssl rand -base64 32`. */
  BETTER_AUTH_SECRET: str(process.env.BETTER_AUTH_SECRET),
  /**
   * Public base URL of the app that serves the auth routes — the web origin,
   * not the API's. better-auth uses it for callbacks and as a trusted origin.
   */
  BETTER_AUTH_URL: str(process.env.BETTER_AUTH_URL),
  /**
   * Extra browser origins allowed to call auth, comma-separated. A browser sends
   * an `Origin` header; a server-to-server call does not, which is why an origin
   * mismatch only shows up in the browser ("Invalid origin").
   */
  BETTER_AUTH_TRUSTED_ORIGINS: str(process.env.BETTER_AUTH_TRUSTED_ORIGINS),
  CHROME_PATH: str(process.env.CHROME_PATH),
  NODE_ENV: process.env.NODE_ENV ?? "development",
} as const;

/** Keys whose value is a string, so `required` never returns a number. */
type StringKey = { [K in keyof typeof env]: (typeof env)[K] extends string ? K : never }[keyof typeof env];

/** Read a required value, naming it in the error so a deploy fails legibly. */
export function required(name: StringKey): string {
  const value = env[name];
  if (!value) throw new Error(`${name} is not set`);
  return value;
}
