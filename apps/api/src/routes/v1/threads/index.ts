import type { FastifyPluginAsyncTypebox } from "@fastify/type-provider-typebox";
import { Type } from "@sinclair/typebox";
import { createError } from "evlog";
import { useLogger } from "evlog/fastify";
import {
  clearThread,
  createThread,
  deleteThread,
  listThreads,
  threadById,
  threadFor,
} from "@curio/core/services/threads";
import { authOf } from "../../../plugins/auth";
import { commonErrors } from "../../../schemas/response";

const IdParams = Type.Object({ id: Type.Integer({ minimum: 1 }) });
const DocumentParams = Type.Object({ documentId: Type.Integer({ minimum: 1 }) });

/**
 * Conversations. Library-wide threads for the full-screen Curio page, and the
 * per-document thread for the co-reader beside an article.
 */
const threads: FastifyPluginAsyncTypebox = async (fastify) => {
  fastify.get(
    "/threads",
    {
      preHandler: fastify.requireAuth,
      schema: {
        tags: ["agent"],
        summary: "Your conversations",
        description: "Library-wide Curio conversations, newest activity first.",
        security: [{ bearerAuth: [] }],
        response: { ...commonErrors, 200: Type.Any() },
      },
    },
    async (request) => {
      const { scope } = authOf(request);
      const rows = await listThreads(scope, 30);
      useLogger().set({ threads: rows.length });
      return { data: rows };
    },
  );

  fastify.post(
    "/threads",
    {
      preHandler: fastify.requireAuth,
      schema: {
        tags: ["agent"],
        summary: "Start a conversation",
        security: [{ bearerAuth: [] }],
        response: { ...commonErrors, 201: Type.Any() },
      },
    },
    async (request, reply) => {
      const { scope } = authOf(request);
      const id = await createThread(scope, null);
      useLogger().set({ thread: { id, created: true } });
      reply.code(201);
      return { data: { id } };
    },
  );

  // Before the `:id` route, and named so a document id is never read as a
  // thread id.
  fastify.get(
    "/threads/by-document/:documentId",
    {
      preHandler: fastify.requireAuth,
      schema: {
        tags: ["agent"],
        summary: "A document's conversation",
        security: [{ bearerAuth: [] }],
        params: DocumentParams,
        response: { ...commonErrors, 200: Type.Any() },
      },
    },
    async (request) => {
      const { scope } = authOf(request);
      const data = await threadFor(scope, request.params.documentId);
      return { data };
    },
  );

  fastify.delete(
    "/threads/by-document/:documentId",
    {
      preHandler: fastify.requireAuth,
      schema: {
        tags: ["agent"],
        summary: "Forget a document's conversation",
        security: [{ bearerAuth: [] }],
        params: DocumentParams,
        response: { ...commonErrors, 200: Type.Any() },
      },
    },
    async (request) => {
      const { scope } = authOf(request);
      await clearThread(scope, request.params.documentId);
      return { data: { ok: true } };
    },
  );

  fastify.get(
    "/threads/:id",
    {
      preHandler: fastify.requireAuth,
      schema: {
        tags: ["agent"],
        summary: "One conversation",
        security: [{ bearerAuth: [] }],
        params: IdParams,
        response: { ...commonErrors, 200: Type.Any() },
      },
    },
    async (request) => {
      const { scope } = authOf(request);
      const thread = await threadById(scope, request.params.id);
      if (!thread) {
        throw createError({
          status: 404,
          message: "not found",
          why: "No conversation with that id in this library",
          fix: "List your conversations and use one of their ids.",
        });
      }
      return { data: thread };
    },
  );

  fastify.delete(
    "/threads/:id",
    {
      preHandler: fastify.requireAuth,
      schema: {
        tags: ["agent"],
        summary: "Forget a conversation",
        security: [{ bearerAuth: [] }],
        params: IdParams,
        response: { ...commonErrors, 200: Type.Any() },
      },
    },
    async (request) => {
      const { scope } = authOf(request);
      await deleteThread(scope, request.params.id);
      return { data: { ok: true } };
    },
  );
};

export default threads;
