import type { FastifyPluginAsyncTypebox } from "@fastify/type-provider-typebox";

/**
 * The route tree.
 *
 * Probes live at the root for load balancers; everything else is versioned under
 * `/api/v1` so a client — the web app, a native app, an MCP user — can pin to a
 * contract. Adding a resource is one file and one line.
 */
const routes: FastifyPluginAsyncTypebox = async (fastify) => {
  await fastify.register(import("./health/index"));
  await fastify.register(import("./mcp/index"));
  await fastify.register(import("./v1/index"), { prefix: "/api/v1" });
};

export default routes;
