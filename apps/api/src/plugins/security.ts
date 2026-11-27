import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import fp from "fastify-plugin";
import type { FastifyInstance } from "fastify";

/**
 * Security defaults for a public API: baseline headers, an explicit CORS
 * allow-list, and a coarse global rate limit. Per-route limits are tightened
 * where a route is expensive (the agent) at the route definition.
 */
export default fp(
  async (fastify: FastifyInstance) => {
    const origins = fastify.config.API_CORS_ORIGINS.split(",")
      .map((origin) => origin.trim())
      .filter(Boolean);

    await fastify.register(helmet, {
      global: true,
      // The API returns JSON, not HTML, so a CSP adds nothing here.
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false,
    });

    await fastify.register(cors, {
      // An empty allow-list means any origin, which is the dev convenience.
      // `credentials` is on because the browser sends the session cookie.
      origin: origins.length ? origins : true,
      credentials: true,
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization", "X-Request-Id"],
      maxAge: 86_400,
    });

    await fastify.register(rateLimit, { max: 120, timeWindow: "1 minute" });
  },
  { name: "security", dependencies: ["config"] },
);
