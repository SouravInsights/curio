import fp from "fastify-plugin";
import type { ApiConfig } from "../config/env";

/**
 * Puts the parsed environment on the instance as `fastify.config`, so routes and
 * plugins never reach into `process.env` themselves.
 */
export default fp<{ config: ApiConfig }>(
  async (fastify, options) => {
    fastify.decorate("config", options.config);
  },
  { name: "config" },
);
