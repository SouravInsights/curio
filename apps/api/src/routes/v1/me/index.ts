import type { FastifyPluginAsyncTypebox } from "@fastify/type-provider-typebox";
import { Type } from "@sinclair/typebox";
import { useLogger } from "evlog/fastify";
import { authOf } from "../../../plugins/auth";
import { commonErrors } from "../../../schemas/response";

/** The signed-in user. */
const me: FastifyPluginAsyncTypebox = async (fastify) => {
  fastify.get(
    "/me",
    {
      preHandler: fastify.requireAuth,
      schema: {
        tags: ["account"],
        summary: "The signed-in user",
        security: [{ bearerAuth: [] }],
        response: {
          ...commonErrors,
          200: Type.Object({
            data: Type.Object({
              id: Type.String(),
              email: Type.String(),
              name: Type.String(),
            }),
          }),
        },
      },
    },
    async (request) => {
      const { user } = authOf(request);
      useLogger().set({ user: { id: user.id, hasName: Boolean(user.name) } });
      return { data: { id: user.id, email: user.email, name: user.name } };
    },
  );
};

export default me;
