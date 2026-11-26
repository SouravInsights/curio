import { loadEnvFiles } from "@curio/core/env";

/** Load `.env` before the CLI's own imports read `process.env`. See apps/api/src/bootstrap.ts. */
loadEnvFiles();
