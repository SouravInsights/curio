import type { FastifyPluginAsyncTypebox } from "@fastify/type-provider-typebox";
import { Type } from "@sinclair/typebox";
import { useLogger } from "evlog/fastify";
import { suggestions } from "@curio/core/services/suggestions";
import { authOf } from "../../../plugins/auth";
import { commonErrors } from "../../../schemas/response";

/** The ways into this reader's library, derived from the library itself. */
const suggestionsRoute: FastifyPluginAsyncTypebox = async (fastify) => {
  fastify.get(
    "/suggestions",
    {
      preHandler: fastify.requireAuth,
      schema: {
        tags: ["agent"],
        summary: "Suggested questions",
        description:
          "Question chips derived from the reader's own categories and topics. " +
          "No model call — cheap and always available.",
        security: [{ bearerAuth: [] }],
        response: { ...commonErrors, 200: Type.Any() },
      },
    },
    async (request) => {
      const { scope } = authOf(request);
      const chips = await suggestions(scope);
      useLogger().set({ suggestions: chips.length });
      return { data: chips };
    },
  );
};

export default suggestionsRoute;
