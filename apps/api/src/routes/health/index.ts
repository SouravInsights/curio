import type { FastifyPluginAsyncTypebox } from "@fastify/type-provider-typebox";
import { Type } from "@sinclair/typebox";
import { useLogger } from "evlog/fastify";

/** Liveness. Public, and the only route that does no work. */
const health: FastifyPluginAsyncTypebox = async (fastify) => {
  fastify.get(
    "/health",
    {
      schema: {
        tags: ["system"],
        summary: "Liveness probe",
        response: { 200: Type.Object({ ok: Type.Boolean() }) },
      },
    },
    async () => {
      useLogger().set({ probe: "liveness" });
      return { ok: true };
    },
  );
};

export default health;
