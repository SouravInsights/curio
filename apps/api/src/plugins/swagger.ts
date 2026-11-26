import scalarApiReference from "@scalar/fastify-api-reference";
import swagger from "@fastify/swagger";
import fp from "fastify-plugin";
import type { FastifyInstance } from "fastify";

/**
 * The API reference, from the route schemas.
 *
 * `@fastify/swagger` builds one OpenAPI document from the same TypeBox schemas
 * that validate and serialize requests, so the reference cannot drift from the
 * API. Scalar renders it at `/docs`; the raw document is served at
 * `/documentation/json` for other consumers (a generated client, a registry).
 *
 * One surface, on purpose: two renderers of the same document is a second thing
 * to keep working for no extra information.
 */
export default fp(
  async (fastify: FastifyInstance) => {
    // These plugins are typed for Fastify's default provider; this instance
    // carries TypeBox. The cast is the documented workaround and changes
    // nothing at runtime.
    await fastify.register(swagger as never, {
      openapi: {
        openapi: "3.1.0",
        info: {
          title: "Curio API",
          description:
            "The HTTP API behind Curio: a personal reading library, its retrieval, " +
            "and the agent that answers from it. The same tools are exposed over MCP.",
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

    await fastify.register(scalarApiReference as never, {
      routePrefix: "/docs",
      configuration: {
        title: "Curio API reference",
        // Scalar's defaults are good; these are the deliberate deviations.
        layout: "modern",
        theme: "default",
        darkMode: true,
        // Try it from the page: a session cookie is sent, so the app's own
        // session works without pasting a token.
        persistAuth: true,
        defaultHttpClient: { targetKey: "js", clientKey: "fetch" },
        // Request bodies are the interesting half here; keep the schemas visible.
        hideModels: false,
        hideDownloadButton: false,
      },
    });
  },
  { name: "openapi", dependencies: ["config"] },
);
