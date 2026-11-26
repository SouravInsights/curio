import scalarApiReference from "@scalar/fastify-api-reference";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import fp from "fastify-plugin";
import type { FastifyInstance } from "fastify";

/**
 * OpenAPI, and two renderers of it.
 *
 * `@fastify/swagger` builds the document from the routes' schemas — the same
 * schemas that validate and serialize requests, so the docs cannot drift from
 * the API. Two front ends read the one document:
 *   - **Scalar** at `/docs`        (the modern reference)
 *   - **Swagger UI** at `/swagger` (the familiar one)
 * The raw JSON is at `/docs/openapi.json`.
 */
export default fp(
  async (fastify: FastifyInstance) => {
    await fastify.register(swagger, {
      openapi: {
        openapi: "3.1.0",
        info: {
          title: "Curio API",
          description:
            "The HTTP API behind Curio: a personal reading library, its retrieval, and the agent that answers from it. The same tools are exposed over MCP.",
          version: fastify.config.APP_VERSION,
        },
        servers: [{ url: fastify.config.API_PUBLIC_URL }],
        tags: [
          { name: "library", description: "The reading list: documents and their metadata." },
          { name: "search", description: "Hybrid retrieval over everything you have read." },
          { name: "documents", description: "One document, its stored text, and its marks." },
          { name: "annotations", description: "Highlights and notes across the library." },
          { name: "agent", description: "Ask the library; answers stream and cite line spans." },
          { name: "account", description: "The signed-in user." },
          { name: "system", description: "Health and probes." },
        ],
        components: {
          securitySchemes: {
            bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "session-token" },
          },
        },
      },
    });

    await fastify.register(scalarApiReference, {
      routePrefix: "/docs",
      configuration: {
        title: "Curio API reference",
        layout: "modern",
        spec: { url: "/docs/openapi.json" },
      },
    });

    await fastify.register(swaggerUi, {
      routePrefix: "/swagger",
      uiConfig: { docExpansion: "list", deepLinking: true },
    });
  },
  { name: "openapi", dependencies: ["config"] },
);
