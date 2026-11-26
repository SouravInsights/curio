import type { FastifyPluginAsyncTypebox } from "@fastify/type-provider-typebox";
import { Type } from "@sinclair/typebox";
import { useLogger } from "evlog/fastify";
import { runAgent } from "@curio/core/agent/agent";
import type { UIMessage } from "@curio/core/observability";
import { authOf } from "../../../plugins/auth";
import { commonErrors } from "../../../schemas/response";

/** The question text of a UIMessage, for the wide event. */
function questionOf(message: UIMessage | undefined): string | null {
  if (!message) return null;
  const parts = (message as { parts?: { type?: string; text?: string }[] }).parts ?? [];
  return parts.find((part) => part.type === "text")?.text?.slice(0, 500) ?? null;
}

/**
 * The agent. One wide event per question; the model's stream passes straight
 * through to the client untouched. Rate-limited tighter than the rest — it is
 * the only route that spends money per call.
 */
const ask: FastifyPluginAsyncTypebox = async (fastify) => {
  fastify.post(
    "/ask",
    {
      preHandler: fastify.requireAuth,
      config: { rateLimit: { max: 10, timeWindow: "1 minute" } },
      schema: {
        tags: ["agent"],
        summary: "Ask the library",
        description:
          "Streams a UIMessage response. The agent may only cite spans a tool returned, " +
          "so an answer never invents a document or a line.",
        security: [{ bearerAuth: [] }],
        body: Type.Object({
          messages: Type.Array(Type.Object({}, { additionalProperties: true }), { minItems: 1 }),
        }),
        response: commonErrors,
      },
    },
    async (request, reply) => {
      const { scope, user } = authOf(request);
      const { messages } = request.body as { messages: UIMessage[] };
      useLogger().set({
        user: { id: user.id },
        library: { id: scope.libraryId },
        agent: { messages: messages.length, question: questionOf(messages[messages.length - 1]) },
      });

      const result = await runAgent(messages, scope);
      const response = result.toUIMessageStreamResponse();

      reply.hijack();
      reply.raw.writeHead(200, Object.fromEntries(response.headers.entries()));
      if (response.body) {
        const reader = response.body.getReader();
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          reply.raw.write(value);
        }
      }
      reply.raw.end();
    },
  );
};

export default ask;
