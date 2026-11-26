import fp from "fastify-plugin";
import type { FastifyRequest } from "fastify";
import { createError } from "evlog";
import { useLogger } from "evlog/fastify";
import { resolveAuth, type AuthContext } from "../session";

/**
 * Auth, as a shared plugin: `onRequest` resolves the session into `request.auth`,
 * and `requireAuth` is the preHandler a protected route opts into. Encapsulation
 * would hide both from sibling route plugins, which is why this one breaks out
 * with `fastify-plugin` — routes still only add what is theirs to add.
 */
export default fp(
  async (fastify) => {
    fastify.decorateRequest("auth", null);

    fastify.addHook("onRequest", async (request) => {
      // Only the API and MCP need a session. Resolving it for `/docs`,
      // `/health` or a static asset would spend two database round-trips on
      // nothing.
      if (!request.url.startsWith("/api") && !request.url.startsWith("/mcp")) return;
      request.auth = await resolveAuth(request);
    });

    fastify.decorate("requireAuth", async (request: FastifyRequest) => {
      if (!request.auth) {
        useLogger().set({ auth: { authenticated: false } });
        throw createError({
          status: 401,
          message: "unauthorized",
          why: "No valid session cookie or bearer token",
          fix: "Sign in, then retry with the session cookie or a bearer token.",
        });
      }
      useLogger().set({
        user: { id: request.auth.user.id },
        library: { id: request.auth.scope.libraryId },
      });
    });
  },
  { name: "auth" },
);

/** Narrow `request.auth` after `requireAuth` has run. */
export function authOf(request: FastifyRequest): AuthContext {
  if (!request.auth) {
    throw createError({
      status: 401,
      message: "unauthorized",
      why: "Handler reached without requireAuth",
      fix: "Add { preHandler: fastify.requireAuth } to the route.",
    });
  }
  return request.auth;
}
