import Fastify, { LogController } from "fastify";
import sensible from "@fastify/sensible";
import { TypeBoxTypeProvider } from "@fastify/type-provider-typebox";
import { evlog, evlogOptions } from "./evlog";
import { loadConfig, type ApiConfig } from "./config/env";
import configPlugin from "./plugins/config";
import dbPlugin from "./plugins/db";
import authPlugin from "./plugins/auth";
import errorHandler from "./plugins/error-handler";
import security from "./plugins/security";
import openapi from "./plugins/swagger";
import routes from "./routes/index";

export interface BuildAppOptions {
  /** Injected in tests; otherwise read from the environment. */
  config?: ApiConfig;
  /** `false` silences logs (tests). */
  logger?: boolean;
}

/**
 * Builds the Fastify instance without listening, so tests drive it with
 * `inject()` and the server entry owns the listen/shutdown lifecycle.
 *
 * Plugin order is load order: config, then evlog (its hook creates the request
 * logger every later hook reads), then db, auth, errors, security, docs, routes.
 */
export async function buildApp(options: BuildAppOptions = {}) {
  const config = options.config ?? loadConfig();

  const app = Fastify({
    logger: options.logger === false ? false : { level: config.LOG_LEVEL },
    // evlog emits one wide event per request; Fastify's own request/response
    // lines would duplicate it. Lifecycle logs still go through Pino.
    logController: new LogController({ disableRequestLogging: true }),
    routerOptions: { ignoreTrailingSlash: true },
    trustProxy: true,
    requestIdHeader: "x-request-id",
    genReqId: (request) => (request.headers["x-request-id"] as string) ?? crypto.randomUUID(),
    bodyLimit: 6_000_000,
  }).withTypeProvider<TypeBoxTypeProvider>();

  await app.register(configPlugin, { config });
  await app.register(evlog, evlogOptions);
  await app.register(dbPlugin);
  await app.register(authPlugin);
  await app.register(sensible);
  await app.register(errorHandler);
  await app.register(security);
  await app.register(openapi);
  await app.register(routes);

  return app;
}
