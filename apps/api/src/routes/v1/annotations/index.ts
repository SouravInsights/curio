import type { FastifyPluginAsyncTypebox } from "@fastify/type-provider-typebox";
import { Type } from "@sinclair/typebox";
import { useLogger } from "evlog/fastify";
import { searchAnnotations } from "@curio/core/agent/actions";
import { authOf } from "../../../plugins/auth";
import { commonErrors } from "../../../schemas/response";

/** The reader's marks across the library. */
const annotations: FastifyPluginAsyncTypebox = async (fastify) => {
  fastify.get(
    "/annotations",
    {
      preHandler: fastify.requireAuth,
      schema: {
        tags: ["annotations"],
        summary: "Search your highlights and notes",
        security: [{ bearerAuth: [] }],
        querystring: Type.Object({ q: Type.Optional(Type.String()) }),
        response: { ...commonErrors, 200: Type.Any() },
      },
    },
    async (request) => {
      const { scope } = authOf(request);
      const { q } = request.query;
      const rows = await searchAnnotations(scope, q ?? "", 50);
      useLogger().set({ library: { id: scope.libraryId, annotations: rows.length } });
      return { data: rows };
    },
  );
};

export default annotations;
