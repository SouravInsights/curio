import type { FastifyPluginAsyncTypebox } from "@fastify/type-provider-typebox";
import { Type } from "@sinclair/typebox";
import { useLogger } from "evlog/fastify";
import { libraryCounts, listLibrary } from "@curio/core/services/library";
import { authOf } from "../../../plugins/auth";
import { commonErrors } from "../../../schemas/response";

const DocumentSummary = Type.Object({
  id: Type.Number(),
  externalId: Type.String(),
  title: Type.String(),
  url: Type.Union([Type.String(), Type.Null()]),
  site: Type.String(),
  author: Type.String(),
  kind: Type.String(),
  readState: Type.String(),
  favorite: Type.Boolean(),
  summary: Type.Union([Type.String(), Type.Null()]),
  topics: Type.Union([Type.Array(Type.String()), Type.Null()]),
  wordCount: Type.Union([Type.Number(), Type.Null()]),
  addedAt: Type.String(),
});

/** The list pane: newest first, metadata only. */
const library: FastifyPluginAsyncTypebox = async (fastify) => {
  fastify.get(
    "/library",
    {
      preHandler: fastify.requireAuth,
      schema: {
        tags: ["library"],
        summary: "List the reading library",
        security: [{ bearerAuth: [] }],
        querystring: Type.Object({
          kind: Type.Optional(Type.String()),
          state: Type.Optional(
            Type.Union([
              Type.Literal("unread"),
              Type.Literal("reading"),
              Type.Literal("read"),
              Type.Literal("archived"),
            ]),
          ),
          limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 100, default: 50 })),
          sort: Type.Optional(Type.Union([Type.Literal("newest"), Type.Literal("oldest")])),
          topic: Type.Optional(Type.String()),
          favorite: Type.Optional(Type.Boolean()),
        }),
        response: {
          ...commonErrors,
          200: Type.Object({
            data: Type.Array(DocumentSummary),
            // Declared, or Fastify's serializer drops it: the schema is the
            // response shape, not just documentation.
            meta: Type.Object({ counts: Type.Record(Type.String(), Type.Number()) }),
          }),
        },
      },
    },
    async (request) => {
      const { scope } = authOf(request);
      const { kind, state, limit, sort, topic, favorite } = request.query;
      const [rows, counts] = await Promise.all([
        listLibrary(scope, { kind, readState: state, limit, sort, topic, favorite }),
        libraryCounts(scope),
      ]);
      useLogger().set({
        library: { id: scope.libraryId, documents: rows.length, kind: kind ?? null },
      });
      // The schema promises an ISO string, so serialize it here rather than
      // leaning on the serializer to do it implicitly.
      return {
        data: rows.map((row) => ({ ...row, addedAt: row.addedAt.toISOString() })),
        meta: { counts },
      };
    },
  );
};

export default library;
