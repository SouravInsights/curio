import type { FastifyPluginAsyncTypebox } from "@fastify/type-provider-typebox";

/** Version 1 of the API. */
const v1: FastifyPluginAsyncTypebox = async (fastify) => {
  await fastify.register(import("./me/index"));
  await fastify.register(import("./library/index"));
  await fastify.register(import("./topics/index"));
  await fastify.register(import("./search/index"));
  await fastify.register(import("./documents/index"));
  await fastify.register(import("./annotations/index"));
  await fastify.register(import("./reviews/index"));
  await fastify.register(import("./threads/index"));
  await fastify.register(import("./sync/index"));
  await fastify.register(import("./ask/index"));
};

export default v1;
