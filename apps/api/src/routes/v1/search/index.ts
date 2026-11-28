import type { FastifyPluginAsyncTypebox } from "@fastify/type-provider-typebox";
import { Type } from "@sinclair/typebox";
import { useLogger } from "evlog/fastify";
import { searchLibrary } from "@curio/core/services/search";
import { authOf } from "../../../plugins/auth";
import { commonErrors } from "../../../schemas/response";

/** Hybrid retrieval. `mode=exact` skips the embedding model, so it works without a key. */
const search: FastifyPluginAsyncTypebox = async (fastify) => {
  fastify.get(
    "/search",
    {
      preHandler: fastify.requireAuth,
      schema: {
        tags: ["search"],
        summary: "Search everything you have read",
        description:
          "Hybrid by default: vector similarity fused with Postgres full-text via RRF. " +
          "Use `exact` for a literal phrase or a rare proper noun, `semantic` for meaning.",
        security: [{ bearerAuth: [] }],
        querystring: Type.Object({
          q: Type.String({ minLength: 1 }),
          mode: Type.Optional(
            Type.Union([Type.Literal("hybrid"), Type.Literal("semantic"), Type.Literal("exact")], {
              default: "hybrid",
            }),
          ),
          kind: Type.Optional(Type.String()),
          limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 50, default: 8 })),
        }),
        response: {
          ...commonErrors,
          200: Type.Object({
            data: Type.Array(
              Type.Object({
                documentId: Type.Number(),
                externalId: Type.String(),
                url: Type.Union([Type.String(), Type.Null()]),
                title: Type.String(),
                kind: Type.String(),
                score: Type.Number(),
                passages: Type.Array(
                  Type.Object({
                    content: Type.String(),
                    startLine: Type.Number(),
                    endLine: Type.Number(),
                    unitType: Type.String(),
                    heading: Type.Union([Type.String(), Type.Null()]),
                  }),
                ),
              }),
            ),
          }),
        },
      },
    },
    async (request) => {
      const { scope } = authOf(request);
      const { q, mode, kind, limit } = request.query;
      const hits = await searchLibrary(scope, q, { mode, kind, limit });
      useLogger().set({ search: { query: q, mode, kind: kind ?? null, hits: hits.length } });
      return { data: hits };
    },
  );
};

export default search;
