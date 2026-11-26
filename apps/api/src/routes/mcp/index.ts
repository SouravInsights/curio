import type { FastifyPluginAsyncTypebox } from "@fastify/type-provider-typebox";
import { useLogger } from "evlog/fastify";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createCurioServer } from "@curio/core/harness/mcp";
import { authOf } from "../../plugins/auth";

/**
 * MCP over HTTP — the same tools the stdio server exposes, so a remote client
 * (pi, Codex, Claude, Cursor) can read and write this library. Stateless: a
 * fresh server and transport per call, no session to keep.
 */
const mcp: FastifyPluginAsyncTypebox = async (fastify) => {
  fastify.post(
    "/mcp",
    {
      preHandler: fastify.requireAuth,
      schema: { hide: true },
    },
    async (request, reply) => {
      const { scope } = authOf(request);
      useLogger().set({ mcp: { client: request.headers["user-agent"] ?? null } });

      const server = createCurioServer(scope);
      const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
      reply.hijack();
      await server.connect(transport);
      await transport.handleRequest(request.raw, reply.raw, request.body);
    },
  );
};

export default mcp;
