import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { config as loadEnv } from "dotenv";

/**
 * Load `.env` and `.env.local` for the Node entry points — the API server and
 * the CLI.
 *
 * They live at the repo root, but those entry points run from several cwds
 * (`apps/api`, `packages/core`, the root), so this walks up to find them.
 *
 * The web does not call this: `fs` in its module graph makes Turbopack trace the
 * whole project into the server bundle. Next loads the web's own `.env*` files.
 */
export function loadEnvFiles(start = process.cwd()): void {
  const base = findUp(".env", start);
  const local = findUp(".env.local", start);
  if (base) loadEnv({ path: base });
  if (local) loadEnv({ path: local, override: true });
}

function findUp(name: string, start: string): string | null {
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
