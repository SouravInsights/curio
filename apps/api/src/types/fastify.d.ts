import type { FastifyReply, FastifyRequest } from "fastify";
import type { ApiConfig } from "../config/env";
import type { AuthContext } from "../session";
import type { Database } from "@curio/core/db/index";

/**
 * The instance's shape, in one place. Plugins decorate; routes read. TypeScript
 * gets the whole surface from here instead of each plugin augmenting the module
 * on its own.
 */
declare module "fastify" {
  interface FastifyInstance {
    /** The parsed environment. */
    config: ApiConfig;
    /** The shared Drizzle client. */
    db: Database;
    /** preHandler for protected routes. Throws a structured 401 when anonymous. */
    requireAuth(request: FastifyRequest, reply: FastifyReply): Promise<void>;
  }

  interface FastifyRequest {
    /** Resolved once per request by the auth plugin's onRequest hook. */
    auth: AuthContext | null;
  }
}
