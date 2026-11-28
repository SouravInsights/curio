import type { FastifyPluginAsyncTypebox } from "@fastify/type-provider-typebox";
import { Type } from "@sinclair/typebox";
import { createError } from "evlog";
import { useLogger } from "evlog/fastify";
import { runAgent } from "@curio/core/agent/agent";
import type { UIMessage } from "@curio/core/observability";
import { getDocument } from "@curio/core/services/library";
import {
  appendMessage,
  createThread,
  getOrCreateThread,
  threadById,
  titleThread,
} from "@curio/core/services/threads";
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
          message: Type.Object({}, { additionalProperties: true }),
          /** A conversation to continue. Omitted, a library thread is created. */
          threadId: Type.Optional(Type.Integer({ minimum: 1 })),
          /** The co-reader beside an article: its thread, created if missing. */
          documentId: Type.Optional(Type.Integer({ minimum: 1 })),
        }),
        response: commonErrors,
      },
    },
    async (request, reply) => {
      const { scope, user } = authOf(request);
      const { message, threadId: requested, documentId } = request.body as {
        message: UIMessage;
        threadId?: number;
        documentId?: number;
      };

      // One of three doors onto a thread: an existing conversation, the
      // co-reader for a document, or a fresh library conversation.
      let threadId: number;
      if (requested) {
        const thread = await threadById(scope, requested);
        if (!thread) {
          throw createError({
            status: 404,
            message: "not found",
            why: "No conversation with that id in this library",
            fix: "Start a new conversation.",
          });
        }
        threadId = thread.id;
      } else if (documentId) {
        const document = await getDocument(scope, documentId);
        if (!document) {
          throw createError({
            status: 404,
            message: "not found",
            why: "No document with that id in this library",
            fix: "Open a document from the library, then ask.",
          });
        }
        threadId = await getOrCreateThread(scope, documentId);
      } else {
        threadId = await createThread(scope, null);
      }

      const question = questionOf(message);
      useLogger().set({
        user: { id: user.id },
        library: { id: scope.libraryId },
        agent: { threadId, documentId: documentId ?? null, question },
      });

      await appendMessage(scope, threadId, "user", message.parts ?? []);
      if (question) await titleThread(scope, threadId, question);
      const thread = await threadById(scope, threadId);

      const result = await runAgent((thread?.messages ?? []) as UIMessage[], scope, {
        onFinish: async (text) => {
          if (text.trim()) {
            await appendMessage(scope, threadId, "assistant", [{ type: "text", text }]);
          }
        },
      });
      const response = result.toUIMessageStreamResponse();

      reply.hijack();
      // The thread id rides back on a header, so a brand-new conversation can
      // be continued without a second round trip before the first answer.
      reply.raw.writeHead(200, {
        ...Object.fromEntries(response.headers.entries()),
        "x-curio-thread": String(threadId),
      });
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
