import type { FastifyPluginAsyncTypebox } from "@fastify/type-provider-typebox";
import { Type } from "@sinclair/typebox";
import { useLogger } from "evlog/fastify";
import { listTopics } from "@curio/core/services/library";
import { authOf } from "../../../plugins/auth";
import { commonErrors } from "../../../schemas/response";

/**
 * The browse index: the subjects the library is made of, with counts, so the
 * page can say how much is behind a door before you open it.
 */
const topics: FastifyPluginAsyncTypebox = async (fastify) => {
  fastify.get(
    "/topics",
    {
      preHandler: fastify.requireAuth,
      schema: {
        tags: ["library"],
        summary: "Browse the library by topic",
        security: [{ bearerAuth: [] }],
        response: {
          ...commonErrors,
          200: Type.Object({
            data: Type.Array(Type.Object({ name: Type.String(), count: Type.Number() })),
          }),
        },
      },
    },
    async (request) => {
      const { scope } = authOf(request);
      const data = await listTopics(scope);
      useLogger().set({ library: { id: scope.libraryId, topics: data.length } });
      return { data };
    },
  );
};

export default topics;
