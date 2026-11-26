import { toNextJsHandler } from "better-auth/next-js";
import { auth } from "@curio/core/auth/index";

/**
 * Auth lives in the web app on purpose: these endpoints set the session cookie,
 * so they must answer on the origin the browser talks to. The API validates the
 * cookie (see `apps/api/src/session.ts`) but never issues it. Next route
 * handlers win over the `rewrites` in next.config.mjs, so only `/api/auth/*`
 * stays here and every other `/api/*` path forwards to Fastify.
 */
export const { GET, POST } = toNextJsHandler(auth);
