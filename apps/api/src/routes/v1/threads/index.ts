import type { FastifyPluginAsyncTypebox } from "@fastify/type-provider-typebox";
import { Type } from "@sinclair/typebox";
import { useLogger } from "evlog/fastify";
import { clearThread, threadFor } from "@curio/core/services/threads";
import { authOf } from "../../../plugins/auth";
import { commonErrors } from "../../../schemas/response";

/** A document's conversation: read it back, or forget it. */
const threads: FastifyPluginAsyncTypebox = async (fastify) => {
  fastify.get(
    "/threads/:documentId",
    {
      preHandler: fastify.requireAuth,
      schema: {
        tags: ["agent"],
        summary: "A document's conversation",
        description: "The co-reader turns so far, oldest first. Empty when none.",
        security: [{ bearerAuth: [] }],
        params: Type.Object({ documentId: Type.Integer({ minimum: 1 }) }),
        response: { ...commonErrors, 200: Type.Any() },
      },
    },
    async (request) => {
      const { scope } = authOf(request);
      const { documentId } = request.params;
      const data = await threadFor(scope, documentId);
      useLogger().set({ thread: { documentId, messages: data.messages.length } });
      return { data };
    },
  );

  fastify.delete(
    "/threads/:documentId",
    {
      preHandler: fastify.requireAuth,
      schema: {
        tags: ["agent"],
        summary: "Forget a document's conversation",
        security: [{ bearerAuth: [] }],
        params: Type.Object({ documentId: Type.Integer({ minimum: 1 }) }),
        response: { ...commonErrors, 200: Type.Any() },
      },
    },
    async (request) => {
      const { scope } = authOf(request);
      const { documentId } = request.params;
      await clearThread(scope, documentId);
      useLogger().set({ thread: { documentId, cleared: true } });
      return { data: { ok: true } };
    },
  );
};

export default threads;
