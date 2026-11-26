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

function num(value: string | undefined, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export const env = {
  DATABASE_URL: process.env.DATABASE_URL ?? "",
  OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY ?? "",
  /** On a Sprite: the OpenRouter connector gateway base. Replaces the key. */
  SPRITES_GATEWAY_URL: process.env.SPRITES_GATEWAY_URL ?? "",
  EMBEDDING_DIM: num(process.env.EMBEDDING_DIM, 1536),
  PORT: num(process.env.PORT, 8787),
  /** better-auth signing secret. `openssl rand -base64 32`. */
  BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET ?? "",
  /** Public base URL of the app; better-auth uses it for callbacks. */
  BETTER_AUTH_URL: process.env.BETTER_AUTH_URL ?? "",
  CHROME_PATH: process.env.CHROME_PATH ?? "",
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
