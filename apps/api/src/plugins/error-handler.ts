import fp from "fastify-plugin";
import { parseError } from "evlog";
import type { FastifyError, FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

interface ValidationIssue {
  instancePath?: string;
  message?: string;
  params?: { missingProperty?: string };
}

/**
 * One response shape for every failure: `{ error: { code, message, details? } }`.
 *
 * Logging is not done here — evlog's plugin emits the request's wide event from
 * its error hook, so the error reaches the log once, with full context. This
 * handler only decides what the client sees: validation failures as a 400 with
 * per-field details, everything else parsed through `parseError` so an evlog
 * `createError`'s `why` / `fix` / `link` reach the response.
 */
export default fp(
  async (fastify: FastifyInstance) => {
    fastify.setErrorHandler(
      (error: FastifyError, _request: FastifyRequest, reply: FastifyReply) => {
        if (error.validation) {
          const details = error.validation.map((issue: ValidationIssue) => ({
            field: issue.instancePath
              ? issue.instancePath.replace(/^\//, "").replace(/\//g, ".")
              : (issue.params?.missingProperty ?? ""),
            message: issue.message ?? "is invalid",
          }));
          return reply.code(400).send({
            error: { code: "VALIDATION", message: "The request is invalid.", details },
          });
        }

        const parsed = parseError(error);
        const status = parsed.status >= 400 ? parsed.status : 500;

        return reply.code(status).send({
          error: {
            code: parsed.code ?? (status >= 500 ? "INTERNAL" : "REQUEST_ERROR"),
            message: status >= 500 ? "Something on our side failed." : parsed.message,
            ...(parsed.why ? { why: parsed.why } : {}),
            ...(parsed.fix ? { fix: parsed.fix } : {}),
            ...(parsed.link ? { link: parsed.link } : {}),
          },
        });
      },
    );

    fastify.setNotFoundHandler((request: FastifyRequest, reply: FastifyReply) => {
      reply.code(404).send({
        error: {
          code: "NOT_FOUND",
          message: `Route ${request.method} ${request.url} not found.`,
        },
      });
    });
  },
  { name: "error-handler", dependencies: ["config"] },
);
