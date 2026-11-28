import type { FastifyPluginAsyncTypebox } from "@fastify/type-provider-typebox";
import { Type } from "@sinclair/typebox";
import { createError } from "evlog";
import { useLogger } from "evlog/fastify";
import { runAgent } from "@curio/core/agent/agent";
import type { UIMessage } from "@curio/core/observability";
import { getDocument } from "@curio/core/services/library";
import { appendMessage, getOrCreateThread, threadFor } from "@curio/core/services/threads";
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
 *
 * The turn is persisted: the question before the model runs, the answer when it
 * finishes, so the next question in the thread carries the whole conversation.
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
          "Streams a UIMessage response and records the turn in the document's thread. " +
          "The agent may only cite spans a tool returned, so an answer never invents a " +
          "document or a line.",
        security: [{ bearerAuth: [] }],
        body: Type.Object({
          documentId: Type.Integer({ minimum: 1 }),
          message: Type.Object({}, { additionalProperties: true }),
        }),
        response: commonErrors,
      },
    },
    async (request, reply) => {
      const { scope, user } = authOf(request);
      const { documentId, message } = request.body as { documentId: number; message: UIMessage };

      const document = await getDocument(scope, documentId);
      if (!document) {
        throw createError({
          status: 404,
          message: "not found",
          why: "No document with that id in this library",
          fix: "Open a document from the library, then ask.",
        });
      }

      useLogger().set({
        user: { id: user.id },
        library: { id: scope.libraryId },
        agent: { documentId, question: questionOf(message) },
      });

      const threadId = await getOrCreateThread(scope, documentId);
      await appendMessage(scope, threadId, "user", message.parts ?? []);
      const { messages: history } = await threadFor(scope, documentId);

      const result = await runAgent(history as UIMessage[], scope, {
        onFinish: async (text) => {
          if (text.trim()) {
            await appendMessage(scope, threadId, "assistant", [{ type: "text", text }]);
          }
        },
      });
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
