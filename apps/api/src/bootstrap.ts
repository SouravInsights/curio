import { loadEnvFiles } from "@curio/core/env";

/**
 * Load `.env` / `.env.local` before anything reads `process.env`.
 *
 * This is a module rather than a call in `server.ts` for an ordering reason:
 * ESM evaluates every import before the importing module's own body, so a
 * `loadEnvFiles()` sitting under the imports runs *after* `@curio/core/config`
 * has already read the environment. Importing this first makes the order right.
 */
loadEnvFiles();
